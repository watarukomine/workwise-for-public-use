
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

  const CUSTOMER_CACHE_KEY = 'cached_customer_data_v6'; // Incremented key to sync full 218 stores and ignore generic tasks

  const setCustomers = (data: any[]) => {
    const map = new Map<string, string>();
    data.forEach(c => {
      const code = c.userCode || c['ユーザーコード'] || '';
      if (code) {
        const padded = String(code).trim().padStart(5, '0');
        if (padded !== '00000' && padded !== '0') {
          map.set(padded, c.storeName || c['店舗'] || '');
        }
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

      // 2. Fetch fresh data from Firestore and supplement from orders
      try {
        if (customers.length === 0) {
          setIsLoading(true);
        }

        const customerData = await CustomerService.getAllCustomers();
        const { firestore } = await import('@/firebase').then(m => m.initializeFirebase());
        const { collection, getDocs } = await import('firebase/firestore');

        // Extract extra store entries from orders collection as fallback
        const ordersSnapshot = await getDocs(collection(firestore, 'orders'));
        const orderStoresMap = new Map<string, any>();
        const genericKeywords = ['移動', '業務', '休憩', '研修', '同行', '商談', '会議'];

        ordersSnapshot.docs.forEach(docSnap => {
          const o = docSnap.data();
          const docId = String(docSnap.id);
          const isGeneric = Boolean(o.isGeneric) || 
            o._type === 'task' || 
            docId.startsWith('task-') || 
            docId.startsWith('generic-') || 
            docId.startsWith('trip-temp-task-');

          if (isGeneric) return; // Skip generic tasks from customer master!

          const code = String(o.userCode || o['ユーザーコード'] || o.customerCode || '').trim();
          if (code === '00000' || code === '0') return; // Skip dummy 00000 codes

          const storeName = String(o.storeName || o['店舗名'] || o['店舗'] || o.customerName || o['顧客名'] || '').trim();
          if (storeName.startsWith('社員') || genericKeywords.includes(storeName) || storeName === '名称未設定' || storeName === '（店舗名未設定）') {
            return; // Skip internal staff/generic task names
          }

          const address = String(o.address || o['住所'] || '').trim();
          const lat = o.latitude ?? o.lat ?? o['緯度'];
          const lng = o.longitude ?? o.lng ?? o['経度'];
          const mainStore = o.mainStore || o['母店'] || '';

          if (storeName) {
            const key = code ? code : storeName;
            if (!orderStoresMap.has(key)) {
              orderStoresMap.set(key, {
                id: `order-cust-${docSnap.id}`,
                userCode: code ? code.padStart(5, '0') : '',
                storeName,
                name: storeName,
                address,
                mainStore,
                latitude: (lat !== undefined && lat !== null && !isNaN(Number(lat))) ? Number(lat) : undefined,
                longitude: (lng !== undefined && lng !== null && !isNaN(Number(lng))) ? Number(lng) : undefined,
                'ユーザーコード': code ? code.padStart(5, '0') : '',
                '店舗': storeName,
                '店舗名': storeName,
                '住所': address,
                '母店': mainStore,
              });
            }
          }
        });

        // Combine Firestore customers with extracted order stores
        const combinedMap = new Map<string, any>();

        // First add order stores
        orderStoresMap.forEach((v, k) => combinedMap.set(k, v));

        // Then overwrite with explicit customer documents
        customerData.forEach((customer: any) => {
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

          const key = normalizedCode ? normalizedCode : storeNameVal;
          combinedMap.set(key, cleansed);
        });

        const normalizedData = Array.from(combinedMap.values());

        if (normalizedData.length > 0) {
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
