
'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import type { WithId, Customer } from '@/lib/types';
import { CustomerService } from '@/services/customer-service';
import { useUser } from '@/firebase/provider';

interface CustomerContextType {
  customers: WithId<Customer>[];
  setCustomers: (customers: WithId<Customer>[]) => void;
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomersState] = useState<WithId<Customer>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setErrorState] = useState<string | null>(null);
  const { user, isUserLoading } = useUser();

  const CUSTOMER_CACHE_KEY = 'cached_customer_data_v2'; // Changed key

  const setCustomers = (data: any[]) => {
    setCustomersState(data);
  };

  const setError = (error: string | null) => {
    setErrorState(error);
  };

  useEffect(() => {
    // Guard: skip if user is not authenticated or still loading
    if (isUserLoading || !user) {
      setIsLoading(false);
      return;
    }

    const fetchCustomers = async () => {
      setErrorState(null);

      // Step 1: Load cached data immediately (optimistic)
      try {
        const cachedData = localStorage.getItem(CUSTOMER_CACHE_KEY);
        if (cachedData) {
          const { customers: cachedCustomers } = JSON.parse(cachedData);
          if (cachedCustomers && cachedCustomers.length > 0) {
            setCustomers(cachedCustomers);
            // Show UI immediately with cached data
            setIsLoading(false);
          }
        }
      } catch (e) {
        console.warn('Failed to load cached customer data:', e);
      }

      // Step 2: Fetch fresh data from Firestore
      try {
        if (customers.length === 0) {
          setIsLoading(true);
        }

        const customerData = await CustomerService.getAllCustomers();

        if (customerData.length > 0) {
          // Normalize data: Ensure userCode is 5 digits (zero-padded)
          const normalizedData = customerData.map((customer: any) => {
            const rawCode = customer['ユーザーコード'] || customer.userCode;
            // Pad to 5 digits if it looks like a number
            let normalizedCode = rawCode;
            if (rawCode !== undefined && rawCode !== null && rawCode !== '') {
              // Ensure it's treated as a string and padded
              normalizedCode = String(rawCode).trim().padStart(5, '0');
            }

            return {
              ...customer,
              userCode: normalizedCode,
              'ユーザーコード': normalizedCode,
            };
          });

          setCustomers(normalizedData);

          // Cache the fresh data
          try {
            localStorage.setItem(CUSTOMER_CACHE_KEY, JSON.stringify({
              customers: normalizedData,
              timestamp: Date.now()
            }));
          } catch (e) {
            console.warn('Failed to cache customer data:', e);
          }
        } else {
          console.log("No customers found in Firestore.");
        }
      } catch (e: any) {
        if (customers.length === 0) {
          console.error("Failed to fetch customers from Firestore:", e);
          setErrorState(`販売店情報の取得に失敗しました: ${e.message}`);
          setCustomers([]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, [user, isUserLoading]);


  const value = {
    customers,
    setCustomers,
    isLoading,
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
