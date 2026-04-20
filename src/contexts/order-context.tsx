'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Order, WithId, ScheduleEvent, StaffStatus } from '@/lib/types';
import { OrderService } from '@/services/order-service';
import { useToast } from '@/hooks/use-toast';
import { parseISO, startOfDay, format, addMinutes, subMinutes, isValid } from 'date-fns';
import { mapRawToOrder } from '@/lib/utils';
import { useUser } from '@/firebase/provider';

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
      const firestoreOrders = await OrderService.getOrdersByDate(dateStr);
      
      // 2. Process into sets
      const newOrders = firestoreOrders.filter(o => !o.id.startsWith('task-'));
      const newUnassigned = firestoreOrders.filter(o => !o.staffId && !o.id.startsWith('task-'));
      
      const derivedEvents = deriveScheduleEvents(firestoreOrders, suppressedTripIds, date);
      
      setOrders(newOrders);
      setUnassignedOrders(newUnassigned);
      setScheduleEvents(derivedEvents);
      
    } catch (e: any) {
      setError(e.message);
      toast({ variant: 'destructive', title: '注文データの取得に失敗', description: e.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast, suppressedTripIds, user]);

  // Initial load and Realtime Subscription
  useEffect(() => {
    // Guard: skip if user is not authenticated or still loading
    if (isUserLoading || !user) return;

    fetchAndProcessData(currentDate);
    
    // Subscribe to real-time updates for the current date
    const dateStr = format(currentDate, 'yyyy/MM/dd');
    const unsubscribe = OrderService.subscribeToOrders(dateStr, (updatedOrders) => {
      // When Firestore updates, we refresh everything
      const newOrders = updatedOrders.filter(o => !o.id.startsWith('task-'));
      const newUnassigned = updatedOrders.filter(o => !o.staffId && !o.id.startsWith('task-'));
      const derivedEvents = deriveScheduleEvents(updatedOrders, suppressedTripIds, currentDate);
      
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

function deriveScheduleEvents(orders: WithId<Order>[], suppressedTripIds: string[], baseDate: Date): WithId<ScheduleEvent>[] {
    const events: WithId<ScheduleEvent>[] = [];
    
    orders.forEach(order => {
      // Handle generic tasks (id starts with task-)
      if (order.id.startsWith('task-')) {
          if (!order.scheduledDate || !order.scheduledTime || !order.scheduledEndTime) return;
          const datePart = order.scheduledDate.replace(/\//g, '-');
          events.push({
            ...order,
            id: order.id,
            title: order.taskDetails,
            staffId: order.staffId || '',
            start: parseISO(`${datePart}T${order.scheduledTime}`).toISOString(),
            end: parseISO(`${datePart}T${order.scheduledEndTime}`).toISOString(),
          } as WithId<ScheduleEvent>);
          return;
      }

      // Handle regular orders
      if (!order.staffId || !order.scheduledTime || !order.scheduledEndTime) return;

      const tripId = order.tripId || `trip-${order.id}`;
      if (suppressedTripIds.includes(tripId)) return;

      const baseDateStr = order.scheduledDate || format(baseDate, 'yyyy-MM-dd');
      const datePart = baseDateStr.replace(/\//g, '-');
      const startDate = parseISO(`${datePart}T${order.scheduledTime}`);
      const endDate = parseISO(`${datePart}T${order.scheduledEndTime}`);

      if (!isValid(startDate) || !isValid(endDate)) return;

      // Travel Event
      const travelDuration = 30;
      events.push({
        id: `${tripId}-travel`,
        tripId,
        title: '移動',
        staffId: order.staffId!,
        start: subMinutes(startDate, travelDuration).toISOString(),
        end: startDate.toISOString(),
        customerCode: '', customerName: '', address: '', taskDetails: '移動', serviceType: '', status: '移動中', 
        scheduledDate: order.scheduledDate, estimatedDuration: travelDuration, value: 0, staffName: order.staffName || '', equipmentStatus: '',
        raw: order.raw || {}
      });

      // Task Event
      events.push({
        id: `${tripId}-task`,
        tripId,
        title: order.taskDetails || '作業',
        staffId: order.staffId!,
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
        staffName: order.staffName || '',
        equipmentStatus: order.equipmentStatus,
        raw: order.raw || {}
      });
    });

    return events;
}

export const useOrder = () => {
  const context = useContext(OrderContext);
  if (context === undefined) throw new Error('useOrder must be used within a OrderProvider');
  return context;
};
