
'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { fetchGasData } from '@/app/actions/fetch-gas-data';
import { ORDER_GAS_URL } from '@/lib/settings';
import type { Order, ScheduleEvent, Staff, WithId } from '@/lib/types';
import { findKey, mapRawToOrder } from '@/lib/utils';
import { parseISO, isValid, addMinutes, subMinutes } from 'date-fns';
import { useSelectedStaff } from './selected-staff-context';

const TRAVEL_TIME_MINUTES = 30;

interface OrderContextType {
  orders: WithId<Order>[];
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
  const [orders, setOrdersState] = useState<WithId<Order>[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<WithId<ScheduleEvent>[]>([]);
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
    
    setIsLoading(true);
    setErrorState(null);

    try {
      const result = await fetchGasData(orderGasUrl);
      if (result.error && result.message) throw new Error(result.message);
      
      const rawOrderData = result.data || (Array.isArray(result) ? result : []);
      const mappedOrders = rawOrderData.map(mapRawToOrder);
      setOrdersState(mappedOrders);

      const events: WithId<ScheduleEvent>[] = [];
      if (allStaff.length > 0) {
        mappedOrders.forEach((order: WithId<Order>) => {
          const staffMember = order.staffName ? allStaff.find(s => s.name === order.staffName) : undefined;
          const scheduledTimeStr = order.scheduledTime;
          
          if (staffMember && scheduledTimeStr) {
            try {
                const scheduledTime = parseISO(scheduledTimeStr);
                if (isValid(scheduledTime)) {
                  const duration = order.estimatedDuration;
                  const tripId = `trip-${order.rawOrderId}`;
                  const taskStart = scheduledTime;
                  const taskEnd = addMinutes(taskStart, duration);
                  const travelStart = subMinutes(taskStart, TRAVEL_TIME_MINUTES);
                  
                  const travelEvent: WithId<ScheduleEvent> = {
                    ...order,
                    id: `${tripId}-travel`,
                    tripId,
                    title: `移動: ${order.customerName || order.taskDetails.split('\n')[0]}`,
                    staffId: staffMember.id,
                    start: travelStart.toISOString(),
                    end: taskStart.toISOString(),
                  };
      
                  const taskEvent: WithId<ScheduleEvent> = {
                    ...order,
                    id: `${tripId}-task`,
                    tripId,
                    title: order.taskDetails,
                    staffId: staffMember.id,
                    start: taskStart.toISOString(),
                    end: taskEnd.toISOString(),
                  };
      
                  events.push(travelEvent, taskEvent);
                }
            } catch (e) {
                // Could not parse date or other error, treat as unassigned
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
    if (!isStaffLoading) {
      fetchAndProcessData();
    }
  }, [fetchAndProcessData, isStaffLoading]);

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
