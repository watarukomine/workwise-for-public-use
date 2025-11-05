
'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { fetchGasData } from '@/app/actions/fetch-gas-data';
import { ORDER_GAS_URL } from '@/lib/settings';
import type { ScheduleEvent, WithId } from '@/lib/types';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useSelectedStaff } from './selected-staff-context';
import { format } from 'date-fns';

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

  const setOrderGasUrl = (url: string) => {
    setOrderGasUrlState(url);
  };

  const setOrders = (data: any[]) => {
    setOrdersState(data);
  };

  const setError = (error: string | null) => {
    setErrorState(error);
  };

  const getStorageKey = (date: Date) => `scheduleData-${format(date, 'yyyy-MM-dd')}`;

  // Load from localStorage on mount
  useEffect(() => {
    try {
        const todayKey = getStorageKey(new Date());
        const savedEvents = localStorage.getItem(todayKey);
        if (savedEvents) {
            setScheduleEvents(JSON.parse(savedEvents));
        }
    } catch (error) {
        console.error("Failed to load schedule from localStorage", error);
    }
  }, []);

  // Save to localStorage whenever scheduleEvents changes
  useEffect(() => {
    try {
        if (scheduleEvents.length > 0) {
            const date = new Date(scheduleEvents[0].start as string);
            const key = getStorageKey(date);
            localStorage.setItem(key, JSON.stringify(scheduleEvents));
        }
    } catch (error) {
        console.error("Failed to save schedule to localStorage", error);
    }
  }, [scheduleEvents]);


  const refetchScheduleEvents = useCallback(async () => {
    // This function is now a no-op as we use localStorage, but kept for potential future use.
    return Promise.resolve();
  }, []);

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
  }, [orderGasUrl]);


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
