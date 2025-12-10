
'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { fetchGasData } from '@/app/actions/fetch-gas-data';
import { CUSTOMER_GAS_URL } from '@/lib/settings';

import type { WithId, Customer } from '@/lib/types';

interface CustomerContextType {
  customers: WithId<Customer>[];
  setCustomers: (customers: WithId<Customer>[]) => void;
  isLoading: boolean;
  customerGasUrl: string;
  setCustomerGasUrl: (url: string) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomersState] = useState<WithId<Customer>[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize with default, will update from localStorage in useEffect
  const [customerGasUrl, setCustomerGasUrlState] = useState(CUSTOMER_GAS_URL);

  const [error, setErrorState] = useState<string | null>(null);
  const URL_STORAGE_KEY = 'custom_customer_gas_url';

  const setCustomerGasUrl = (url: string) => {
    setCustomerGasUrlState(url);
    try {
      localStorage.setItem(URL_STORAGE_KEY, url);
    } catch (e) {
      console.warn('Failed to save customer GAS URL to localStorage:', e);
    }
  };

  const setCustomers = (data: any[]) => {
    setCustomersState(data);
  };

  const setError = (error: string | null) => {
    setErrorState(error);
  };

  const CUSTOMER_CACHE_KEY = 'cached_customer_data';

  useEffect(() => {
    // Load saved URL from localStorage
    try {
      const savedUrl = localStorage.getItem(URL_STORAGE_KEY);
      if (savedUrl) {
        setCustomerGasUrlState(savedUrl);
      }
    } catch (e) {
      console.warn('Failed to load saved URL:', e);
    }
  }, []);

  useEffect(() => {
    const fetchCustomers = async () => {
      // Use current state customerGasUrl
      if (!customerGasUrl) {
        setErrorState('販売店情報を取得するためのGoogle Apps Script URLが設定されていません。');
        setCustomers([]);
        setIsLoading(false);
        return;
      }

      setErrorState(null);

      // Step 1: Load cached data immediately (optimistic)
      try {
        const cachedData = localStorage.getItem(CUSTOMER_CACHE_KEY);
        if (cachedData) {
          const { customers: cachedCustomers, timestamp } = JSON.parse(cachedData);
          if (cachedCustomers && cachedCustomers.length > 0) {
            setCustomers(cachedCustomers);
            // Show UI immediately with cached data
            setIsLoading(false);
          }
        }
      } catch (e) {
        console.warn('Failed to load cached customer data:', e);
      }

      // Step 2: Fetch fresh data in background
      try {
        if (customers.length === 0) {
          setIsLoading(true);
        }

        const result = await fetchGasData(customerGasUrl);

        if (result.error) {
          if (customers.length === 0) {
            throw new Error(result.error);
          } else {
            console.warn('Background refresh failed, using cached data:', result.error);
          }
        }

        const customerData = result.data || [];
        if (customerData.length > 0) {
          setCustomers(customerData);

          // Cache the fresh data
          try {
            localStorage.setItem(CUSTOMER_CACHE_KEY, JSON.stringify({
              customers: customerData,
              timestamp: Date.now()
            }));
          } catch (e) {
            console.warn('Failed to cache customer data:', e);
          }
        }
      } catch (e: any) {
        if (customers.length === 0) {
          console.error("Failed to fetch customers from GAS:", e);
          setErrorState(`販売店情報の取得に失敗しました: ${e.message}`);
          setCustomers([]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, [customerGasUrl]); // Re-run when URL changes


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
