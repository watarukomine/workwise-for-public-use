
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
    // 初期URLを設定する。保存されたものがなければデフォルト値を使う
    const initialUrl = savedUrl || 'https://script.google.com/macros/s/AKfycb1q1B0pLIOJ_GFs7aQ2nQL1X7NxUKO7OrB35zLm7JwI-oc_FtPfkwIO0WJl7atfcOKJA/exec?sheet=販売店情報';
    setCustomerGasUrlState(initialUrl);
    // 保存されたURLがなかった場合、デフォルト値をlocalStorageに保存する
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
                // Check if the error response is JSON from our GAS script
                const errorJson = JSON.parse(errorText);
                if (errorJson.message) {
                    throw new Error(errorJson.message);
                }
             } catch (e) {
                 // If not JSON, it might be a standard HTTP error or GAS HTML error page
                 throw new Error(`データを取得できませんでした。URLが正しいか、GASが正しくデプロイされているか確認してください。(HTTP Status: ${response.status})`);
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
          setCustomers([]); // Clear data on error
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
    // *** CRITICAL FIX: Add customerGasUrl to the dependency array ***
    // This ensures that the fetch operation is re-run whenever the URL changes.
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
