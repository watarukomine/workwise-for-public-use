'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { fetchGasData } from '@/app/actions/fetch-gas-data';
import type { ScheduleEvent, Staff, WithId, Order, StaffStatus } from '@/lib/types';
import { findKey, mapRawToOrder } from '@/lib/utils';
import { addMinutes, subMinutes, parseISO, isValid, format, differenceInMinutes } from 'date-fns';
import { ORDER_GAS_URL } from '@/lib/settings';
import { useSelectedStaff, processStaffData } from './selected-staff-context';
import { logStaffNotFound, logOldDateDetected, logInvalidDate } from '@/lib/order-validation-logger';
import { useDatabase } from '@/firebase';
import { ref, onValue } from 'firebase/database';


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
  toggleTripSuppression: (tripId: string) => void;
  suppressedTripIds: Set<string>;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

const processOrderData = (rawOrdersData: any[], allStaff: WithId<Staff>[], suppressedTripIds: Set<string>) => {
  if (!rawOrdersData || !Array.isArray(rawOrdersData)) {
    return { orders: [], scheduleEvents: [], statuses: [], unassignedOrders: [] };
  }

  const orders: WithId<Order>[] = [];
  const staffStatusMap = new Map<string, StaffStatus>();
  const scheduledRawOrderIds = new Set<string>();

  // Temporary array to hold valid items for scheduling before sorting
  const explicitScheduleItems: {
    order: WithId<Order>; // The order/task object
    start: Date;
    end: Date;
    staffId: string;
    tripId: string;
    isGeneric: boolean;
    isAccompany: boolean;
  }[] = [];

  // Initialize statuses
  allStaff.forEach(sf => {
    staffStatusMap.set(sf.id, { staffId: sf.id, status: '待機中', lastAction: '情報なし' });
  });

  // --- PASS 1: Parse Data, Update Status, Collect Schedulable Items ---
  rawOrdersData.forEach((rawOrder, index) => {
    // Basic Mapping using utility - PASS STABLE FALLBACK ID (row index based)
    const mappedOrder = mapRawToOrder(rawOrder, `ord-row-${index}`);
    const order: WithId<Order> = {
      ...mappedOrder,
      id: mappedOrder.id, // mappedOrder.id is now guaranteed stable
      raw: rawOrder
    };

    const isGenericTask = order.id.startsWith('task-');

    // Filter out generic tasks from the main orders list
    if (!isGenericTask) {
      orders.push(order);
    }

    // 1. Process Staff Status
    const normalizeName = (n: any) => {
      if (typeof n !== 'string') return '';
      return n.replace(/\s+/g, '').toLowerCase();
    };

    const staffMember = order.staffName
      ? allStaff.find(s => {
        if (s.name === order.staffName) return true;
        return normalizeName(s.name) === normalizeName(order.staffName);
      })
      : undefined;

    if (staffMember) {
      const lastUpdateStr = findKey(rawOrder, ['最終更新日時']);
      if (lastUpdateStr) {
        const lastUpdate = new Date(lastUpdateStr);
        const currentStatus = staffStatusMap.get(staffMember.id)!;
        const currentUpdate = currentStatus.lastUpdate ? new Date(currentStatus.lastUpdate) : new Date(0);

        if (!isNaN(lastUpdate.getTime())) {
          const status = findKey(rawOrder, ['受注ステータス']) || '待機中';
          const actionText = order.rawOrderId ? `[${order.rawOrderId}]` : '[汎用タスク]';
          // ... (simplified status update logic for brevity if needed, but keeping full logic is safer)

          const activeStatuses = ['移動中', '移動開始', '作業中', '作業開始', '現場到着'];
          const passiveStatuses = ['未着手', '未割当', '待機中'];

          const isNewer = lastUpdate.getTime() >= currentUpdate.getTime();
          const isCandidateActive = activeStatuses.includes(status);
          const isCurrentActive = activeStatuses.includes(currentStatus.status || '');
          const isCandidatePassive = passiveStatuses.includes(status);
          const isCurrentPassive = passiveStatuses.includes(currentStatus.status || '');

          let shouldUpdate = false;
          if (isNewer) {
            if (isCandidatePassive && isCurrentActive) {
              shouldUpdate = false;
            } else {
              shouldUpdate = true;
            }
          } else {
            if (isCandidateActive && isCurrentPassive) shouldUpdate = true;
          }

          if (shouldUpdate) {
            const locationStr: string = findKey(rawOrder, ['最終位置情報（緯度,経度）', '最終位置情報(緯度,経度)', 'Location']) || '';
            let [lat, lon] = locationStr.split(',').map(s => parseFloat(s.trim()));

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

      // 2. Prepare Scheduled Event Data (Parsing)
      if (order.scheduledTime) {
        let scheduledTime: Date | null = null;
        let dateStr = order.scheduledDate;

        if (!dateStr || !isValid(parseISO(dateStr))) {
          dateStr = format(new Date(), 'yyyy-MM-dd');
        }

        // Robust Time Parsing
        try {
          const val = order.scheduledTime as any;
          if (val instanceof Date) {
            // Fix for Google Sheets time-only cells appearing as 1899/12/30
            if (val.getFullYear() < 2000) {
              const timeStr = format(val, 'HH:mm:ss');
              scheduledTime = parseISO(`${dateStr}T${timeStr}`);
            } else {
              scheduledTime = val;
            }
          } else if (typeof val === 'string') {
            // Check for old dates (1899/1900) from Google Sheets time-only cells
            if (val.includes('1899') || val.includes('1900')) {
              // Extract time from old date and combine with scheduledDate
              logOldDateDetected(order.id, order.taskDetails || '不明', 'scheduledTime', val, 'order-context');
              const oldDate = new Date(val);
              if (isValid(oldDate)) {
                const timeStr = `${String(oldDate.getHours()).padStart(2, '0')}:${String(oldDate.getMinutes()).padStart(2, '0')}:${String(oldDate.getSeconds()).padStart(2, '0')}`;
                scheduledTime = parseISO(`${dateStr}T${timeStr}`);
              }
            } else if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(val)) {
              scheduledTime = parseISO(`${dateStr}T${val}`);
            } else {
              const d = new Date(val);
              if (isValid(d)) {
                if (val.includes('/') || val.includes('-')) scheduledTime = d;
                else scheduledTime = parseISO(`${dateStr}T${format(d, 'HH:mm:ss')}`);
              } else {
                scheduledTime = parseISO(val);
              }
            }
          } else {
            // Fallback for unknown types (e.g. number timestamp)
            scheduledTime = new Date(val as any);
          }
        } catch (e) { }

        if (scheduledTime && isValid(scheduledTime)) {
          if (order.rawOrderId) scheduledRawOrderIds.add(order.rawOrderId);

          const tripId = `trip-${order.rawOrderId || order.id}`;
          let taskEndTime: Date | null = null;

          if (order.scheduledEndTime) {
            try {
              const eVal = order.scheduledEndTime as any;
              if (eVal instanceof Date) {
                if (eVal.getFullYear() < 2000) {
                  const timeStr = format(eVal, 'HH:mm:ss');
                  taskEndTime = parseISO(`${dateStr}T${timeStr}`);
                } else {
                  taskEndTime = eVal;
                }
              } else if (typeof eVal === 'string') {
                if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(eVal)) {
                  taskEndTime = parseISO(`${dateStr}T${eVal}`);
                } else {
                  const ed = new Date(eVal);
                  if (isValid(ed)) taskEndTime = ed;
                  else taskEndTime = parseISO(eVal);
                }
              }
            } catch (e) { }
          }

          if (!taskEndTime || !isValid(taskEndTime)) {
            taskEndTime = addMinutes(scheduledTime, order.estimatedDuration);
          }

          if (isValid(taskEndTime)) {
            explicitScheduleItems.push({
              order,
              start: scheduledTime,
              end: taskEndTime!,
              staffId: staffMember.id,
              tripId,
              isGeneric: isGenericTask,
              isAccompany: order.taskDetails.includes('同行')
            });
          }
        }
      }
    }
  });

  // --- PASS 2: Sort & Generate Events with Auto-Suppression ---
  const newScheduleEvents: WithId<ScheduleEvent>[] = [];

  // Group by staff
  const staffGroups = new Map<string, typeof explicitScheduleItems>();
  explicitScheduleItems.forEach(item => {
    if (!staffGroups.has(item.staffId)) staffGroups.set(item.staffId, []);
    staffGroups.get(item.staffId)!.push(item);
  });

  staffGroups.forEach((items, staffId) => {
    // Sort items by Start Time
    items.sort((a, b) => a.start.getTime() - b.start.getTime());

    let lastEndTime: Date | null = null;

    items.forEach(item => {
      // Logic for Task Event
      const taskEvent: WithId<ScheduleEvent> = {
        ...item.order,
        id: `${item.tripId}-task`,
        tripId: item.tripId,
        title: item.order.customerName || item.order.taskDetails,
        staffId: item.staffId,
        locationId: item.order.customerCode || '',
        start: item.start.toISOString(),
        end: item.end.toISOString(),
        rawOrderId: item.order.rawOrderId,
        systemId: item.order.id, // Explicitly carry the clean SystemID
      };

      // Logic for Travel Event
      // If it's a generic task and NOT accompany, no travel event is needed (usually).
      if (item.isGeneric && !item.isAccompany) {
        newScheduleEvents.push(taskEvent);
      } else {
        // Decide whether to suppress Travel
        let shouldSuppress = false;

        // Manual Suppression Check
        if (suppressedTripIds.has(item.tripId)) {
          shouldSuppress = true;
        }
        // Auto Suppression Check: "Changeover"
        // If current start is within 1 minute of last task's end, it's a consecutive task -> No travel
        else if (lastEndTime) {
          const gapMinutes = differenceInMinutes(item.start, lastEndTime);
          if (Math.abs(gapMinutes) <= 1) { // -1 to 1 min tolerance
            shouldSuppress = true;
          }
        }

        if (!shouldSuppress) {
          const travelEvent: WithId<ScheduleEvent> = {
            ...item.order,
            id: `${item.tripId}-travel`,
            tripId: item.tripId,
            title: `移動: ${item.order.customerName || item.order.taskDetails.split('\n')[0]}`,
            staffId: item.staffId,
            locationId: item.order.customerCode || '',
            start: subMinutes(item.start, TRAVEL_TIME_MINUTES).toISOString(),
            end: item.start.toISOString(),
            rawOrderId: item.order.rawOrderId,
            systemId: item.order.id, // Explicitly carry the clean SystemID
          };
          newScheduleEvents.push(travelEvent);
        }

        newScheduleEvents.push(taskEvent);
      }

      // Update lastEndTime
      lastEndTime = item.end;
    });
  });


  // 3. Determine Unassigned Orders
  const unassignedOrders = orders.filter(order => {
    // Check if already scheduled
    // Use rawOrderId if available for reliable matching, otherwise fallback to ID or SystemID
    const isAlreadyScheduled = (order.rawOrderId && scheduledRawOrderIds.has(order.rawOrderId)) ||
      newScheduleEvents.some(e => e.id === order.id || e.systemId === order.id);

    if (isAlreadyScheduled) return false;

    // If order has both staffName and scheduledTime, check if the staff actually exists
    if (order.staffName) {
      const normalizeName = (n: string | undefined) => {
        if (!n || typeof n !== 'string') return '';
        return n.replace(/\s+/g, '').toLowerCase();
      };

      const staffExists = allStaff.find(s => {
        if (!s.name) return false;
        if (s.name === order.staffName) return true;
        return normalizeName(s.name) === normalizeName(order.staffName);
      });

      // If staff doesn't exist in master, treat as unassigned (keep in list)
      if (!staffExists) {
        logStaffNotFound(order.id, order.taskDetails || '不明', order.staffName || '', 'order-context');
        return true;
      }

      // If staff exists, but it wasn't added to scheduleEvents (e.g. invalid time), it should be here.
      // Since we already returned false for isAlreadyScheduled, we just return true here.
      return true;
    }

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
  const [suppressedTripIds, setSuppressedTripIds] = useState<Set<string>>(new Set());
  const { allStaff, isStaffLoading, setAllStaff } = useSelectedStaff();
  const [rawOrdersData, setRawOrdersData] = useState<any[]>([]);
  const [orderGasUrl, setOrderGasUrlState] = useState(ORDER_GAS_URL);
  const ORDERS_CACHE_KEY = 'cached_orders_results';

  useEffect(() => {
    try {
      const savedUrl = localStorage.getItem('custom_order_gas_url');
      if (savedUrl) setOrderGasUrlState(savedUrl);

      const savedSuppressed = localStorage.getItem('suppressed_trip_ids');
      if (savedSuppressed) {
        setSuppressedTripIds(new Set(JSON.parse(savedSuppressed)));
      }
    } catch (e) {
      console.warn('Failed to load saved settings:', e);
    }
  }, []);

  const toggleTripSuppression = useCallback((tripId: string) => {
    setSuppressedTripIds(prev => {
      const next = new Set(prev);
      if (next.has(tripId)) {
        next.delete(tripId);
      } else {
        next.add(tripId);
      }
      try {
        localStorage.setItem('suppressed_trip_ids', JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error("Failed to save suppressed trip IDs", e);
      }
      return next;
    });
  }, []);

  const setOrderGasUrl = (url: string) => {
    setOrderGasUrlState(url);
    try {
      localStorage.setItem('custom_order_gas_url', url);
    } catch (e) {
      console.error("Failed to save GAS URL", e);
    }
  };

  // 1. Initial Cache Load
  useEffect(() => {
    try {
      const cached = localStorage.getItem(ORDERS_CACHE_KEY);
      if (cached) {
        const { orders, timestamp } = JSON.parse(cached);
        if (orders && Array.isArray(orders)) {
          console.log(`[OrderProvider] Initial cache load: ${orders.length} items`);
          setRawOrdersData(orders);
          // If we have cache, treat as loaded (Optimistic)
          setIsLoading(false);
        }
      }
    } catch (e) {
      console.warn("Failed to load orders cache", e);
    }
  }, []);

  const fetchAndProcessData = useCallback(async (isBackground = false) => {
    // Only show loader if we have NO data yet
    if (!isBackground && rawOrdersData.length === 0) setIsLoading(true);
    setErrorState(null);

    try {
      const result = await fetchGasData(orderGasUrl) as any;
      if (result.error) throw new Error(result.error);

      // Support consolidated response format: { orders, staff } OR legacy array
      const orders = result.orders || result.data || result;

      if (Array.isArray(orders)) {
        setRawOrdersData(orders);

        // Cache data
        try {
          localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify({
            orders: orders,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn("Failed to cache orders results", e);
        }

        // 統合されたスタッフデータがあれば更新
        if (result.staff && Array.isArray(result.staff)) {
          console.log(`[OrderProvider] Consolidated staff data received: ${result.staff.length} items`);
          const processedStaff = processStaffData(result.staff);
          if (processedStaff.length > 0) {
            setAllStaff(processedStaff);
          }
        }
      } else {
        throw new Error("Invalid data format received from GAS");
      }
    } catch (e: any) {
      setErrorState(e.message);
      console.error("Fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [orderGasUrl, rawOrdersData.length, setAllStaff]);

  // 1.5 Real-time Signal Listener
  const database = useDatabase();
  useEffect(() => {
    if (!database) return;

    console.log('[OrderProvider] Setting up real-time signal listener');
    const signalRef = ref(database, 'signals/orders_updated');

    // Listen for changes to the signal
    const unsubscribe = onValue(signalRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        console.log('[OrderProvider] Real-time signal received:', data);
        // Trigger a background fetch
        fetchAndProcessData(true);
      }
    });

    return () => unsubscribe();
  }, [database, fetchAndProcessData]);

  // 2. Fetch data on mount and interval
  useEffect(() => {
    fetchAndProcessData();
    const interval = setInterval(() => fetchAndProcessData(true), 60000); // Poll every 1 min
    return () => clearInterval(interval);
  }, [fetchAndProcessData]);

  const saveLocalEvent = (event: WithId<ScheduleEvent>) => {
    setLocalScheduleEvents(prev => {
      const idx = prev.findIndex(e => e.id === event.id);
      let next;
      if (idx >= 0) {
        next = [...prev];
        next[idx] = event;
      } else {
        next = [...prev, event];
      }
      return next;
    });
  };

  const deleteLocalEvent = (eventId: string) => {
    setLocalScheduleEvents(prev => prev.filter(e => e.id !== eventId));
  };

  // Process data when raw data or staff changes
  useEffect(() => {
    console.log(`[OrderProvider] Processing. rawOrders: ${rawOrdersData?.length}, isLoading: ${isLoading}, allStaff: ${allStaff?.length}`);

    if (isLoading && !rawOrdersData.length) return; // Wait if loading initial

    try {
      const { orders, scheduleEvents: backendEvents, statuses, unassignedOrders } = processOrderData(rawOrdersData, allStaff, suppressedTripIds);
      console.log(`[OrderProvider] Processed: ${orders.length} orders, ${backendEvents.length} events, ${unassignedOrders.length} unassigned.`);

      setOrders(orders);

      const localIds = new Set(localScheduleEvents.map(e => e.id));
      const filteredBackendEvents = backendEvents.filter(e => !localIds.has(e.id));

      setScheduleEvents([...filteredBackendEvents, ...localScheduleEvents.filter(e => e.staffId !== '__DELETED__')]);
      setStatuses(statuses);

      const localUnassignedEvents = localScheduleEvents.filter(e => !e.staffId && e.rawOrderId);
      const localAssignedOrderIds = new Set(
        localScheduleEvents
          .filter(e => e.staffId && e.rawOrderId)
          .map(e => String(e.rawOrderId))
      );

      let finalUnassignedOrders = unassignedOrders.filter(o => {
        if (o.rawOrderId && localAssignedOrderIds.has(o.rawOrderId)) return false;
        if (localIds.has(o.id)) return false;
        return true;
      });

      if (localUnassignedEvents.length > 0) {
        const existingIds = new Set(finalUnassignedOrders.map(o => String(o.id)));
        const existingRawIds = new Set(finalUnassignedOrders.map(o => String(o.rawOrderId)).filter(Boolean));

        const localOrders = localUnassignedEvents
          .filter(e => e.raw)
          .map(e => mapRawToOrder(e.raw, String(e.rawOrderId || e.id)))
          .filter(o => {
            if (existingIds.has(String(o.id))) return false;
            if (o.rawOrderId && existingRawIds.has(String(o.rawOrderId))) return false;
            return true;
          });

        finalUnassignedOrders = [...finalUnassignedOrders, ...localOrders];
      }
      setUnassignedOrders(finalUnassignedOrders);
    } catch (e) {
      console.error("Error processing orders:", e);
    }
  }, [rawOrdersData, allStaff, localScheduleEvents, suppressedTripIds, isLoading]);

  const value: OrderContextType = {
    orders,
    unassignedOrders,
    setUnassignedOrders,
    scheduleEvents,
    setScheduleEvents,
    statuses,
    loadOrders: async () => { },
    syncOrders: async () => { await fetchAndProcessData(false); },
    isLoading,
    isSyncingOrders: isLoading,
    error,
    saveLocalEvent,
    deleteLocalEvent,
    refetchOrders: async () => { await fetchAndProcessData(true); },
    rawOrdersData,
    orderGasUrl,
    setOrderGasUrl,
    toggleTripSuppression,
    suppressedTripIds
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
