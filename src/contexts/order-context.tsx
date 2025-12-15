'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import {
  syncOrdersFromGasToFirestore,
  getDailyOrdersFromFirestore,
  getNoDateOrdersFromFirestore
} from '@/services/order-service';
import type { ScheduleEvent, Staff, WithId, Order, StaffStatus } from '@/lib/types';
import { findKey } from '@/lib/utils';
import { addMinutes, subMinutes, parseISO, isValid, format } from 'date-fns';
import { useSelectedStaff } from './selected-staff-context';
import { ORDER_GAS_URL } from '@/lib/settings';
// Remove duplicate import if present or ensure it's imported correctly


const TRAVEL_TIME_MINUTES = 30;

interface OrderContextType {
  orders: WithId<Order>[];
  unassignedOrders: WithId<Order>[];
  setUnassignedOrders: React.Dispatch<React.SetStateAction<WithId<Order>[]>>;
  scheduleEvents: WithId<ScheduleEvent>[];
  setScheduleEvents: React.Dispatch<React.SetStateAction<WithId<ScheduleEvent>[]>>;
  statuses: StaffStatus[];
  loadOrders: (date: Date) => Promise<void>;
  syncOrders: () => Promise<void>;
  isLoading: boolean;
  isSyncingOrders: boolean;
  error: string | null;
  saveLocalEvent: (event: WithId<ScheduleEvent>) => void;
  refetchOrders: () => Promise<void>;
  rawOrdersData: WithId<Order>[];
  orderGasUrl: string;
  setOrderGasUrl: (url: string) => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

const processOrders = (orders: WithId<Order>[], allStaff: WithId<Staff>[]) => {
  if (!orders.length || !allStaff.length) {
    return { orders: [], scheduleEvents: [], statuses: [], unassignedOrders: [] };
  }

  const newScheduleEvents: WithId<ScheduleEvent>[] = [];
  const staffStatusMap = new Map<string, StaffStatus>();

  // Initialize statuses
  allStaff.forEach(sf => {
    staffStatusMap.set(sf.id, { staffId: sf.id, status: '待機中', lastAction: '情報なし' });
  });

  const scheduledRawOrderIds = new Set<string>();

  orders.forEach((order) => {
    // 1. Process Staff Status (using raw data if available)
    const rawOrder = order.raw;
    const staffMember = order.staffName ? allStaff.find(s => s.name === order.staffName) : undefined;

    if (staffMember && rawOrder) {
      const lastUpdateStr = findKey(rawOrder, ['最終更新日時']);
      if (lastUpdateStr) {
        const lastUpdate = new Date(lastUpdateStr);
        const currentStatus = staffStatusMap.get(staffMember.id)!;
        const currentUpdate = currentStatus.lastUpdate ? new Date(currentStatus.lastUpdate) : new Date(0);

        if (!isNaN(lastUpdate.getTime()) && lastUpdate.getTime() >= currentUpdate.getTime()) {
          const locationStr: string = findKey(rawOrder, ['最終位置情報（緯度,経度）']) || '';
          const [lat, lon] = locationStr.split(',').map(s => parseFloat(s.trim()));
          const status = findKey(rawOrder, ['受注ステータス']) || '待機中';
          const actionText = order.rawOrderId ? `[${order.rawOrderId}]` : '[汎用タスク]';

          staffStatusMap.set(staffMember.id, {
            staffId: staffMember.id,
            status: status,
            lastAction: `${actionText} ${status}`,
            latitude: !isNaN(lat) ? lat : undefined,
            longitude: !isNaN(lon) ? lon : undefined,
            lastUpdate: lastUpdate.toISOString(),
          });
        }
      }
    }

    // 2. Process Scheduled Events
    if (staffMember && order.scheduledTime) {
      // Check validity of date/time
      let scheduledTime: Date | null = null;
      const dateStr = order.scheduledDate || format(new Date(), 'yyyy-MM-dd'); // Fallback if needed?

      // Construct full ISO string if strictly time provided, or use existing ISO if full
      // mapRawToOrder puts 'scheduledTime' as formatted HH:mm usually?
      // Wait. Order.scheduledTime is STRING.
      // We need to combine date + time.
      try {
        // If scheduledTime is HH:mm
        if (/^\d{1,2}:\d{2}$/.test(order.scheduledTime)) {
          scheduledTime = parseISO(`${dateStr}T${order.scheduledTime}`);
        } else {
          scheduledTime = parseISO(order.scheduledTime);
        }
      } catch (e) { }

      if (scheduledTime && isValid(scheduledTime)) {
        if (order.rawOrderId) scheduledRawOrderIds.add(order.rawOrderId);

        const tripId = `trip-${order.rawOrderId || order.id}`;

        let taskEndTime: Date;
        if (order.scheduledEndTime) {
          // Handle HH:mm end time
          if (/^\d{1,2}:\d{2}$/.test(order.scheduledEndTime)) {
            taskEndTime = parseISO(`${dateStr}T${order.scheduledEndTime}`);
          } else {
            taskEndTime = parseISO(order.scheduledEndTime);
          }
        } else {
          taskEndTime = addMinutes(scheduledTime, order.estimatedDuration);
        }

        if (isValid(taskEndTime)) {
          const taskEvent: WithId<ScheduleEvent> = {
            ...order,
            id: `${tripId}-task`,
            tripId,
            title: order.taskDetails,
            staffId: staffMember.id,
            locationId: order.customerCode || '',
            start: scheduledTime.toISOString(),
            end: taskEndTime.toISOString(),
            rawOrderId: order.rawOrderId,
          };

          const travelEvent: WithId<ScheduleEvent> = {
            ...order,
            id: `${tripId}-travel`,
            tripId,
            title: `移動: ${order.customerName || order.taskDetails.split('\n')[0]}`,
            staffId: staffMember.id,
            locationId: order.customerCode || '',
            start: subMinutes(scheduledTime, TRAVEL_TIME_MINUTES).toISOString(),
            end: scheduledTime.toISOString(),
            rawOrderId: order.rawOrderId,
          };

          newScheduleEvents.push(travelEvent, taskEvent);
        }
      }
    }
  });

  // 3. Determine Unassigned Orders
  const newUnassignedOrders = orders.filter(order => {
    const hasRawOrderId = !!order.rawOrderId;
    const isAlreadyScheduled = order.rawOrderId ? scheduledRawOrderIds.has(order.rawOrderId) : false;

    if (!hasRawOrderId || isAlreadyScheduled) return false;

    // If staff is assigned and time is set, it's scheduled (handled above)
    if (order.staffName && order.scheduledTime) return false;

    const d = parseISO(order.scheduledDate);
    return isValid(d);
  });

  return {
    orders,
    scheduleEvents: newScheduleEvents,
    statuses: Array.from(staffStatusMap.values()),
    unassignedOrders: newUnassignedOrders
  };
};

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<WithId<Order>[]>([]);
  const [unassignedOrders, setUnassignedOrders] = useState<WithId<Order>[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<WithId<ScheduleEvent>[]>([]);
  const [statuses, setStatuses] = useState<StaffStatus[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingOrders, setIsSyncingOrders] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);

