
'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { fetchGasData } from '@/app/actions/fetch-gas-data';
import { ORDER_GAS_URL } from '@/lib/settings';
import type { ScheduleEvent, WithId } from '@/lib/types';
import { findKey } from '@/lib/utils';
import { parseISO, isValid, addMinutes, subMinutes } from 'date-fns';

const TRAVEL_TIME_MINUTES = 30;

interface OrderContextType {
  orders: any[];
  scheduleEvents: WithId<ScheduleEvent>[];
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

      // Process orders to create schedule events
      const events: WithId<ScheduleEvent>[] = [];
      orderData.forEach((order: any) => {
        const staffName = findKey(order, ['担当']);
        const scheduledTimeStr = findKey(order, ['チップ配置作業予定']);
        
        if (staffName && scheduledTimeStr) {
          const scheduledTime = parseISO(scheduledTimeStr);
          if (isValid(scheduledTime)) {
            const duration = parseInt(findKey(order, ['作業時間（分）', '作業時間(分)', '作業時間']), 10) || 60;
            const tripId = `trip-${findKey(order, ['受注ID', '受注id', '受注ID', 'id'])}`;
            const taskStart = scheduledTime;
            const taskEnd = addMinutes(taskStart, duration);
            const travelStart = subMinutes(taskStart, TRAVEL_TIME_MINUTES);

            const customerName = findKey(order, ['お取引先名', '店舗', '取引先']) || '';
            const taskDetails = `${findKey(order, ['タイヤサイズ', 'サイズ']) || ''}${findKey(order, ['本数']) ? ` / ${findKey(order, ['本数'])}本` : ''}`.trim();

            const travelEvent: WithId<ScheduleEvent> = {
              id: `${tripId}-travel`,
              tripId,
              title: `移動: ${customerName}`,
              staffId: staffName,
              start: travelStart.toISOString(),
              end: taskStart.toISOString(),
              rawOrderId: String(findKey(order, ['受注ID', '受注id', '受注ID', 'id']))
            };

            const taskEvent: WithId<ScheduleEvent> = {
              id: `${tripId}-task`,
              tripId,
              title: `${customerName}\n${taskDetails}`,
              staffId: staffName,
              start: taskStart.toISOString(),
              end: taskEnd.toISOString(),
              rawOrderId: String(findKey(order, ['受注ID', '受注id', '受注ID', 'id']))
            };

            events.push(travelEvent, taskEvent);
          }
        }
      });
      setScheduleEvents(events);

    } catch (e: any) {
      console.error("Failed to fetch or process data from GAS:", e);
      setErrorState(`データの取得または処理に失敗しました: ${e.message}`);
      setOrdersState([]);
      setScheduleEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [orderGasUrl]);


  useEffect(() => {
    fetchAndProcessData();
  }, [fetchAndProcessData]);

  const value = {
    orders,
    scheduleEvents,
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
