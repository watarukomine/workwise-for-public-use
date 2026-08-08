
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

  const CUSTOMER_CACHE_KEY = 'cached_customer_data_v3'; // Incremented key to clear stale cache

  const setCustomers = (data: any[]) => {
    const map = new Map<string, string>();
    data.forEach(c => {
      const code = c.userCode || c['ユーザーコード'] || '';
      if (code) {
        map.set(String(code).trim().padStart(5, '0'), c.storeName || c['店舗'] || '');
      }
    });
    (data as any)._mapByCode = map;
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

      // 1. Try to load cached data first for instant render
      try {
        const cachedData = localStorage.getItem(CUSTOMER_CACHE_KEY);
        if (cachedData) {
          const { customers: cachedCustomers } = JSON.parse(cachedData);
          if (cachedCustomers && cachedCustomers.length > 0) {
            setCustomers(cachedCustomers);
          }
        }
      } catch (e) {
        console.warn('Failed to load cached customer data:', e);
      }

      // 2. Fetch fresh data from Firestore
      try {
        if (customers.length === 0) {
          setIsLoading(true);
        }

        const customerData = await CustomerService.getAllCustomers();

        if (customerData.length > 0) {
          // Normalize and Cleanse data: Ensure userCode is 5 digits and unify all property keys
          const normalizedData = customerData.map((customer: any) => {
            const rawCode = customer['ユーザーコード'] || customer.userCode || '';
            let normalizedCode = rawCode;
            if (rawCode !== '') {
              normalizedCode = String(rawCode).trim().padStart(5, '0');
            }

            const storeNameVal = customer.storeName || customer['店舗'] || customer['店舗名'] || customer['販売店名'] || customer['顧客名'] || customer.name || '';
            const addressVal = customer.address || customer['住所'] || '';
            
            const latVal = customer.latitude !== undefined ? customer.latitude : (customer['緯度'] !== undefined ? Number(customer['緯度']) : undefined);
            const lngVal = customer.longitude !== undefined ? customer.longitude : (customer['経度'] !== undefined ? Number(customer['経度']) : undefined);
            
            const mainStoreVal = customer.mainStore || customer['母店'] || '';

            const cleansed: any = {
              ...customer,
              userCode: normalizedCode,
              storeName: storeNameVal,
              name: storeNameVal,
              address: addressVal,
              mainStore: mainStoreVal,
              'ユーザーコード': normalizedCode,
              '店舗': storeNameVal,
              '店舗名': storeNameVal,
              '住所': addressVal,
              '母店': mainStoreVal,
            };

            if (latVal !== undefined && !isNaN(latVal)) {
              cleansed.latitude = latVal;
              cleansed['緯度'] = latVal;
            }
            if (lngVal !== undefined && !isNaN(lngVal)) {
              cleansed.longitude = lngVal;
              cleansed['経度'] = lngVal;
            }

            return cleansed;
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
