'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { fetchGasData } from '@/app/actions/fetch-gas-data';
import { ORDER_GAS_URL } from '@/lib/settings';
import type { ScheduleEvent, Staff, WithId, Order, StaffStatus } from '@/lib/types';
import { findKey, mapRawToOrder } from '@/lib/utils';
import { addMinutes, subMinutes, parseISO, isValid, isEqual, startOfDay } from 'date-fns';
import { useSelectedStaff } from './selected-staff-context';

const TRAVEL_TIME_MINUTES = 30;

interface OrderContextType {
  rawOrdersData: any[];
  orders: WithId<Order>[];
  unassignedOrders: WithId<Order>[];
  setUnassignedOrders: React.Dispatch<React.SetStateAction<WithId<Order>[]>>;
  scheduleEvents: WithId<ScheduleEvent>[];
  setScheduleEvents: React.Dispatch<React.SetStateAction<WithId<ScheduleEvent>[]>>;
  statuses: StaffStatus[];
  refetchOrders: () => Promise<void>;
  isLoading: boolean;
  orderGasUrl: string;
  setOrderGasUrl: (url: string) => void;
  error: string | null;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

const processOrderData = (rawOrdersData: any[], allStaff: WithId<Staff>[]) => {
  if (!rawOrdersData.length || !allStaff.length) {
    return { orders: [], scheduleEvents: [], statuses: [], unassignedOrders: [] };
  }

  const mappedOrders: WithId<Order>[] = rawOrdersData.map((o: any) => mapRawToOrder(o));

  const newScheduleEvents: WithId<ScheduleEvent>[] = [];
  const staffStatusMap = new Map<string, StaffStatus>();
  allStaff.forEach(sf => {
    staffStatusMap.set(sf.id, { staffId: sf.id, status: '待機中', lastAction: '情報なし' });
  });

  const scheduledRawOrderIds = new Set<string>();

  rawOrdersData.forEach((rawOrder: any) => {
    const staffName = findKey(rawOrder, ['担当']);
    const staffMember = staffName ? allStaff.find(s => s.name === staffName) : undefined;
    const scheduledTimeStr = findKey(rawOrder, ['チップ配置作業予定']);

    // 1. Process scheduled events
    if (staffMember && scheduledTimeStr) {
      try {
        const scheduledTime = parseISO(scheduledTimeStr);
        if (isValid(scheduledTime)) {
          const mappedOrder = mapRawToOrder(rawOrder);
          if (mappedOrder.rawOrderId) scheduledRawOrderIds.add(mappedOrder.rawOrderId);

          const tripId = `trip-${mappedOrder.rawOrderId}`;

          const scheduledEndTimeStr = findKey(rawOrder, ['チップ配置作業完了予定']);
          const taskEndTime = scheduledEndTimeStr && isValid(parseISO(scheduledEndTimeStr))
            ? parseISO(scheduledEndTimeStr)
            : addMinutes(scheduledTime, mappedOrder.estimatedDuration);

          const taskEvent: WithId<ScheduleEvent> = {
            id: `${tripId}-task`,
            tripId,
            title: mappedOrder.taskDetails,
            staffId: staffMember.id,
            locationId: mappedOrder.customerCode || '',
            start: scheduledTime.toISOString(),
            end: taskEndTime.toISOString(),
            rawOrderId: mappedOrder.rawOrderId,
            raw: rawOrder,
          };

          const travelEvent: WithId<ScheduleEvent> = {
            id: `${tripId}-travel`,
            tripId,
            title: `移動: ${mappedOrder.customerName || mappedOrder.taskDetails.split('\n')[0]}`,
            staffId: staffMember.id,
            locationId: mappedOrder.customerCode || '',
            start: subMinutes(scheduledTime, TRAVEL_TIME_MINUTES).toISOString(),
            end: scheduledTime.toISOString(),
            rawOrderId: mappedOrder.rawOrderId,
            raw: rawOrder,
          };
          newScheduleEvents.push(travelEvent, taskEvent);
        }
      } catch (e) {
        console.error(`Error parsing schedule time for order`, rawOrder, e);
      }
    }

    // 2. Process staff statuses
    if (staffMember) {
      const lastUpdateStr = findKey(rawOrder, ['最終更新日時']);
      if (lastUpdateStr) {
        const lastUpdate = new Date(lastUpdateStr);
        const currentStatus = staffStatusMap.get(staffMember.id)!;
        const currentUpdate = currentStatus.lastUpdate ? new Date(currentStatus.lastUpdate) : new Date(0);

        if (lastUpdate.getTime() >= currentUpdate.getTime()) {
          const locationStr: string = findKey(rawOrder, ['最終位置情報（緯度,経度）']) || '';
          const [lat, lon] = locationStr.split(',').map(s => parseFloat(s.trim()));
          const orderId = findKey(rawOrder, ['受注 ID', 'id']);
          const status = findKey(rawOrder, ['受注ステータス']) || '待機中';
          const actionText = orderId ? `[${orderId}]` : '[汎用タスク]';

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
  });

  // 3. Determine unassigned orders
  const newUnassignedOrders = mappedOrders.filter(order => {
    const hasRawOrderId = !!order.rawOrderId;
    const isAlreadyScheduled = order.rawOrderId ? scheduledRawOrderIds.has(order.rawOrderId) : false;

    if (!hasRawOrderId || isAlreadyScheduled) {
      return false;
    }

    const staffName = findKey(order.raw, ['担当']);
    const scheduledTime = findKey(order.raw, ['チップ配置作業予定']);
    if (staffName || scheduledTime) {
      return false;
    }

    const scheduledDate = order.scheduledDate ? parseISO(order.scheduledDate) : null;
    const hasValidScheduledDate = scheduledDate && isValid(scheduledDate);
    return hasValidScheduledDate;
  });

  return {
    orders: mappedOrders,
    scheduleEvents: newScheduleEvents,
    statuses: Array.from(staffStatusMap.values()),
    unassignedOrders: newUnassignedOrders,
  };
};

export function OrderProvider({ children }: { children: ReactNode }) {
  const [rawOrdersData, setRawOrdersData] = useState<any[]>([]);
  const [orders, setOrders] = useState<WithId<Order>[]>([]);
  const [unassignedOrders, setUnassignedOrders] = useState<WithId<Order>[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<WithId<ScheduleEvent>[]>([]);
  const [statuses, setStatuses] = useState<StaffStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize with default, will update from localStorage in useEffect
  const [orderGasUrl, setOrderGasUrlState] = useState(ORDER_GAS_URL);

  const [error, setErrorState] = useState<string | null>(null);
  const { allStaff, isLoading: isStaffLoading } = useSelectedStaff();
  const URL_STORAGE_KEY = 'custom_order_gas_url';

  const setOrderGasUrl = (url: string) => {
    setOrderGasUrlState(url);
    try {
      localStorage.setItem(URL_STORAGE_KEY, url);
    } catch (e) {
      console.warn('Failed to save order GAS URL to localStorage:', e);
    }
  };

  useEffect(() => {
    // Load saved URL from localStorage
    try {
      const savedUrl = localStorage.getItem(URL_STORAGE_KEY);
      if (savedUrl) {
        setOrderGasUrlState(savedUrl);
      }
    } catch (e) {
      console.warn('Failed to load saved URL:', e);
    }
  }, []);

  const fetchAndProcessData = useCallback(async (showLoading = true) => {
    // Use current state orderGasUrl
    if (!orderGasUrl) {
      setErrorState('GASのURLが設定されていません。');
      if (showLoading) setIsLoading(false);
      return;
    }

    // Decoupled from staff loading to allow parallel fetching
    // if (isStaffLoading) return; 

    if (showLoading) setIsLoading(true);
    setErrorState(null);

    try {
      const result = await fetchGasData(orderGasUrl);
      if (result.error && result.message) throw new Error(result.message);

      const newRawOrderData = result.data || (Array.isArray(result) ? result : []);
      setRawOrdersData(newRawOrderData);

    } catch (e: any) {
      console.error("Failed to fetch or process order data from GAS:", e);
      setErrorState(`受注データの取得または処理に失敗しました: ${e.message}`);
      setRawOrdersData([]);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [orderGasUrl]);

  // Initial data fetch - Triggered when orderGasUrl is set (initially or from storage)
  useEffect(() => {
    fetchAndProcessData(true);
  }, [fetchAndProcessData]);

  // This effect is now solely responsible for processing data when it changes.
  useEffect(() => {
    if (isLoading || isStaffLoading) return;

    try {
      const { orders, scheduleEvents, statuses, unassignedOrders } = processOrderData(rawOrdersData, allStaff);
      setOrders(orders);
      setScheduleEvents(scheduleEvents);
      setStatuses(statuses);
      setUnassignedOrders(unassignedOrders);
    } catch (e) {
      console.error("Error processing order data:", e);
      // Optionally set an error state here, but crucial to ensure app doesn't hang
    }
  }, [rawOrdersData, allStaff, isLoading, isStaffLoading]);


  const value: OrderContextType = {
    rawOrdersData,
    orders,
    unassignedOrders,
    setUnassignedOrders,
    scheduleEvents,
    setScheduleEvents,
    statuses,
    refetchOrders: () => fetchAndProcessData(false), // Always refetch without global loading
    isLoading,
    orderGasUrl,
    setOrderGasUrl,
    error,
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
