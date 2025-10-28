
'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

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
    const initialUrl = savedUrl || 'https://script.google.com/macros/s/AKfycby1q1B0pLIOJ_GFs7aQ2nQL1X7NxUKO7OrB35zLm7JwI-oc_FtPfkwIO0WJl7atfcOKJA/exec?sheet=販売店情報';
    setCustomerGasUrlState(initialUrl);
    if (!savedUrl) {
      localStorage.setItem(CUSTOMER_GAS_URL_KEY, initialUrl);
    }
  }, []);
  
  const setCustomerGasUrl = (url: string) => {
    setCustomerGasUrlState(url);
    localStorage.setItem(CUSTOMER_GAS_URL_KEY, url);
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
          const response = await fetch(customerGasUrl, { cache: 'no-store' });
          if (!response.ok) {
            const errorText = await response.text();
             try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.message) {
                    throw new Error(errorJson.message);
                }
            } catch (e) {
                 throw new Error(`HTTPエラー: ${response.status} ${response.statusText}`);
            }
          }
          const result = await response.json();

          if (result.error) {
            throw new Error(result.message);
          }

          const customerData = result.data || (Array.isArray(result) ? result : []);
          setCustomers(customerData);
        } catch (e: any) {
          console.error("Failed to fetch customers from GAS:", e);
          setErrorState(`販売店情報の取得に失敗しました: ${e.message}`);
        } finally {
          setIsLoading(false);
        }
      } else {
        setErrorState("販売店データのURLが設定されていません。「データ取込」ページで設定してください。")
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
