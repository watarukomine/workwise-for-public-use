'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { fetchGasData } from '@/app/actions/fetch-gas-data';
import type { ScheduleEvent, Staff, WithId, Order, StaffStatus } from '@/lib/types';
import { findKey, mapRawToOrder } from '@/lib/utils';
import { addMinutes, subMinutes, parseISO, isValid, format } from 'date-fns';
import { useSelectedStaff } from './selected-staff-context';
import { ORDER_GAS_URL } from '@/lib/settings';


const TRAVEL_TIME_MINUTES = 30;

interface OrderContextType {
  orders: WithId<Order>[];
  unassignedOrders: WithId<Order>[];
  setUnassignedOrders: React.Dispatch<React.SetStateAction<WithId<Order>[]>>;
  scheduleEvents: WithId<ScheduleEvent>[];
  setScheduleEvents: React.Dispatch<React.SetStateAction<WithId<ScheduleEvent>[]>>;
  statuses: StaffStatus[];
  loadOrders: (date: Date) => Promise<void>;
  syncOrders: () => Promise<void>;
  isLoading: boolean;
  isSyncingOrders: boolean;
  error: string | null;
  saveLocalEvent: (event: WithId<ScheduleEvent>) => void;
  deleteLocalEvent: (eventId: string) => void;
  refetchOrders: () => Promise<void>;
  rawOrdersData: WithId<Order>[];
  orderGasUrl: string;
  setOrderGasUrl: (url: string) => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

const processOrderData = (rawOrdersData: any[], allStaff: WithId<Staff>[]) => {
  if (!rawOrdersData || !Array.isArray(rawOrdersData) || !allStaff.length) {
    return { orders: [], scheduleEvents: [], statuses: [], unassignedOrders: [] };
  }

  const orders: WithId<Order>[] = [];
  const newScheduleEvents: WithId<ScheduleEvent>[] = [];
  const staffStatusMap = new Map<string, StaffStatus>();

  // Initialize statuses
  allStaff.forEach(sf => {
    staffStatusMap.set(sf.id, { staffId: sf.id, status: '待機中', lastAction: '情報なし' });
  });

  const scheduledRawOrderIds = new Set<string>();

  rawOrdersData.forEach((rawOrder, index) => {
    // Basic Mapping using utility
    const mappedOrder = mapRawToOrder(rawOrder);
    const order: WithId<Order> = {
      ...mappedOrder,
      id: mappedOrder.id || `order-${index}`, // Ensure ID
      raw: rawOrder
    };

    orders.push(order);

    // 1. Process Staff Status
    // Improve matching: Normalize by removing spaces and lowercasing
    const normalizeName = (n: any) => {
      if (typeof n !== 'string') return '';
      return n.replace(/\s+/g, '').toLowerCase();
    };

    const staffMember = order.staffName
      ? allStaff.find(s => {
        // Try exact match first for performance/safety
        if (s.name === order.staffName) return true;
        // Try normalized match
        return normalizeName(s.name) === normalizeName(order.staffName);
      })
      : undefined;

    // Debug Log
    if (order.status === '移動中' || order.status === '移動開始') {
      console.log('DEBUG: Found Moving Order', {
        orderId: order.id,
        staffName: order.staffName,
        matchedStaff: !!staffMember,
        allStaffCount: allStaff.length,
        rawLastUpdate: findKey(rawOrder, ['最終更新日時']),
        rawLocation: findKey(rawOrder, ['最終位置情報（緯度,経度）', '最終位置情報(緯度,経度)', 'Location']),
        rawStatus: findKey(rawOrder, ['受注ステータス']),
      });
    }

    if (staffMember) {
      const lastUpdateStr = findKey(rawOrder, ['最終更新日時']);
      if (lastUpdateStr) {
        const lastUpdate = new Date(lastUpdateStr);
        const currentStatus = staffStatusMap.get(staffMember.id)!;
        const currentUpdate = currentStatus.lastUpdate ? new Date(currentStatus.lastUpdate) : new Date(0);

        if (!isNaN(lastUpdate.getTime())) {
          // Priority Logic: Active statuses should persist over newer Passive statuses
          // And older Active statuses should restore over current Passive statuses
          const activeStatuses = ['移動中', '移動開始', '作業中', '作業開始', '現場到着'];
          const passiveStatuses = ['未着手', '未割当', '待機中'];

          const isNewer = lastUpdate.getTime() >= currentUpdate.getTime();
          const isCandidateActive = activeStatuses.includes(status);
          const isCurrentActive = activeStatuses.includes(currentStatus.status || '');
          const isCandidatePassive = passiveStatuses.includes(status);
          const isCurrentPassive = passiveStatuses.includes(currentStatus.status || '');

          let shouldUpdate = false;

          if (isNewer) {
            // New data is newer
            if (isCandidatePassive && isCurrentActive) {
              // Ignore newer passive if we have active
              console.log(`DEBUG: Ignoring newer passive status '${status}' (${lastUpdateStr}) for active staff ${staffMember.name} (Current: ${currentStatus.status})`);
              shouldUpdate = false;
            } else {
              shouldUpdate = true; // Normal case: newer wins
            }
          } else {
            // New data is OLDER (or same)
            if (isCandidateActive && isCurrentPassive) {
              // Restore older active if current is merely passive
              console.log(`DEBUG: Restoring older active status '${status}' (${lastUpdateStr}) over passive staff ${staffMember.name} (Current: ${currentStatus.status})`);
              shouldUpdate = true;
            } else {
              shouldUpdate = false; // Normal case: older loses
            }
          }

          if (shouldUpdate) {
            const locationStr: string = findKey(rawOrder, ['最終位置情報（緯度,経度）', '最終位置情報(緯度,経度)', 'Location']) || '';
            let [lat, lon] = locationStr.split(',').map(s => parseFloat(s.trim()));

            // Location Persistence: If new location is invalid, keep existing valid location
            // (Only if existing location is valid number)
            if ((isNaN(lat) || isNaN(lon)) && currentStatus.latitude && currentStatus.longitude) {
              lat = currentStatus.latitude;
              lon = currentStatus.longitude;
            }

            staffStatusMap.set(staffMember.id, {
              staffId: staffMember.id,
              status: status,
              lastAction: `${actionText} ${status}`,
              latitude: !isNaN(lat) ? lat : undefined,
              longitude: !isNaN(lon) ? lon : undefined,
              lastUpdate: lastUpdate.toISOString(),
            });
          }
        }
      }
    }

    // 2. Process Scheduled Events
    if (staffMember && order.scheduledTime) {
      let scheduledTime: Date | null = null;
      let dateStr = order.scheduledDate;

      // Ensure dateStr is valid YYYY-MM-DD
      if (!dateStr || !isValid(parseISO(dateStr))) {
        // If date is missing in mapped order, try to parse from raw or use Today?
        // For direct fetch, we might rely on 'scheduledTime' containing date if it's ISO?
        // Or fallback to today.
        dateStr = format(new Date(), 'yyyy-MM-dd');
      }

      try {
        if (/^\d{1,2}:\d{2}$/.test(order.scheduledTime)) {
          scheduledTime = parseISO(`${dateStr}T${order.scheduledTime}`);
        } else {
          // Try standard Date parsing for "yyyy/MM/dd HH:mm:ss" which parseISO dislikes
          const timeComponent = new Date(order.scheduledTime);
          if (isValid(timeComponent)) {
            // If it has full date info, use it directly (prioritize the "Shotgun" payload we sent)
            if (order.scheduledTime.includes('/') || order.scheduledTime.includes('-')) {
              scheduledTime = timeComponent;
            } else {
              // Time only (1899 base)
              const timeStr = format(timeComponent, 'HH:mm:ss');
              scheduledTime = parseISO(`${dateStr}T${timeStr}`);
            }
          } else {
            // Fallback to ISO
            scheduledTime = parseISO(order.scheduledTime);
          }
        }
      } catch (e) { }

      if (scheduledTime && isValid(scheduledTime)) {
        if (order.rawOrderId) scheduledRawOrderIds.add(order.rawOrderId);

        const tripId = `trip-${order.rawOrderId || order.id}`;
        let taskEndTime: Date;

        if (order.scheduledEndTime) {
          if (/^\d{1,2}:\d{2}$/.test(order.scheduledEndTime)) {
            taskEndTime = parseISO(`${dateStr}T${order.scheduledEndTime}`);
          } else {
            // Use new Date() for flexible parsing
            taskEndTime = new Date(order.scheduledEndTime);
            if (!isValid(taskEndTime)) {
              taskEndTime = parseISO(order.scheduledEndTime);
            }
          }
        } else {
          taskEndTime = addMinutes(scheduledTime, order.estimatedDuration);
        }

        if (isValid(taskEndTime)) {
          const taskEvent: WithId<ScheduleEvent> = {
            ...order,
            id: `${tripId}-task`,
            tripId,
            title: order.taskDetails,
            staffId: staffMember.id,
            locationId: order.customerCode || '',
            start: scheduledTime.toISOString(),
            end: taskEndTime.toISOString(),
            rawOrderId: order.rawOrderId,
          };

          const travelEvent: WithId<ScheduleEvent> = {
            ...order,
            id: `${tripId}-travel`,
            tripId,
            title: `移動: ${order.customerName || order.taskDetails.split('\n')[0]}`,
            staffId: staffMember.id,
            locationId: order.customerCode || '',
            start: subMinutes(scheduledTime, TRAVEL_TIME_MINUTES).toISOString(),
            end: scheduledTime.toISOString(),
            rawOrderId: order.rawOrderId,
          };

          newScheduleEvents.push(travelEvent, taskEvent);
        }
      }
    }
  });

  // 3. Determine Unassigned Orders
  const unassignedOrders = orders.filter(order => {
    const hasRawOrderId = !!order.rawOrderId;
    const isAlreadyScheduled = order.rawOrderId ? scheduledRawOrderIds.has(order.rawOrderId) : false;
    if (!hasRawOrderId || isAlreadyScheduled) return false;
    if (order.staffName && order.scheduledTime) return false;
    // Show undated or dated-but-unassigned
    return true;
  });

  return {
    orders,
    scheduleEvents: newScheduleEvents,
    statuses: Array.from(staffStatusMap.values()),
    unassignedOrders
  };
};

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<WithId<Order>[]>([]);
  const [unassignedOrders, setUnassignedOrders] = useState<WithId<Order>[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<WithId<ScheduleEvent>[]>([]);
  const [statuses, setStatuses] = useState<StaffStatus[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingOrders, setIsSyncingOrders] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);

