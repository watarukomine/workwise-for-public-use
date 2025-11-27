
'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { fetchGasData } from '@/app/actions/fetch-gas-data';
import { ORDER_GAS_URL } from '@/lib/settings';
import type { Order, WithId } from '@/lib/types';
import { mapRawToOrder } from '@/lib/utils';
import { useSelectedStaff } from './selected-staff-context';

interface OrderContextType {
  orders: WithId<Order>[];
  refetchOrders: () => Promise<void>;
  isLoading: boolean;
  orderGasUrl: string;
  setOrderGasUrl: (url: string) => void;
  error: string | null;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orders, setOrdersState] = useState<WithId<Order>[]>([]);
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
    
    // Don't start fetching until staff data is available.
    if (isStaffLoading) {
      return;
    }

    setIsLoading(true);
    setErrorState(null);

    try {
      const result = await fetchGasData(orderGasUrl);
      if (result.error && result.message) throw new Error(result.message);
      
      const rawOrderData = result.data || (Array.isArray(result) ? result : []);
      // Pass allStaff to mapRawToOrder to correctly find staff names
      const mappedOrders = rawOrderData.map((order: any) => mapRawToOrder(order, allStaff));
      setOrdersState(mappedOrders);

    } catch (e: any) {
      console.error("Failed to fetch or process order data from GAS:", e);
      setErrorState(`受注データの取得または処理に失敗しました: ${e.message}`);
      setOrdersState([]);
    } finally {
      setIsLoading(false);
    }
  }, [orderGasUrl, allStaff, isStaffLoading]);


  useEffect(() => {
    fetchAndProcessData();
  }, [fetchAndProcessData]);

  const value = {
    orders,
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
