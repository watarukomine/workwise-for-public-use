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
    if (savedUrl) {
      setCustomerGasUrlState(savedUrl);
    } else {
      // Set the new URL as a default if nothing is saved
      setCustomerGasUrlState('https://script.google.com/macros/s/AKfycbyZ2ggDU-l-J4yCsVu0slMc81WnJh_Mty5xtcv0bTOWy7y7avCcE9rK83qMa8vo6WVp/exec');
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

          const responseText = await response.text();
          if (!response.ok) {
             try {
                const errorJson = JSON.parse(responseText);
                if (errorJson.message) {
                    throw new Error(errorJson.message);
                }
             } catch (e) {
                 throw new Error(`データを取得できませんでした。URLやシート名が正しいか、GASが正しくデプロイされているか確認してください。(HTTP Status: ${response.status})`);
             }
          }
          
          const result = JSON.parse(responseText);

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