  const [localScheduleEvents, setLocalScheduleEvents] = useState<WithId<ScheduleEvent>[]>([]);
  const { allStaff, isStaffLoading } = useSelectedStaff();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const [orderGasUrl, setOrderGasUrlState] = useState(ORDER_GAS_URL);

  useEffect(() => {
    try {
      const savedUrl = localStorage.getItem('custom_order_gas_url');
      if (savedUrl) {
        setOrderGasUrlState(savedUrl);
      }
    } catch (e) {
      console.warn('Failed to load saved order GAS URL:', e);
    }
  }, []);

  const setOrderGasUrl = useCallback((url: string) => {
    setOrderGasUrlState(url);
    try {
      localStorage.setItem('custom_order_gas_url', url);
    } catch (e) {
      console.warn('Failed to save order GAS URL:', e);
    }
  }, []);

  // Load local events
  useEffect(() => {
    try {
      const saved = localStorage.getItem('local_schedule_events');
      if (saved) setLocalScheduleEvents(JSON.parse(saved));
    } catch (e) {
      console.warn('Failed to load local schedule events:', e);
    }
  }, []);

  const saveLocalEvent = useCallback((event: WithId<ScheduleEvent>) => {
    setLocalScheduleEvents(prev => {
      const exists = prev.some(e => e.id === event.id);
      let newEvents;
      if (exists) {
        newEvents = prev.map(e => e.id === event.id ? event : e);
      } else {
        newEvents = [...prev, event];
      }
      try {
        localStorage.setItem('local_schedule_events', JSON.stringify(newEvents));
      } catch (e) {
        console.error('Failed to save local event:', e);
      }
      return newEvents;
    });
  }, []);

