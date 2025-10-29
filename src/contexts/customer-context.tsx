
'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { fetchGasData } from '@/app/actions/fetch-gas-data';

const CUSTOMER_GAS_URL_KEY = 'customerGasUrl';

interface CustomerContextType {
  customers: any[];
  setCustomers: (customers: any[]) => void;
  isLoading: boolean;
  customerGasUrl: string;
  setCustomerGasUrl: (url: string) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomersState] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customerGasUrl, setCustomerGasUrlState] = useState('');
  const [error, setErrorState] = useState<string | null>(null);

  useEffect(() => {
    const savedUrl = localStorage.getItem(CUSTOMER_GAS_URL_KEY);
    setCustomerGasUrlState(savedUrl || '');
  }, []);
  
  const setCustomerGasUrl = (url: string) => {
    localStorage.setItem(CUSTOMER_GAS_URL_KEY, url);
    setCustomerGasUrlState(url);
  };

  const setCustomers = (data: any[]) => {
    setCustomersState(data);
  };

  const setError = (error: string | null) => {
    setErrorState(error);
  };

  useEffect(() => {
    const fetchCustomers = async () => {
      if (customerGasUrl) {
        setIsLoading(true);
        setErrorState(null);
        try {
          const result = await fetchGasData(customerGasUrl);

          if (result.error && result.message) {
            throw new Error(result.message);
          }

          const customerData = result.data || (Array.isArray(result) ? result : []);
          setCustomers(customerData);
        } catch (e: any) {
          console.error("Failed to fetch customers from GAS:", e);
          setErrorState(`販売店情報の取得に失敗しました: ${e.message}`);
          setCustomers([]);
        } finally {
          setIsLoading(false);
        }
      } else {
        setErrorState(null); // URLが空の場合はエラーメッセージを表示しない
        setCustomers([]);
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, [customerGasUrl]);


  const value = {
    customers,
    setCustomers,
    isLoading,
    customerGasUrl,
    setCustomerGasUrl,
    error,
    setError,
  };

  return (
    <CustomerContext.Provider value={value}>
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  const context = useContext(CustomerContext);
  if (context === undefined) {
    throw new Error('useCustomer must be used within a CustomerProvider');
  }
  return context;
}
