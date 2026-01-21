'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { fetchGasData } from '@/app/actions/fetch-gas-data';
import type { ScheduleEvent, Staff, WithId, Order, StaffStatus } from '@/lib/types';
import { findKey, mapRawToOrder } from '@/lib/utils';
import { addMinutes, subMinutes, parseISO, isValid, format, differenceInMinutes } from 'date-fns';
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
  toggleTripSuppression: (tripId: string) => void;
  suppressedTripIds: Set<string>;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

const processOrderData = (rawOrdersData: any[], allStaff: WithId<Staff>[], suppressedTripIds: Set<string>) => {
  if (!rawOrdersData || !Array.isArray(rawOrdersData)) {
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
    // Basic Mapping using utility - PASS STABLE FALLBACK ID (row index based)
    // This prevents IDs from changing on every background refresh if data lacks SystemID
    const mappedOrder = mapRawToOrder(rawOrder, `ord-row-${index}`);
    const order: WithId<Order> = {
      ...mappedOrder,
      id: mappedOrder.id, // mappedOrder.id is now guaranteed stable
      raw: rawOrder
    };

    // Filter out generic tasks from the main orders list
    // Generic tasks (created on timeline) should only appear as events, not as "Orders" in the table
    if (!order.id.startsWith('task-')) {
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
            if (isCandidateActive && isCurrentPassive) {
              shouldUpdate = true;
            } else {
              shouldUpdate = false;
            }
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
    }

    // 2. Process Scheduled Events
    // 2. Process Scheduled Events (Sorted by Timeline for Auto-Travel Suppression)
    // Avoid processing if no staffMember is found (though allStaff check implies it)
    if (!staffMember) return;

    const staffOrders = orders.filter(o => o.staffId === staffMember.id);

    // Parse times first
    const parsedOrders = staffOrders.map(order => {
      let scheduledTime: Date | null = null;
      let dateStr = order.scheduledDate;

      if (!dateStr || !isValid(parseISO(dateStr))) {
        dateStr = format(new Date(), 'yyyy-MM-dd');
      }

      const val = order.scheduledTime;
      try {
        // Handle various time formats (String HH:mm, ISO string, or Date object)
        if (typeof val === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(val)) {
          scheduledTime = parseISO(`${dateStr}T${val}`);
        } else {
          // Use 'any' to allow Date object which matches original behavior
          const timeComponent = new Date(val as any);
          if (isValid(timeComponent)) {
            const valStr = String(val);
            if (valStr.includes('/') || valStr.includes('-')) {
              scheduledTime = timeComponent;
            } else {
              const timeStr = format(timeComponent, 'HH:mm:ss');
              scheduledTime = parseISO(`${dateStr}T${timeStr}`);
            }
          } else {
            if (typeof val === 'string') {
              scheduledTime = parseISO(val);
            }
          }
        }
      } catch (e) { }

      if (scheduledTime && isValid(scheduledTime)) {
        if (order.rawOrderId) scheduledRawOrderIds.add(order.rawOrderId);

        let taskEndTime: Date | null = null;
        if (order.scheduledEndTime) {
          try {
            if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(order.scheduledEndTime)) {
              taskEndTime = parseISO(`${dateStr}T${order.scheduledEndTime}`);
            } else {
              taskEndTime = new Date(order.scheduledEndTime);
              if (!isValid(taskEndTime)) taskEndTime = parseISO(order.scheduledEndTime);
            }
          } catch (e) { taskEndTime = addMinutes(scheduledTime, order.estimatedDuration); }
        }

        if (!taskEndTime || !isValid(taskEndTime)) {
          taskEndTime = addMinutes(scheduledTime, order.estimatedDuration);
        }

        return { order, start: scheduledTime, end: taskEndTime as Date };
      }
      return null;
    }).filter((item): item is { order: Order, start: Date, end: Date } => item !== null);

    // Sort by Start Time
    parsedOrders.sort((a, b) => a.start.getTime() - b.start.getTime());

    let lastEndTime: Date | null = null;

    parsedOrders.forEach(({ order, start, end }) => {
      const tripId = `trip-${order.rawOrderId || order.id}`;

      const taskEvent: WithId<ScheduleEvent> = {
        ...order,
        id: `${tripId}-task`,
        tripId,
        title: order.taskDetails,
        staffId: staffMember.id,
        locationId: order.customerCode || '',
        start: start.toISOString(),
        end: end.toISOString(),
        rawOrderId: order.rawOrderId,
      };

      const isGenericTask = order.id.startsWith('task-');
      const isAccompany = order.taskDetails.includes('同行');

      let shouldGenerateTravel = true;
      if (isGenericTask && !isAccompany) {
        shouldGenerateTravel = false;
      } else {
        // Check for suppression (Manual OR Auto)
        if (suppressedTripIds.has(tripId)) {
          shouldGenerateTravel = false;
        } else if (lastEndTime) {
          // Auto-Suppression: If Start Time is within 1 minute of Previous End Time
          const diffMinutes = Math.abs(differenceInMinutes(start, lastEndTime));
          if (diffMinutes <= 1) {
            shouldGenerateTravel = false;
          }
        }
      }

      if (shouldGenerateTravel) {
        const travelEvent: WithId<ScheduleEvent> = {
          ...order,
          id: `${tripId}-travel`,
          tripId,
          title: `移動: ${order.customerName || order.taskDetails.split('\n')[0]}`,
          staffId: staffMember.id,
          locationId: order.customerCode || '',
          start: subMinutes(start, TRAVEL_TIME_MINUTES).toISOString(),
          end: start.toISOString(),
          rawOrderId: order.rawOrderId,
        };
        newScheduleEvents.push(travelEvent);
      }

      newScheduleEvents.push(taskEvent);
      lastEndTime = end;
    });
  });

  // 3. Determine Unassigned Orders
  const unassignedOrders = orders.filter(order => {
    const hasRawOrderId = !!order.rawOrderId;
    const isAlreadyScheduled = order.rawOrderId ? scheduledRawOrderIds.has(order.rawOrderId) : false;
    const isGenericTask = !order.customerCode && ['業務', '休憩', '移動', '研修', '同行', '商談'].some(t => order.taskDetails.includes(t));

    if (!hasRawOrderId || isAlreadyScheduled || isGenericTask) return false;
    if (order.staffName && order.scheduledTime) return false;
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
  const [suppressedTripIds, setSuppressedTripIds] = useState<Set<string>>(new Set()); // New state
  const { allStaff, isStaffLoading } = useSelectedStaff();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const [orderGasUrl, setOrderGasUrlState] = useState(ORDER_GAS_URL);

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

  const [rawOrdersData, setRawOrdersData] = useState<any[]>([]);

  const setOrderGasUrl = (url: string) => {
    setOrderGasUrlState(url);
    try {
      localStorage.setItem('custom_order_gas_url', url);
    } catch (e) {
      console.error("Failed to save GAS URL", e);
    }
  };

  const fetchAndProcessData = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    setErrorState(null);

    try {
      const result = await fetchGasData(orderGasUrl);
      if (result.error) throw new Error(result.error);

      const orders = result.data || result;
      if (Array.isArray(orders)) {
        setRawOrdersData(orders);
      } else {
        throw new Error("Invalid data format");
      }
    } catch (e: any) {
      setErrorState(e.message);
      console.error("Fetch error:", e);
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, [orderGasUrl]);

  useEffect(() => {
    fetchAndProcessData();
    const interval = setInterval(() => fetchAndProcessData(true), 60000 * 5); // Poll every 5 mins
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
    // Logic to process raw data into orders/events
    console.log(`[OrderProvider] Processing. rawOrders: ${rawOrdersData?.length}, isLoading: ${isLoading}, allStaff: ${allStaff?.length}`);

    if (isLoading && !rawOrdersData.length) return; // Wait if loading initial

    try {
      // We need processOrderData to handle raw objects
      console.log('[OrderProvider] Calling processOrderData...');
      const { orders, scheduleEvents: backendEvents, statuses, unassignedOrders } = processOrderData(rawOrdersData, allStaff, suppressedTripIds);
      console.log(`[OrderProvider] Processed: ${orders.length} orders, ${backendEvents.length} events, ${unassignedOrders.length} unassigned.`);

      setOrders(orders);

      // Merge: backend events + local events. If an event is in local (optimistic), use that instead of backend.
      const localIds = new Set(localScheduleEvents.map(e => e.id));
      const filteredBackendEvents = backendEvents.filter(e => !localIds.has(e.id));

      setScheduleEvents([...filteredBackendEvents, ...localScheduleEvents.filter(e => e.staffId !== '__DELETED__')]);
      setStatuses(statuses);

      // Merge local unassigned events into unassignedOrders
      // This ensures that if we optimistically unassign a task (staffId=''), it appears in the unassigned list
      // even if the backend still thinks it's assigned.
      // Merge local unassigned events into unassignedOrders
      // This ensures that if we optimistically unassign a task (staffId=''), it appears in the unassigned list
      // even if the backend still thinks it's assigned.
      const localUnassignedEvents = localScheduleEvents.filter(e => !e.staffId && e.rawOrderId);

      // Also, we must REMOVE from unassignedOrders any order that is LOCALLY ASSIGNED
      // (i.e. present in localScheduleEvents with a staffId)
      // This fixes the issue where an assigned task reverts to unassigned because backend is stale.
      // Defensively map and filter to avoid crashes if rawOrderId is missing
      const localAssignedOrderIds = new Set(
        localScheduleEvents
          .filter(e => e.staffId && e.rawOrderId) // Locally assigned
          .map(e => String(e.rawOrderId)) // Make sure it's a string
      );

      let finalUnassignedOrders = unassignedOrders.filter(o => {
        // If this order ID is in our local "assigned" list, do not show it as unassigned

        // Check 1: Match by rawOrderId (preferred)
        if (o.rawOrderId && localAssignedOrderIds.has(o.rawOrderId)) return false;

        // Check 2: Match by exact ID (fallback for valid stable IDs)
        // This handles cases where rawOrderId is missing but ID is stable
        if (localIds.has(o.id)) return false;

        return true;
      });

      if (localUnassignedEvents.length > 0) {
        // Normalize IDs to strings for comparison
        const existingIds = new Set(finalUnassignedOrders.map(o => String(o.id)));
        const existingRawIds = new Set(finalUnassignedOrders.map(o => String(o.rawOrderId)).filter(Boolean));

        // Defensively map local events, ensuring 'raw' data exists to avoid "ghost" empty orders
        const localOrders = localUnassignedEvents
          .filter(e => e.raw) // CRITICAL: Only map if raw data exists
          // Use rawOrderId as prefered fallback to match backend ID calculation
          .map(e => mapRawToOrder(e.raw, String(e.rawOrderId || e.id)))
          .filter(o => {
            // Check by ID (Normalize to string)
            if (existingIds.has(String(o.id))) return false;
            // Check by Raw Order ID (Normalize to string)
            if (o.rawOrderId && existingRawIds.has(String(o.rawOrderId))) return false;
            return true;
          });

        finalUnassignedOrders = [...finalUnassignedOrders, ...localOrders];
      }
      setUnassignedOrders(finalUnassignedOrders);
    } catch (e) {
      console.error("Error processing orders:", e);
    }
  }, [rawOrdersData, allStaff, localScheduleEvents, suppressedTripIds]);

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
    refetchOrders: async () => { await fetchAndProcessData(true); }, // Background fetch to suppress loading spinner
    rawOrdersData,
    orderGasUrl: orderGasUrl || ORDER_GAS_URL,
    setOrderGasUrl,
    toggleTripSuppression, // New
    suppressedTripIds // New
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