  const deleteLocalEvent = useCallback((eventId: string) => {
    setLocalScheduleEvents(prev => {
      const newEvents = prev.filter(e => e.id !== eventId);
      try {
        localStorage.setItem('local_schedule_events', JSON.stringify(newEvents));
      } catch (e) {
        console.error('Failed to save local event:', e);
      }
      return newEvents;
    });
  }, []);

  /* Removed loadOrders and syncOrders/date params */
  const [rawOrdersData, setRawOrdersData] = useState<any[]>([]);

  const fetchAndProcessData = useCallback(async (showLoading = true) => {
    // Use state orderGasUrl
    if (!orderGasUrl) {
      setErrorState('GASのURLが設定されていません。');
      if (showLoading) setIsLoading(false);
      return;
    }

    if (showLoading) setIsLoading(true);
    setErrorState(null);

    try {
      const result = await fetchGasData(orderGasUrl);
      if (result.error && result.message) throw new Error(result.message);

      const newRaw = result.data || (Array.isArray(result) ? result : []);
      setRawOrdersData(newRaw);
    } catch (e: any) {
      console.error("Failed to fetch from GAS:", e);
      setErrorState(`受注データ取得エラー: ${e.message}`);
      setRawOrdersData([]);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [orderGasUrl]);

  // Initial Fetch
  useEffect(() => {
    fetchAndProcessData(true);
  }, [fetchAndProcessData]);

  // Process data when raw data or staff changes
  useEffect(() => {
    // Logic to process raw data into orders/events
    if (isLoading && !rawOrdersData.length) return; // Wait if loading initial

    try {
      // We need processOrderData to handle raw objects
      const { orders, scheduleEvents: backendEvents, statuses, unassignedOrders } = processOrderData(rawOrdersData, allStaff);

      setOrders(orders);
      setScheduleEvents([...backendEvents, ...localScheduleEvents]);
      setStatuses(statuses);
      setUnassignedOrders(unassignedOrders);
    } catch (e) {
      console.error("Error processing orders:", e);
    }

  }, [rawOrdersData, allStaff, localScheduleEvents]);

  const value: OrderContextType = {
    orders,
    unassignedOrders,
    setUnassignedOrders,
    scheduleEvents,
    setScheduleEvents,
    statuses,
    // Compat stubs for interface (although we should update interface too, but for speed just stub)
    loadOrders: async () => { },
    syncOrders: async () => { await fetchAndProcessData(false); },
    isLoading,
    isSyncingOrders: isLoading, // map to loading
    error,
    saveLocalEvent,
    deleteLocalEvent,
    refetchOrders: async () => { await fetchAndProcessData(false); }, // force refetch
    rawOrdersData,
    orderGasUrl: orderGasUrl || ORDER_GAS_URL,
    setOrderGasUrl
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
