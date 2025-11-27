'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { fetchGasData } from '@/app/actions/fetch-gas-data';
import { ORDER_GAS_URL } from '@/lib/settings';
import type { Order, ScheduleEvent, StaffStatus, WithId } from '@/lib/types';
import { mapRawToOrder } from '@/lib/utils';
import { addMinutes, subMinutes, parseISO, isValid } from 'date-fns';
import { useSelectedStaff } from './selected-staff-context';

const TRAVEL_TIME_MINUTES = 30;

interface OrderContextType {
  rawOrdersData: any[];
  setOrders: React.Dispatch<React.SetStateAction<any[]>>;
  unassignedOrders: WithId<Order>[];
  setUnassignedOrders: React.Dispatch<React.SetStateAction<WithId<Order>[]>>;
  scheduleEvents: WithId<ScheduleEvent>[];
  setScheduleEvents: React.Dispatch<React.SetStateAction<WithId<ScheduleEvent>[]>>;
  statuses: StaffStatus[];
  refetchOrders: () => Promise<void>;
  isLoading: boolean;
  orderGasUrl: string;
  setOrderGasUrl: (url: string) => void;
  error: string | null;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: ReactNode }) {
  const [rawOrdersData, setOrders] = useState<any[]>([]);
  const [unassignedOrders, setUnassignedOrders] = useState<WithId<Order>[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<WithId<ScheduleEvent>[]>([]);
  const [statuses, setStatuses] = useState<StaffStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orderGasUrl, setOrderGasUrlState] = useState(ORDER_GAS_URL);
  const [error, setErrorState] = useState<string | null>(null);
  const { allStaff, isLoading: isStaffLoading } = useSelectedStaff();

  const setOrderGasUrl = (url: string) => {
    setOrderGasUrlState(url);
  };
  
  const fetchAndProcessData = useCallback(async () => {
    if (!orderGasUrl) {
      setErrorState('GASのURLが設定されていません。');
      setIsLoading(false);
      return;
    }
    
    if (isStaffLoading) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await fetchGasData(orderGasUrl);
      if (result.error && result.message) throw new Error(result.message);
      
      const newRawOrderData = result.data || (Array.isArray(result) ? result : []);
      
      const newScheduleEvents: WithId<ScheduleEvent>[] = [];
      const newUnassignedOrders: WithId<Order>[] = [];
      const staffStatusMap = new Map<string, StaffStatus>();

      allStaff.forEach(sf => {
          staffStatusMap.set(sf.id, {
              staffId: sf.id,
              status: '待機中',
              lastAction: '情報なし',
          });
      });

      if (allStaff.length > 0) {
        newRawOrderData.forEach((rawOrder: any) => {
          const mappedOrder = mapRawToOrder(rawOrder);
          const staffName = mappedOrder.staffName;
          const staffMember = staffName ? allStaff.find(s => s.name === staffName) : undefined;
          const scheduledTimeStr = mappedOrder.scheduledTime;
          
          let isAssigned = false;
          if (staffMember && scheduledTimeStr) {
            try {
              const scheduledTime = parseISO(scheduledTimeStr);

              if (isValid(scheduledTime)) {
                  const tripId = `trip-${mappedOrder.rawOrderId}`;

                  const taskEvent: WithId<ScheduleEvent> = {
                      ...mappedOrder,
                      id: `${tripId}-task`,
                      tripId,
                      orderId: mappedOrder.id,
                      title: mappedOrder.taskDetails,
                      staffId: staffMember.id,
                      locationId: mappedOrder.customerCode || '',
                      start: scheduledTime.toISOString(),
                      end: addMinutes(scheduledTime, mappedOrder.estimatedDuration).toISOString(),
                  };

                  const travelEvent: WithId<ScheduleEvent> = {
                      ...mappedOrder,
                      id: `${tripId}-travel`,
                      tripId,
                      orderId: mappedOrder.id,
                      title: `移動: ${mappedOrder.customerName || mappedOrder.taskDetails.split('\n')[0]}`,
                      staffId: staffMember.id,
                      locationId: mappedOrder.customerCode || '',
                      start: subMinutes(scheduledTime, TRAVEL_TIME_MINUTES).toISOString(),
                      end: scheduledTime.toISOString(),
                  };
                  newScheduleEvents.push(travelEvent, taskEvent);
                  isAssigned = true;
              }
            } catch(e) {
              console.error("Error parsing schedule time for order:", mappedOrder.id, e);
            }
          }
          
          if (!isAssigned) {
              newUnassignedOrders.push(mappedOrder);
          }
          
          // Status update logic here
        });
      }
      
      setErrorState(null);
      setOrders(newRawOrderData);
      setScheduleEvents(newScheduleEvents);
      setUnassignedOrders(newUnassignedOrders);
      setStatuses(Array.from(staffStatusMap.values()));

    } catch (e: any) {
      console.error("Failed to fetch or process order data from GAS:", e);
      setErrorState(`受注データの取得または処理に失敗しました: ${e.message}`);
      if (!rawOrdersData || rawOrdersData.length === 0) {
        setOrders([]);
        setUnassignedOrders([]);
        setScheduleEvents([]);
        setStatuses([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [orderGasUrl, allStaff, isStaffLoading, rawOrdersData]);


  useEffect(() => {
    if (!isStaffLoading) {
      fetchAndProcessData();
    }
  }, [fetchAndProcessData, isStaffLoading]);

  const value = {
    rawOrdersData,
    setOrders,
    unassignedOrders,
    setUnassignedOrders,
    scheduleEvents,
    setScheduleEvents,
    statuses,
    refetchOrders: fetchAndProcessData,
    isLoading,
    orderGasUrl,
    setOrderGasUrl,
    error,
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