  const [localScheduleEvents, setLocalScheduleEvents] = useState<WithId<ScheduleEvent>[]>([]);
  const { allStaff, isStaffLoading } = useSelectedStaff();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const [orderGasUrl, setOrderGasUrlState] = useState(ORDER_GAS_URL);

  useEffect(() => {
    try {
      const savedUrl = localStorage.getItem('custom_order_gas_url');
      if (savedUrl) {
        setOrderGasUrlState(savedUrl);
      }
    } catch (e) {
      console.warn('Failed to load saved order GAS URL:', e);
    }
  }, []);

  const setOrderGasUrl = useCallback((url: string) => {
    setOrderGasUrlState(url);
    try {
      localStorage.setItem('custom_order_gas_url', url);
    } catch (e) {
      console.warn('Failed to save order GAS URL:', e);
    }
  }, []);

  // Load local events
  useEffect(() => {
    try {
      const saved = localStorage.getItem('local_schedule_events');
      if (saved) setLocalScheduleEvents(JSON.parse(saved));
    } catch (e) {
      console.warn('Failed to load local schedule events:', e);
    }
  }, []);

  const saveLocalEvent = useCallback((event: WithId<ScheduleEvent>) => {
    setLocalScheduleEvents(prev => {
      const exists = prev.some(e => e.id === event.id);
      let newEvents;
      if (exists) {
        newEvents = prev.map(e => e.id === event.id ? event : e);
      } else {
        newEvents = [...prev, event];
      }
      try {
        localStorage.setItem('local_schedule_events', JSON.stringify(newEvents));
      } catch (e) {
        console.error('Failed to save local event:', e);
      }
      return newEvents;
    });
  }, []);

  const loadOrders = useCallback(async (date: Date) => {
    setIsLoading(true);
    setErrorState(null);
    setCurrentDate(date); // Track current date for refetch logic

    try {
      const daily = await getDailyOrdersFromFirestore(date);
      const undated = await getNoDateOrdersFromFirestore();

      // Combine
      const allOrders = [...undated, ...daily];

      const { scheduleEvents: backendEvents, statuses, unassignedOrders } = processOrders(allOrders, allStaff);

      setOrders(allOrders);
      setScheduleEvents([...backendEvents, ...localScheduleEvents]);
      setStatuses(statuses);
      setUnassignedOrders(unassignedOrders);

    } catch (e: any) {
      console.error("Failed to load orders:", e);
      setErrorState(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [allStaff, localScheduleEvents]);

  const syncOrders = useCallback(async () => {
    setIsSyncingOrders(true);
    setErrorState(null);
    try {
      const result = await syncOrdersFromGasToFirestore();
      if (!result.success) throw new Error(result.error);

      // Reload current date
      await loadOrders(currentDate);
    } catch (e: any) {
      console.error("Sync failed:", e);
      setErrorState(e.message);
    } finally {
      setIsSyncingOrders(false);
    }
  }, [currentDate, loadOrders]);

  // Recalculate if staff loads late (but orders already loaded?)
  // If orders loaded before staff, processOrders needs to run again.
  // We can use an effect.
  useEffect(() => {
    if (orders.length > 0 && allStaff.length > 0) {
      const { scheduleEvents: backendEvents, statuses, unassignedOrders: ua } = processOrders(orders, allStaff);
      setScheduleEvents([...backendEvents, ...localScheduleEvents]);
      setStatuses(statuses);
      setUnassignedOrders(ua);
    }
  }, [allStaff, localScheduleEvents]); // orders change via loadOrders which sets states. But if allStaff updates?

  const value: OrderContextType = {
    orders,
    unassignedOrders,
    setUnassignedOrders,
    scheduleEvents,
    setScheduleEvents,
    statuses,
    loadOrders,
    syncOrders,
    isLoading,
    isSyncingOrders,
    error,
    saveLocalEvent,
    refetchOrders: () => loadOrders(currentDate),
    rawOrdersData: orders,
    orderGasUrl,
    setOrderGasUrl
  };

  return (
    <OrderContext.Provider value={value}>
      {children}
    </OrderContext.Provider>
  );
}

export function useOrder() {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error('useOrder must be used within a OrderProvider');
  }
  return context;
}
