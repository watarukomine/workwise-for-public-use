
'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { fetchGasData } from '@/app/actions/fetch-gas-data';

const ORDER_GAS_URL_KEY = 'orderGasUrl';
const ORDER_SHEET_NAME = '受注管理'; // Define the sheet name

interface OrderContextType {
  orders: any[];
  setOrders: (orders: any[]) => void;
  isLoading: boolean;
  orderGasUrl: string;
  setOrderGasUrl: (url: string) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orders, setOrdersState] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orderGasUrl, setOrderGasUrlState] = useState('');
  const [error, setErrorState] = useState<string | null>(null);

  useEffect(() => {
    const savedUrl = localStorage.getItem(ORDER_GAS_URL_KEY);
    setOrderGasUrlState(savedUrl || 'https://script.google.com/macros/s/AKfycbwKHEiMgF1sj5etEdC5nngl1Trbshj299lsAaMLLvJdWz1d48WmPgMgcA86K_hbZQes6w/exec');
  }, []);
  
  const setOrderGasUrl = (url: string) => {
    localStorage.setItem(ORDER_GAS_URL_KEY, url);
    setOrderGasUrlState(url);
  };

  const setOrders = (data: any[]) => {
    setOrdersState(data);
  };

  const setError = (error: string | null) => {
    setErrorState(error);
  };

  useEffect(() => {
    const fetchOrders = async () => {
      if (orderGasUrl) {
        setIsLoading(true);
        setErrorState(null);
        try {
          // Append sheet name as a query parameter
          const url = new URL(orderGasUrl);
          url.searchParams.set('sheet', ORDER_SHEET_NAME);
          
          const result = await fetchGasData(url.toString());

          if (result.error && result.message) {
            throw new Error(result.message);
          }

          const orderData = result.data || (Array.isArray(result) ? result : []);
          setOrders(orderData);
        } catch (e: any) {
          console.error("Failed to fetch orders from GAS:", e);
          setErrorState(`受注情報の取得に失敗しました: ${e.message}`);
          setOrders([]);
        } finally {
          setIsLoading(false);
        }
      } else {
        setErrorState("受注データのURLが設定されていません。")
        setOrders([]);
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [orderGasUrl]);


  const value = {
    orders,
    setOrders,
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
