
'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { fetchGasData } from '@/app/actions/fetch-gas-data';
import { ORDER_GAS_URL } from '@/lib/settings';
import type { ScheduleEvent, WithId } from '@/lib/types';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useSelectedStaff } from './selected-staff-context';

interface OrderContextType {
  orders: any[];
  setOrders: (orders: any[]) => void;
  scheduleEvents: WithId<ScheduleEvent>[];
  setScheduleEvents: React.Dispatch<React.SetStateAction<WithId<ScheduleEvent>[]>>;
  refetchScheduleEvents: () => Promise<void>;
  isLoading: boolean;
  orderGasUrl: string;
  setOrderGasUrl: (url: string) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orders, setOrdersState] = useState<any[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<WithId<ScheduleEvent>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orderGasUrl, setOrderGasUrlState] = useState(ORDER_GAS_URL);
  const [error, setErrorState] = useState<string | null>(null);
  const { profile } = useUserProfile();
  const { allStaff } = useSelectedStaff();

  const setOrderGasUrl = (url: string) => {
    setOrderGasUrlState(url);
  };

  const setOrders = (data: any[]) => {
    setOrdersState(data);
  };

  const setError = (error: string | null) => {
    setErrorState(error);
  };

  const refetchScheduleEvents = useCallback(async () => {
    if (!profile || allStaff.length === 0) return;

    const staffCalendarIds = allStaff.reduce((acc, staff) => {
      if (staff.calendarId) {
        acc[staff.id] = staff.calendarId;
      }
      return acc;
    }, {} as Record<string, string>);

    try {
      const response = await fetch(orderGasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'getEvents', staffCalendarIds }),
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`GAS request failed with status ${response.status}`);
      }
      const result = await response.json();
      if (result.status === 'error') {
        throw new Error(result.message);
      }
      setScheduleEvents(result.data || []);
    } catch (e: any) {
      console.error("Failed to refetch schedule events:", e);
      setErrorState(`スケジュールの再取得に失敗しました: ${e.message}`);
    }
  }, [orderGasUrl, profile, allStaff]);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (orderGasUrl) {
        setIsLoading(true);
        setErrorState(null);
        try {
          // Fetch orders
          const result = await fetchGasData(orderGasUrl);
          if (result.error && result.message) throw new Error(result.message);
          const orderData = result.data || (Array.isArray(result) ? result : []);
          setOrders(orderData);

          // Fetch schedule events
          await refetchScheduleEvents();

        } catch (e: any) {
          console.error("Failed to fetch initial data from GAS:", e);
          setErrorState(`初期データの取得に失敗しました: ${e.message}`);
          setOrders([]);
          setScheduleEvents([]);
        } finally {
          setIsLoading(false);
        }
      } else {
        setErrorState('GASのURLが設定されていません。');
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [orderGasUrl, refetchScheduleEvents]);


  const value = {
    orders,
    setOrders,
    scheduleEvents,
    setScheduleEvents,
    refetchScheduleEvents,
    isLoading,
    orderGasUrl,
    setOrderGasUrl,
    error,
    setError,
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
