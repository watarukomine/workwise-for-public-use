'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import type { Customer, WithId } from '@/lib/types';
import { useUserProfile } from '@/hooks/use-user-profile';

const CUSTOMER_GAS_URL_KEY = 'customerGasUrl';

interface CustomerContextType {
  customers: any[];
  setCustomers: (customers: any[]) => void;
  isLoading: boolean;
  customerGasUrl: string;
  setCustomerGasUrl: (url: string) => void;
  error: string | null;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const { profile } = useUserProfile();
  const [customers, setCustomersState] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customerGasUrl, setCustomerGasUrlState] = useState('https://script.google.com/macros/s/AKfycbyv1B6CRkN0Hld3tJuKmUgEyTSnMPDQesLk8ZuFhLQz5nhDvKiM8aU21mU4L_qrb2LgOw/exec');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedUrl = localStorage.getItem(CUSTOMER_GAS_URL_KEY);
    if (savedUrl) {
      setCustomerGasUrlState(savedUrl);
    }
  }, []);
  
  const setCustomerGasUrl = (url: string) => {
    setCustomerGasUrlState(url);
    localStorage.setItem(CUSTOMER_GAS_URL_KEY, url);
  };

  const setCustomers = (data: any[]) => {
    setCustomersState(data);
  }

  useEffect(() => {
    const fetchCustomers = async () => {
      if (profile && customerGasUrl) {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch(customerGasUrl, { cache: 'no-store' });
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const result = await response.json();
          const customerData = result.data || (Array.isArray(result) ? result : []);
          setCustomers(customerData);
        } catch (e: any) {
          console.error("Failed to fetch customers from GAS:", e);
          setError("販売店情報の取得に失敗しました。URLまたはGASの実装を確認してください。");
        } finally {
          setIsLoading(false);
        }
      } else if (!customerGasUrl) {
        setError("販売店データのURLが設定されていません。「データ取込」ページで設定してください。")
        setIsLoading(false);
      }
    };

    if (profile) {
      fetchCustomers();
    }
  }, [profile, customerGasUrl]);


  const value = {
    customers,
    setCustomers,
    isLoading,
    customerGasUrl,
    setCustomerGasUrl,
    error,
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
