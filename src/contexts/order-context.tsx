'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Order, WithId, ScheduleEvent, StaffStatus, Staff } from '@/lib/types';
import { OrderService } from '@/services/order-service';
import { useToast } from '@/hooks/use-toast';
import { parseISO, startOfDay, format, addMinutes, subMinutes, isValid } from 'date-fns';
import { mapRawToOrder } from '@/lib/utils';
import { useUser } from '@/firebase/provider';
import { useSelectedStaff } from '@/contexts/selected-staff-context';

export type OrderContextType = {
  orders: WithId<Order>[];
  setOrders: React.Dispatch<React.SetStateAction<WithId<Order>[]>>;
  unassignedOrders: WithId<Order>[];
  setUnassignedOrders: React.Dispatch<React.SetStateAction<WithId<Order>[]>>;
  scheduleEvents: WithId<ScheduleEvent>[];
  setScheduleEvents: React.Dispatch<React.SetStateAction<WithId<ScheduleEvent>[]>>;
  statuses: StaffStatus[];
  loadOrders: (date: Date) => Promise<void>;
  syncOrders: () => Promise<void>;
  isLoading: boolean;
  isSyncingOrders: boolean;
  error: string|null;
  saveLocalEvent: (event: WithId<ScheduleEvent>) => void;
  deleteLocalEvent: (eventId: string) => void;
  refetchOrders: () => Promise<void>;
  loadRange: (date: Date, range: number) => Promise<void>;
  rawOrdersData: any[]; // Compatibility with legacy
  orderGasUrl: string;
  setOrderGasUrl: (url: string) => void;
  toggleTripSuppression: (tripId: string) => void;
  suppressedTripIds: string[];
  currentDate: Date; // upstream uses currentDate
  setCurrentDate: (date: Date) => void;
  currentViewedDate: Date; // legacy/other components might use this
  setCurrentViewedDate: (date: Date) => void;
};

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<WithId<Order>[]>([]);
  const [unassignedOrders, setUnassignedOrders] = useState<WithId<Order>[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<WithId<ScheduleEvent>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suppressedTripIds, setSuppressedTripIds] = useState<string[]>([]);
  const [orderGasUrl, setOrderGasUrl] = useState('');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const { allStaff } = useSelectedStaff();

  const fetchAndProcessData = useCallback(async (date: Date) => {
    // Guard: skip Firestore fetch if user is not authenticated
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const dateStr = format(date, 'yyyy/MM/dd');
      
      // 1. Fetch from Firestore
      const rawFirestoreOrders = await OrderService.getOrdersByDate(dateStr);
      
      // 2. Normalize data using mapRawToOrder
      const firestoreOrders = rawFirestoreOrders.map(o => mapRawToOrder(o.raw || o, o.id));
      
      // 3. Process into sets
      const newOrders = firestoreOrders.filter(o => o._type !== 'task');
      const newUnassigned = firestoreOrders.filter(o => !o.staffId && o._type !== 'task');
      
      const derivedEvents = deriveScheduleEvents(firestoreOrders, suppressedTripIds, date, allStaff);
      
      console.log(`[OrderContext] Fetched ${firestoreOrders.length} orders from Firestore for ${dateStr}`);
      console.log(`[OrderContext] Derived ${derivedEvents.length} events for timeline`);
      
      setOrders(newOrders);
      setUnassignedOrders(newUnassigned);
      setScheduleEvents(derivedEvents);
      
    } catch (e: any) {
      setError(e.message);
      toast({ variant: 'destructive', title: '注文データの取得に失敗', description: e.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast, suppressedTripIds, user, allStaff]);

  // Initial load and Realtime Subscription
  useEffect(() => {
    // Guard: skip if user is not authenticated or still loading
    if (isUserLoading || !user) return;

    fetchAndProcessData(currentDate);
    
    // Subscribe to real-time updates for the current date
    const dateStr = format(currentDate, 'yyyy/MM/dd');
    const unsubscribe = OrderService.subscribeToOrders(dateStr, (updatedOrders) => {
      // Normalize data
      const normalizedOrders = updatedOrders.map(o => mapRawToOrder(o.raw || o, o.id));
      
      // When Firestore updates, we refresh everything
      const newOrders = normalizedOrders.filter(o => o._type !== 'task');
      const newUnassigned = normalizedOrders.filter(o => !o.staffId && o._type !== 'task');
      const derivedEvents = deriveScheduleEvents(normalizedOrders, suppressedTripIds, currentDate, allStaff);
      
      setOrders(newOrders);
      setUnassignedOrders(newUnassigned);
      setScheduleEvents(derivedEvents);
    });

    return () => unsubscribe();
  }, [fetchAndProcessData, currentDate, suppressedTripIds, user, isUserLoading]);

  const rawOrdersData = useMemo(() => orders.map(o => o.raw || {}), [orders]);

  const loadOrders = useCallback(async (date: Date) => {
    setCurrentDate(date);
    await fetchAndProcessData(date);
  }, [fetchAndProcessData]);

  const syncOrders = useCallback(async () => {
    await fetchAndProcessData(currentDate);
  }, [fetchAndProcessData, currentDate]);

  const refetchOrders = useCallback(async () => {
    await syncOrders();
  }, [syncOrders]);

  const loadRange = useCallback(async (date: Date, range: number) => {
    // Basic implementation for range-aware UI
    await loadOrders(date);
  }, [loadOrders]);

  const saveLocalEvent = useCallback((event: WithId<ScheduleEvent>) => {
    setScheduleEvents(prev => {
      const idx = prev.findIndex(e => e.id === event.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = event;
        return next;
      }
      return [...prev, event];
    });
  }, []);

  const deleteLocalEvent = useCallback((eventId: string) => {
    setScheduleEvents(prev => prev.filter(e => e.id !== eventId));
  }, []);

  const toggleTripSuppression = useCallback((tripId: string) => {
      setSuppressedTripIds(prev => 
          prev.includes(tripId) ? prev.filter(id => id !== tripId) : [...prev, tripId]
      );
  }, []);

  // Derive statuses from orders
  const statuses = useMemo(() => {
    const statusMap = new Map<string, StaffStatus>();
    
    orders.forEach(order => {
        if (!order.staffId) return;
        
        const existing = statusMap.get(order.staffId);
        if (!existing || (order.updatedAt && (!existing.lastUpdate || new Date(order.updatedAt) > new Date(existing.lastUpdate)))) {
            statusMap.set(order.staffId, {
                staffId: order.staffId,
                status: order.status,
                lastAction: order.status || '',
                lastUpdate: typeof order.updatedAt === 'string' ? order.updatedAt : (order.updatedAt as any)?.toISOString?.() || ''
            });
        }
    });

    return Array.from(statusMap.values());
  }, [orders]);

  const createOrder = useCallback(async (data: Partial<Order>) => {
    try {
      await OrderService.createOrder(data);
      // Real-time listener will update the state
      toast({ title: '受注を作成しました' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '作成に失敗', description: e.message });
    }
  }, [toast]);

  const updateOrder = useCallback(async (id: string, data: Partial<Order>) => {
    try {
      await OrderService.updateOrder(id, data);
      // Real-time listener will update the state
    } catch (e: any) {
      toast({ variant: 'destructive', title: '更新に失敗', description: e.message });
    }
  }, [toast]);

  const value = {
    orders,
    setOrders,
    unassignedOrders,
    setUnassignedOrders,
    scheduleEvents,
    setScheduleEvents,
    statuses,
    loadOrders,
    syncOrders,
    createOrder,
    updateOrder,
    isLoading,
    isSyncingOrders: isLoading,
    error,
    saveLocalEvent,
    deleteLocalEvent,
    refetchOrders,
    loadRange,
    rawOrdersData,
    orderGasUrl,
    setOrderGasUrl,
    toggleTripSuppression,
    suppressedTripIds,
    currentDate,
    setCurrentDate,
    currentViewedDate: currentDate,
    setCurrentViewedDate: setCurrentDate
  };

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

function deriveScheduleEvents(orders: WithId<Order>[], suppressedTripIds: string[], baseDate: Date, staffList?: WithId<Staff>[]): WithId<ScheduleEvent>[] {
    const events: WithId<ScheduleEvent>[] = [];
    
    orders.forEach(order => {
      // 共通の日付パーツ作成
      const baseDateStr = order.scheduledDate || format(baseDate, 'yyyy-MM-dd');
      const datePart = baseDateStr.replace(/\//g, '-');

      // ─── スタッフ名→スタッフID推定フォールバック ───
      // staffIdが空だがstaffNameがある場合、staffListから一致するIDを補完
      if (!order.staffId && order.staffName && staffList && staffList.length > 0) {
        const matchedStaff = staffList.find(s => s.name === order.staffName);
        if (matchedStaff) {
          order = { ...order, staffId: matchedStaff.id };
          console.log(`[deriveScheduleEvents] Resolved staffId from staffName: ${order.staffName} -> ${matchedStaff.id}`);
        }
      }

      // ─── scheduledEndTime自動計算フォールバック ───
      // scheduledEndTimeが空だがscheduledTimeがある場合、estimatedDurationから計算
      if (order.scheduledTime && !order.scheduledEndTime) {
        const duration = order.estimatedDuration || 60;
        const timeStr = order.scheduledTime;
        let startDate: Date | null = null;

        if (timeStr.includes('T')) {
          startDate = parseISO(timeStr);
        } else if (/^\d{1,2}:\d{2}/.test(timeStr)) {
          const parts = timeStr.split(':');
          const hh = parts[0].padStart(2, '0');
          const mm = parts[1].padStart(2, '0');
          startDate = parseISO(`${datePart}T${hh}:${mm}`);
        }

        if (startDate && isValid(startDate)) {
          const endDate = addMinutes(startDate, duration);
          order = { ...order, scheduledEndTime: endDate.toISOString() };
          console.log(`[deriveScheduleEvents] Auto-calculated endTime for ID=${order.id}: ${order.scheduledTime} + ${duration}min = ${order.scheduledEndTime}`);
        }
      }

      // 時刻文字列をパース可能な形式 (HH:mm) に正規化するヘルパー
      const normalizeTime = (timeStr: string | undefined) => {
        if (!timeStr) return null;
        if (timeStr.includes('T')) return timeStr; // すでにISO形式ならそのまま
        
        // "9:00" -> "09:00", "9:00:00" -> "09:00"
        const parts = timeStr.split(':');
        if (parts.length >= 2) {
          const hh = parts[0].padStart(2, '0');
          const mm = parts[1].padStart(2, '0');
          return `${hh}:${mm}`;
        }
        return null;
      };

      // Handle generic tasks (where _type is task or id starts with task-)
      if (order._type === 'task' || order.id.startsWith('task-')) {
          const startTime = order.scheduledTime;
          const endTime = order.scheduledEndTime;
          
          let startDate: Date | null = null;
          let endDate: Date | null = null;

          if (startTime && startTime.includes('T')) {
            startDate = parseISO(startTime);
          } else {
            const normStart = normalizeTime(startTime);
            if (normStart) startDate = parseISO(`${datePart}T${normStart}`);
          }

          if (endTime && endTime.includes('T')) {
            endDate = parseISO(endTime);
          } else {
            const normEnd = normalizeTime(endTime);
            if (normEnd) endDate = parseISO(`${datePart}T${normEnd}`);
          }

          if (!startDate || !isValid(startDate) || !endDate || !isValid(endDate)) {
            console.warn(`[deriveScheduleEvents] Task skipped (Invalid Date): ID=${order.id}, Start=${startTime}, End=${endTime}, Date=${datePart}`);
            return;
          }

          events.push({
            ...order,
            id: order.id,
            title: order.taskDetails || 'タスク',
            staffId: order.staffId || '',
            staffName: order.staffName || '',
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          } as WithId<ScheduleEvent>);
          return;
      }

      // Handle regular orders
      // スタッフIDがなくてもスタッフ名があれば、後続の表示ロジックでマッチングできるため、ここでは通す
      if (!order.staffId && !order.staffName) {
        console.log(`[deriveScheduleEvents] Order skipped (No Staff): ID=${order.id}, Customer=${order.customerName}`);
        return;
      }
      
      if (!order.scheduledTime) {
        console.log(`[deriveScheduleEvents] Order skipped (No Start Time): ID=${order.id}, Start=${order.scheduledTime}`);
        return;
      }

      if (!order.scheduledEndTime) {
        console.log(`[deriveScheduleEvents] Order skipped (No End Time even after auto-calc): ID=${order.id}, End=${order.scheduledEndTime}`);
        return;
      }

      const tripId = order.tripId || `trip-${order.id}`;
      if (suppressedTripIds.includes(tripId)) return;
      
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      if (order.scheduledTime.includes('T')) {
        startDate = parseISO(order.scheduledTime);
      } else {
        const normStart = normalizeTime(order.scheduledTime);
        if (normStart) startDate = parseISO(`${datePart}T${normStart}`);
      }

      if (order.scheduledEndTime.includes('T')) {
        endDate = parseISO(order.scheduledEndTime);
      } else {
        const normEnd = normalizeTime(order.scheduledEndTime);
        if (normEnd) endDate = parseISO(`${datePart}T${normEnd}`);
      }

      if (!startDate || !isValid(startDate) || !endDate || !isValid(endDate)) {
        console.warn(`[deriveScheduleEvents] Order skipped (Invalid Date): ID=${order.id}, Start=${order.scheduledTime}, End=${order.scheduledEndTime}, Date=${datePart}`);
        return;
      }

      // Travel Event (移動)
      const travelDuration = 30;
      events.push({
        id: `${tripId}-travel`,
        tripId,
        title: '移動',
        staffId: order.staffId || '',
        staffName: order.staffName || '',
        start: subMinutes(startDate, travelDuration).toISOString(),
        end: startDate.toISOString(),
        customerCode: '', customerName: '', address: '', taskDetails: '移動', serviceType: '', status: '移動中', 
        scheduledDate: order.scheduledDate, estimatedDuration: travelDuration, value: 0, equipmentStatus: '',
        raw: order.raw || {}
      });

      // Task Event (本作業)
      events.push({
        id: `${tripId}-task`,
        tripId,
        title: order.taskDetails || '作業',
        staffId: order.staffId || '',
        staffName: order.staffName || '',
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        customerCode: order.customerCode,
        customerName: order.customerName,
        address: order.address,
        taskDetails: order.taskDetails,
        serviceType: order.serviceType,
        status: order.status,
        scheduledDate: order.scheduledDate,
        estimatedDuration: order.estimatedDuration,
        value: order.value,
        equipmentStatus: order.equipmentStatus,
        raw: order.raw || {}
      });
    });

    console.log(`[deriveScheduleEvents] Final events count: ${events.length}`);
    return events;
}

export const useOrder = () => {
  const context = useContext(OrderContext);
  if (context === undefined) throw new Error('useOrder must be used within a OrderProvider');
  return context;
};
