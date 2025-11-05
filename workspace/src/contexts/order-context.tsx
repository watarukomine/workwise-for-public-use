'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { fetchGasData } from '@/app/actions/fetch-gas-data';
import { ORDER_GAS_URL } from '@/lib/settings';
import type { ScheduleEvent, Staff, WithId } from '@/lib/types';
import { findKey, mapRawToOrder } from '@/lib/utils';
import { parseISO, isValid, addMinutes, subMinutes } from 'date-fns';
import { useSelectedStaff } from './selected-staff-context';

const TRAVEL_TIME_MINUTES = 30;

interface OrderContextType {
  orders: any[];
  scheduleEvents: WithId<ScheduleEvent>[];
  setScheduleEvents: React.Dispatch<React.SetStateAction<WithId<ScheduleEvent>[]>>;
  refetchOrders: () => Promise<void>;
  isLoading: boolean;
  orderGasUrl: string;
  setOrderGasUrl: (url: string) => void;
  error: string | null;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orders, setOrdersState] = useState<any[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<WithId<ScheduleEvent>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orderGasUrl, setOrderGasUrlState] = useState(ORDER_GAS_URL);
  const [error, setErrorState] = useState<string | null>(null);
  const { allStaff, isLoading: isStaffLoading } = useSelectedStaff(); // Staff data to map names to IDs

  const setOrderGasUrl = (url: string) => {
    setOrderGasUrlState(url);
  };
  
  const fetchAndProcessData = useCallback(async () => {
    if (!orderGasUrl) {
      setErrorState('GASのURLが設定されていません。');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setErrorState(null);

    try {
      const result = await fetchGasData(orderGasUrl);
      if (result.error && result.message) throw new Error(result.message);
      
      const orderData = result.data || (Array.isArray(result) ? result : []);
      setOrdersState(orderData);

      const events: WithId<ScheduleEvent>[] = [];
      if (allStaff.length > 0) {
        orderData.forEach((order: any) => {
          const staffName = findKey(order, ['担当']);
          const staffMember = staffName ? allStaff.find(s => s.name === staffName) : undefined;
          const scheduledTimeStr = findKey(order, ['チップ配置作業予定']);
          
          if (staffMember && scheduledTimeStr) {
            const scheduledTime = parseISO(scheduledTimeStr);
            if (isValid(scheduledTime)) {
              const mappedOrder = mapRawToOrder(order);
              const duration = mappedOrder.estimatedDuration;
              const tripId = `trip-${mappedOrder.rawOrderId}`;
              const taskStart = scheduledTime;
              const taskEnd = addMinutes(taskStart, duration);
              const travelStart = subMinutes(taskStart, TRAVEL_TIME_MINUTES);
              
              const travelEvent: WithId<ScheduleEvent> = {
                id: `${tripId}-travel`,
                tripId,
                title: `移動: ${mappedOrder.taskDetails.split('\n')[0]}`,
                staffId: staffMember.id, // Use staff ID
                start: travelStart.toISOString(),
                end: taskStart.toISOString(),
                rawOrderId: mappedOrder.rawOrderId,
                calendarEventId: findKey(order, ['travelCalendarEventId']), 
              };
  
              const taskEvent: WithId<ScheduleEvent> = {
                id: `${tripId}-task`,
                tripId,
                orderId: mappedOrder.id,
                rawOrderId: mappedOrder.rawOrderId,
                title: mappedOrder.taskDetails,
                staffId: staffMember.id, // Use staff ID
                locationId: mappedOrder.customerCode,
                start: taskStart.toISOString(),
                end: taskEnd.toISOString(),
                calendarEventId: findKey(order, ['taskCalendarEventId']),
              };
  
              events.push(travelEvent, taskEvent);
            }
          }
        });
      }
      setScheduleEvents(events);

    } catch (e: any) {
      console.error("Failed to fetch or process data from GAS:", e);
      setErrorState(`データの取得または処理に失敗しました: ${e.message}`);
      setOrdersState([]);
      setScheduleEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [orderGasUrl, allStaff]);


  useEffect(() => {
    if (!isStaffLoading && allStaff.length > 0) {
      fetchAndProcessData();
    } else if (!isStaffLoading && allStaff.length === 0) {
      // If there are no staff, there's no point in trying to process orders.
      // This can happen if the staff sheet fails to load.
      setIsLoading(false);
    }
  }, [fetchAndProcessData, allStaff, isStaffLoading]);

  const value = {
    orders,
    scheduleEvents,
    setScheduleEvents,
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
