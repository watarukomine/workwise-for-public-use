
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

export function OrderProvider({ children }: { children: ReactNode }) {
  const [rawOrdersData, setRawOrdersData] = useState<any[]>([]);
  const [orders, setOrders] = useState<WithId<Order>[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<WithId<ScheduleEvent>[]>([]);
  const [unassignedOrders, setUnassignedOrders] = useState<WithId<Order>[]>([]);
  const [statuses, setStatuses] = useState<StaffStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orderGasUrl, setOrderGasUrlState] = useState(ORDER_GAS_URL);
  const [error, setErrorState] = useState<string | null>(null);
  const { allStaff, isLoading: isStaffLoading } = useSelectedStaff();

  const setOrderGasUrl = (url: string) => {
    setOrderGasUrlState(url);
  };
  
  const fetchAndProcessData = useCallback(async () => {
    if (!orderGasUrl) {
      setErrorState('GASのURLが設定されていません。');
      setIsLoading(false);
      return;
    }
    
    if (isStaffLoading) {
      // Wait for staff to be loaded before proceeding
      return;
    }

    setIsLoading(true);
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
      setOrders([]);
      setScheduleEvents([]);
      setStatuses([]);
    } finally {
      setIsLoading(false);
    }
  }, [orderGasUrl, isStaffLoading]);

  // Initial data fetch
  useEffect(() => {
    fetchAndProcessData();
  }, [fetchAndProcessData]);

  // This effect is now solely responsible for processing data when it changes.
  useEffect(() => {
    if (!rawOrdersData.length || !allStaff.length) {
      setOrders([]);
      setScheduleEvents([]);
      setStatuses([]);
      setUnassignedOrders([]);
      return;
    }

    const mappedOrders: WithId<Order>[] = rawOrdersData.map((o: any, index: number) => mapRawToOrder(o, index));
    setOrders(mappedOrders);

    const newScheduleEvents: WithId<ScheduleEvent>[] = [];
    const staffStatusMap = new Map<string, StaffStatus>();

    allStaff.forEach(sf => {
      staffStatusMap.set(sf.id, {
        staffId: sf.id,
        status: '待機中',
        lastAction: '情報なし',
      });
    });
    
    const scheduledRawOrderIds = new Set<string>();

    rawOrdersData.forEach((rawOrder: any, index: number) => {
      const staffName = findKey(rawOrder, ['担当']);
      const staffMember = staffName ? allStaff.find(s => s.name === staffName) : undefined;
      const scheduledTimeStr = findKey(rawOrder, ['チップ配置作業予定']);
      
      if (staffMember && scheduledTimeStr) {
        try {
          const scheduledTime = parseISO(scheduledTimeStr);

          if (isValid(scheduledTime)) {
              const mappedOrder = mapRawToOrder(rawOrder, index);
              if (mappedOrder.rawOrderId) {
                scheduledRawOrderIds.add(mappedOrder.rawOrderId);
              }

              const tripId = `trip-${mappedOrder.rawOrderId || mappedOrder.id}`;
              
              const taskEventId = `${tripId}-task`;
              const travelEventId = `${tripId}-travel`;

              const taskEvent: WithId<ScheduleEvent> = {
                  ...mappedOrder,
                  id: taskEventId,
                  tripId,
                  orderId: mappedOrder.id,
                  title: mappedOrder.taskDetails,
                  staffId: staffMember.id,
                  locationId: mappedOrder.customerCode || '',
                  start: scheduledTime.toISOString(),
                  end: addMinutes(scheduledTime, mappedOrder.estimatedDuration).toISOString(),
              };

              const travelEvent: WithId<ScheduleEvent> = {
                  ...mappedOrder,
                  id: travelEventId,
                  tripId,
                  orderId: mappedOrder.id,
                  title: `移動: ${mappedOrder.customerName || mappedOrder.taskDetails.split('\n')[0]}`,
                  staffId: staffMember.id,
                  locationId: mappedOrder.customerCode || '',
                  start: subMinutes(scheduledTime, TRAVEL_TIME_MINUTES).toISOString(),
                  end: scheduledTime.toISOString(),
              };
              newScheduleEvents.push(travelEvent, taskEvent);
          }
        } catch(e) {
          const orderId = findKey(rawOrder, ['受注 ID', '受注id', '受注ID', 'id']);
          console.error("Error parsing schedule time for order:", orderId, e);
        }
      }
      
      if (staffMember) {
          const lastUpdateStr = findKey(rawOrder, ['最終更新日時']);
          const lastUpdate = lastUpdateStr ? new Date(lastUpdateStr) : new Date(0);

          const currentStatus = staffStatusMap.get(staffMember.id)!;
          const currentUpdate = currentStatus.lastUpdate ? new Date(currentStatus.lastUpdate) : new Date(0);
          
          if (lastUpdate.getTime() >= currentUpdate.getTime()) {
              const locationStr: string = findKey(rawOrder, ['最終位置情報（緯度,経度）']) || '';
              const [lat, lon] = locationStr.split(',').map(s => parseFloat(s.trim()));
              
              staffStatusMap.set(staffMember.id, {
                  staffId: staffMember.id,
                  status: findKey(rawOrder, ['受注ステータス']) || '待機中',
                  lastAction: `[${findKey(rawOrder, ['受注 ID', 'id'])}] ${findKey(rawOrder, ['受注ステータス'])}`,
                  latitude: !isNaN(lat) ? lat : undefined,
                  longitude: !isNaN(lon) ? lon : undefined,
                  lastUpdate: lastUpdate.toISOString(),
              });
          }
      }
    });

    const newUnassignedOrders = mappedOrders.filter(order => {
        if (!order.rawOrderId) return false;
        if (scheduledRawOrderIds.has(order.rawOrderId)) return false;

        // An unassigned order should not have a staff or scheduled time.
        const staffName = findKey(order.raw, ['担当']);
        const scheduledTime = findKey(order.raw, ['チップ配置作業予定']);
        if(staffName || scheduledTime) return false;
        
        const scheduledDate = order.scheduledDate ? parseISO(order.scheduledDate) : null;
        return scheduledDate && isValid(scheduledDate);
    });

    setUnassignedOrders(newUnassignedOrders);
    setScheduleEvents(newScheduleEvents);
    setStatuses(Array.from(staffStatusMap.values()));
    
  }, [rawOrdersData, allStaff]);


  const value: OrderContextType = {
    rawOrdersData,
    orders,
    unassignedOrders,
    setUnassignedOrders,
    scheduleEvents,
    setScheduleEvents,
    statuses,
    refetchOrders: fetchAndProcessData,
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
