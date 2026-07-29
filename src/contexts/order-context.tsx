'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import type { ScheduleEvent, Staff, WithId, Order, StaffStatus } from '@/lib/types';
import { findKey, mapRawToOrder, normalizeDateStr, formatTime } from '@/lib/utils';
import { addMinutes, subMinutes, parseISO, isValid, format, differenceInMinutes } from 'date-fns';
import { ORDER_GAS_URL } from '@/lib/settings';
import { useSelectedStaff } from './selected-staff-context';
import { useUserProfile } from '@/hooks/use-user-profile';
import { OrderService } from '@/services/order-service';


const TRAVEL_TIME_MINUTES = 30;



interface OrderContextType {
  orders: WithId<Order>[];
  unassignedOrders: WithId<Order>[];
  setUnassignedOrders: React.Dispatch<React.SetStateAction<WithId<Order>[]>>;
  scheduleEvents: WithId<ScheduleEvent>[];
  setScheduleEvents: React.Dispatch<React.SetStateAction<WithId<ScheduleEvent>[]>>;
  statuses: StaffStatus[];
  loadOrders: (date: Date) => Promise<void>;
  loadRange: (date: Date, range: number) => Promise<void>;
  syncOrders: () => Promise<void>;
  isLoading: boolean;
  isSyncingOrders: boolean;
  error: string | null;
  saveLocalEvent: (event: WithId<ScheduleEvent>) => void;
  deleteLocalEvent: (eventId: string) => void;
  deleteOrder: (id: string) => Promise<void>;
  refetchOrders: () => Promise<void>;
  rawOrdersData: WithId<Order>[];
  orderGasUrl: string;
  setOrderGasUrl: (url: string) => void;
  toggleTripSuppression: (tripId: string) => void;
  suppressedTripIds: Set<string>;
  currentViewedDate: Date | null;
  setCurrentViewedDate: (date: Date | null) => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

const processOrderData = (
  rawOrdersData: any[],
  allStaff: WithId<Staff>[],
  suppressedTripIds: Set<string>,
  targetDate?: Date | string | null
) => {
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

  // Pre-build normalized staff map for instant O(1) lookup (avoids 90,000+ inner loops)
  const staffMapByName = new Map<string, WithId<Staff>>();
  const staffBySurname = new Map<string, WithId<Staff>>();

  allStaff.forEach(sf => {
    if (sf.name) {
      const rawName = sf.name.trim();
      staffMapByName.set(rawName, sf);
      
      const norm = rawName.replace(/\s+/g, '').toLowerCase();
      staffMapByName.set(norm, sf);

      // Extract surname (first word or 2+ chars)
      const surname = rawName.split(/[\s　]+/)[0];
      if (surname) {
        staffBySurname.set(surname, sf);
        staffBySurname.set(surname.toLowerCase(), sf);
      }
    }
  });

  // Initialize statuses with staff user document fields
  const activeStatuses = ['移動中', '移動開始', '作業中', '作業開始', '現場到着', '帰社中'];
  const passiveStatuses = ['未着手', '未割当', '待機中'];

  const targetDateStr = targetDate ? (typeof targetDate === 'string' ? normalizeDateStr(targetDate) : format(targetDate, 'yyyy-MM-dd')) : format(new Date(), 'yyyy-MM-dd');

  // --- PASS 1: Parse Data, Update Status, Collect Schedulable Items ---
  rawOrdersData.forEach((rawOrder, index) => {
    const mappedOrder = mapRawToOrder(rawOrder, `ord-row-${index}`);
    const order: WithId<Order> = {
      ...mappedOrder,
      id: mappedOrder.id,
      raw: rawOrder
    };

    const isGenericTask = order.id.startsWith('task-');

    if (!isGenericTask) {
      orders.push(order);
    }

    const staffNameStr = order.staffName ? String(order.staffName).trim() : '';
    let staffMember: WithId<Staff> | undefined = undefined;
    if (staffNameStr) {
      const norm = staffNameStr.replace(/\s+/g, '').toLowerCase();
      // O(1) Instant Lookup - No slow array scanning inside loops!
      staffMember = staffMapByName.get(staffNameStr) || staffMapByName.get(norm) || staffBySurname.get(staffNameStr) || staffBySurname.get(norm);
    }

    // RESCUE LOGIC: If staffName exists (e.g., 'DEMO1', deleted/unknown staff) but does not match any active staff member,
    // normalize staffName to empty so it safely appears in the unassigned orders list for reassignment!
    if (staffNameStr && !staffMember) {
      order.staffName = '';
      if (order.status !== 'キャンセル' && order.status !== '作業完了' && order.status !== '完了') {
        order.status = '未割当';
      }
    }

    if (staffMember) {
      // Ensure staffStatusMap entry exists before accessing
      if (!staffStatusMap.has(staffMember.id)) {
        staffStatusMap.set(staffMember.id, {
          staffId: staffMember.id,
          status: '待機中',
          lastAction: '',
          lastUpdate: new Date(0).toISOString(),
        });
      }
      const lastUpdateStr = order.updatedAt || findKey(rawOrder, ['最終更新日時']);
      const lastUpdate = lastUpdateStr ? new Date(lastUpdateStr) : new Date();
      const currentStatus = staffStatusMap.get(staffMember.id)!;
      const currentUpdate = currentStatus.lastUpdate ? new Date(currentStatus.lastUpdate) : new Date(0);

      if (!isNaN(lastUpdate.getTime())) {
        const status = order.status || findKey(rawOrder, ['受注ステータス']) || '待機中';
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
            let lat = order.latitude !== undefined && order.latitude !== null ? parseFloat(String(order.latitude)) : NaN;
            let lon = order.longitude !== undefined && order.longitude !== null ? parseFloat(String(order.longitude)) : NaN;
            
            if (isNaN(lat) || isNaN(lon)) {
                const locationStr: string = findKey(rawOrder, ['最終位置情報（緯度,経度）', '最終位置情報(緯度,経度)', 'Location']) || '';
                const parts = locationStr.split(',').map(s => parseFloat(s.trim()));
                lat = parts[0];
                lon = parts[1];
            }

            staffStatusMap.set(staffMember.id, {
                staffId: staffMember.id,
                status: status,
                lastAction: `[受注] ${status}`,
                latitude: !isNaN(lat) ? lat : undefined,
                longitude: !isNaN(lon) ? lon : undefined,
                lastUpdate: lastUpdate.toISOString(),
                estimatedArrivalTime: order.estimatedArrivalTime,
                nextDestination: order.nextDestination,
            });
        }
      }

      if (order.scheduledTime) {
        // CRITICAL FIX: Only display events on timeline if order scheduledDate matches current viewed targetDateStr
        const normOrderDate = normalizeDateStr(order.scheduledDate);
        if (normOrderDate && targetDateStr && normOrderDate !== targetDateStr) {
          return; // Skip orders from other dates from appearing on today's timeline!
        }

        let scheduledTime: Date | null = null;
        let dateStr = order.scheduledDate;

        if (!dateStr || !isValid(parseISO(dateStr))) {
          dateStr = format(new Date(), 'yyyy-MM-dd');
        }

        try {
          const val = String(order.scheduledTime).trim();
          if (val) {
            const formattedTime = formatTime(val);
            if (formattedTime && formattedTime.includes(':')) {
              const parsed = parseISO(`${dateStr}T${formattedTime}:00`);
              if (isValid(parsed)) {
                scheduledTime = parsed;
              }
            }
          }
        } catch {
          scheduledTime = null;
        }

        if (scheduledTime && isValid(scheduledTime)) {
          let taskEndTime: Date | null = null;
          if (order.scheduledEndTime) {
            try {
              const endFormatted = formatTime(order.scheduledEndTime);
              if (endFormatted && endFormatted.includes(':')) {
                taskEndTime = parseISO(`${dateStr}T${endFormatted}:00`);
              }
            } catch {
              taskEndTime = null;
            }
          }

          if (!taskEndTime || !isValid(taskEndTime)) {
            taskEndTime = addMinutes(scheduledTime, order.estimatedDuration || 60);
          }

          if (isValid(taskEndTime)) {
            if (order.rawOrderId) scheduledRawOrderIds.add(order.rawOrderId);

            const tripId = `trip-${order.rawOrderId || order.id}`;
            explicitScheduleItems.push({
              order,
              start: scheduledTime,
              end: taskEndTime!,
              staffId: staffMember.id,
              tripId,
              isGeneric: isGenericTask,
              isAccompany: String(order.taskDetails || '').includes('同行')
            });
          }
        }
      }
    }
  });

  // --- PASS 2: Sort & Generate Events with Auto-Suppression ---
  const newScheduleEvents: WithId<ScheduleEvent>[] = [];

  const staffGroups = new Map<string, typeof explicitScheduleItems>();
  explicitScheduleItems.forEach(item => {
    if (!staffGroups.has(item.staffId)) staffGroups.set(item.staffId, []);
    staffGroups.get(item.staffId)!.push(item);
  });

  staffGroups.forEach((items, staffId) => {
    items.sort((a, b) => a.start.getTime() - b.start.getTime());

    let lastEndTime: Date | null = null;

    items.forEach(item => {
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
        systemId: item.order.id,
      };

      if (item.isGeneric && !item.isAccompany) {
        newScheduleEvents.push(taskEvent);
      } else {
        let shouldSuppress = false; // Default: ALWAYS show travel event before assigned task!

        if (lastEndTime) {
          const gapMinutes = differenceInMinutes(item.start, lastEndTime);
          // Only suppress travel chip if current task starts less than 15 minutes after previous task finished
          if (gapMinutes >= 0 && gapMinutes < 15) {
            shouldSuppress = true;
          }
        }

        if (!shouldSuppress && !suppressedTripIds.has(item.tripId)) {
          const travelEvent: WithId<ScheduleEvent> = {
            ...item.order,
            id: `${item.tripId}-travel`,
            tripId: item.tripId,
            title: '移動',
            staffId: item.staffId,
            locationId: item.order.customerCode || '',
            start: subMinutes(item.start, TRAVEL_TIME_MINUTES).toISOString(),
            end: item.start.toISOString(),
            rawOrderId: item.order.rawOrderId,
            systemId: item.order.id,
          };
          newScheduleEvents.push(travelEvent);
        }

        newScheduleEvents.push(taskEvent);
      }

      lastEndTime = item.end;
    });
  });

  // 3. Determine Unassigned Orders for Current Viewed Date
  const unassignedOrders = orders.filter(order => {
    if (order.isGeneric) return false;

    // Filter out completed or cancelled orders
    const status = String(order.status || (order as any)['受注ステータス'] || '').trim();
    if (['作業完了', '完了', 'キャンセル', '完了済', '作業終了'].includes(status)) {
      return false;
    }

    // Filter out test/guest submissions
    const cCode = String(order.customerCode || (order as any).userCode || '').trim();
    if (cCode === 'guest') {
      return false;
    }

    // Filter to match current viewed date (targetDateStr) for dashboard unassigned tasks
    if (order.scheduledDate) {
      const normOrderDate = normalizeDateStr(order.scheduledDate);
      const normTargetDate = normalizeDateStr(targetDateStr);
      if (normOrderDate && normTargetDate && normOrderDate !== normTargetDate) {
        return false;
      }
    }

    // Check if already scheduled on timeline
    const isAlreadyScheduled = (order.rawOrderId && scheduledRawOrderIds.has(order.rawOrderId)) ||
      newScheduleEvents.some(e => e.id === order.id || e.systemId === order.id);

    if (isAlreadyScheduled) return false;

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
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const [rawOrdersData, setRawOrdersData] = useState<any[]>([]);
  const [orderGasUrl, setOrderGasUrlState] = useState(ORDER_GAS_URL);
  const [fetchedDateRanges, setFetchedDateRanges] = useState<Map<string, number>>(new Map()); // Use Map for timestamp-based cache
  const [currentViewedDate, setCurrentViewedDate] = useState<Date | null>(null);
  const currentViewedDateRef = React.useRef<Date | null>(null);
  const fetchedDateRangesRef = React.useRef(fetchedDateRanges);
  const ORDERS_CACHE_KEY = 'cached_orders_results';

  useEffect(() => {
    currentViewedDateRef.current = currentViewedDate;
  }, [currentViewedDate]);

  useEffect(() => {
    fetchedDateRangesRef.current = fetchedDateRanges;
  }, [fetchedDateRanges]);

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

  // Background Auto-Recovery Sync Worker (Ensures 100% GAS sync reliability)
  useEffect(() => {
    OrderService.syncUnsyncedOrders().catch(err => {
      console.warn('[OrderProvider] Auto syncUnsyncedOrders error:', err);
    });

    const interval = setInterval(() => {
      OrderService.syncUnsyncedOrders().catch(err => {
        console.warn('[OrderProvider] Auto syncUnsyncedOrders periodic error:', err);
      });
    }, 180000);

    return () => clearInterval(interval);
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

  const fetchAndProcessData = useCallback(async (isBackground = false, params?: { date?: string; range?: number; ordersOnly?: boolean }) => {
    // Only show loader if we have NO data yet AND it's not a background fetch
    const isInitialLoad = rawOrdersData.length === 0;
    if (!isBackground && isInitialLoad) setIsLoading(true);
    setErrorState(null);

    try {
      const targetDateStr = params?.date || new Date().toISOString().split('T')[0];
      console.log(`[OrderProvider] Fetching data from Firestore for date: ${targetDateStr}`);
      
      // 1. Fetch from Firestore instead of GAS
      const firestoreOrders = await OrderService.getOrdersByDate(targetDateStr);

      setRawOrdersData(prev => {
        const orderMap = new Map();
        const normTarget = normalizeDateStr(targetDateStr);
        
        // Keep non-target date orders
        prev.forEach(o => {
          const normO = normalizeDateStr(o.scheduledDate);
          if (normO !== normTarget) {
            const id = o.id || o.systemId;
            if (id) orderMap.set(id, o);
          }
        });

        // Update/Add with new data
        firestoreOrders.forEach(o => {
          const id = o.id || o.systemId;
          if (id) orderMap.set(id, o);
        });

        return Array.from(orderMap.values());
      });

      // Record this date range as fetched with timestamp
      setFetchedDateRanges(prev => {
        const next = new Map(prev);
        next.set(targetDateStr, Date.now());
        return next;
      });

    } catch (e: any) {
      setErrorState(e.message);
      console.error("Fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Realtime subscription setup for all orders
  useEffect(() => {
    if (isProfileLoading || !profile) return;

    console.log(`[OrderProvider] Subscribing to ALL Firestore orders in real-time...`);
    const unsubscribeAll = OrderService.subscribeAllOrders((allOrders, removedIds) => {
      setRawOrdersData(prev => {
        const orderMap = new Map();
        // Keep existing data as base
        prev.forEach(o => {
          const id = o.id || o.systemId;
          if (id) orderMap.set(id, o);
        });
        // Explicitly delete documents removed from Firestore
        if (removedIds && removedIds.length > 0) {
          removedIds.forEach(id => orderMap.delete(id));
        }
        // Update/overwrite with fresh data from subscription
        allOrders.forEach(o => {
          const id = o.id || o.systemId;
          if (id) orderMap.set(id, o);
        });
        return Array.from(orderMap.values());
      });
      setIsLoading(false);
    });

    return () => {
      unsubscribeAll();
    };
  }, [profile, isProfileLoading]);

  // Handle Viewed Date Subscription and Loading immediately on change
  useEffect(() => {
    if (isProfileLoading || !profile || !currentViewedDate) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const viewedDateStr = currentViewedDate.toISOString().split('T')[0];

    if (viewedDateStr === todayStr) return;

    // Direct fetch only if not already loaded into rawOrdersData
    const normViewed = normalizeDateStr(viewedDateStr);
    const hasDataForDate = rawOrdersData.some(o => normalizeDateStr(o.scheduledDate) === normViewed);

    if (!hasDataForDate) {
      console.log(`[OrderProvider] Non-blocking fetch for viewed date: ${viewedDateStr}`);
      OrderService.getOrdersByDate(viewedDateStr).then(directOrders => {
        if (directOrders && directOrders.length > 0) {
          setRawOrdersData(prev => {
            const orderMap = new Map();
            prev.forEach(o => {
              const id = o.id || o.systemId;
              if (id) orderMap.set(id, o);
            });
            directOrders.forEach(o => {
              const id = o.id || o.systemId;
              if (id) orderMap.set(id, o);
            });
            return Array.from(orderMap.values());
          });
        }
      }).catch(err => console.warn('Direct fetch for viewed date failed:', err));
    }
  }, [profile, isProfileLoading, currentViewedDate, rawOrdersData]);

  const saveLocalEvent = useCallback((event: WithId<ScheduleEvent>) => {
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
  }, []);

  const deleteLocalEvent = useCallback((eventId: string) => {
    setLocalScheduleEvents(prev => prev.filter(e => e.id !== eventId));
  }, []);

  // Process data using useMemo for high performance & 0-lag rendering
  const processedData = React.useMemo(() => {
    if (!rawOrdersData || !rawOrdersData.length) {
      return { orders: [], scheduleEvents: [], statuses: [], unassignedOrders: [] };
    }
    return processOrderData(rawOrdersData, allStaff, suppressedTripIds, currentViewedDate);
  }, [rawOrdersData, allStaff, suppressedTripIds, currentViewedDate]);

  useEffect(() => {
    setOrders(processedData.orders);
    
    const localIds = new Set(localScheduleEvents.map(e => e.id));
    const filteredBackendEvents = processedData.scheduleEvents.filter(e => !localIds.has(e.id));
    setScheduleEvents([...filteredBackendEvents, ...localScheduleEvents.filter(e => e.staffId !== '__DELETED__')]);
    setStatuses(processedData.statuses);

    const localAssignedOrderIds = new Set(
      localScheduleEvents
        .filter(e => e.staffId && e.staffId !== '__DELETED__')
        .map(e => e.rawOrderId || e.id)
    );

    const finalUnassigned = processedData.unassignedOrders.filter(o => !localAssignedOrderIds.has(o.rawOrderId || o.id));
    setUnassignedOrders(finalUnassigned);

    try {
      localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify({ orders: rawOrdersData, timestamp: Date.now() }));
    } catch (e) { /* quota exceeded - ignore */ }
  }, [processedData, localScheduleEvents, rawOrdersData]);

  const deleteOrder = useCallback(async (id: string) => {
    // 1. Primary delete from Firestore
    await OrderService.deleteOrder(id);

    // 2. Remove immediately from rawOrdersData
    setRawOrdersData(prev => prev.filter(o => o.id !== id && o.systemId !== id));

    // 3. Remove immediately from localScheduleEvents
    deleteLocalEvent(id);
    deleteLocalEvent(`${id}-travel`);
    deleteLocalEvent(`${id}-task`);
  }, [deleteLocalEvent]);

  const loadOrders = useCallback(async (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const lastFetched = fetchedDateRangesRef.current.get(dateStr);
    const isStale = lastFetched ? (Date.now() - lastFetched > 120000) : true; // Cache for 2 mins

    if (!isStale) {
      console.log(`[OrderProvider] Date ${dateStr} in cache, instant load.`);
      return;
    }
    console.log(`[OrderProvider] Non-blocking background fetch for date: ${dateStr}`);
    fetchAndProcessData(false, { date: dateStr, range: 1 }).catch(err => {
      console.warn(`[OrderProvider] Background fetch error for ${dateStr}:`, err);
    });
  }, [fetchAndProcessData]);

  const syncOrders = useCallback(async () => {
    await fetchAndProcessData(false);
  }, [fetchAndProcessData]);

  const refetchOrders = useCallback(async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    await fetchAndProcessData(true, { date: todayStr, range: 3 });
    
    const viewedDate = currentViewedDateRef.current;
    if (viewedDate) {
      const diffDays = Math.abs(differenceInMinutes(viewedDate, new Date()) / (60 * 24));
      if (diffDays > 3) {
        const viewedDateStr = viewedDate.toISOString().split('T')[0];
        await fetchAndProcessData(true, { date: viewedDateStr, range: 1 });
      }
    }
  }, [fetchAndProcessData]);

  const loadRange = useCallback(async (date: Date, range: number) => {
    const dateStr = date.toISOString().split('T')[0];
    console.log(`[OrderProvider] Loading wider range data for: ${dateStr}, range: ${range}`);
    await fetchAndProcessData(true, { date: dateStr, range });
  }, [fetchAndProcessData]);

  const value: OrderContextType = React.useMemo(() => ({
    orders,
    unassignedOrders,
    setUnassignedOrders,
    scheduleEvents,
    setScheduleEvents,
    statuses,
    loadOrders,
    syncOrders,
    isLoading,
    isSyncingOrders: isLoading,
    error,
    saveLocalEvent,
    deleteLocalEvent,
    deleteOrder,
    refetchOrders,
    loadRange,
    rawOrdersData,
    orderGasUrl,
    setOrderGasUrl,
    toggleTripSuppression,
    suppressedTripIds,
    currentViewedDate,
    setCurrentViewedDate
  }), [
    orders,
    unassignedOrders,
    scheduleEvents,
    statuses,
    loadOrders,
    syncOrders,
    isLoading,
    error,
    saveLocalEvent,
    deleteLocalEvent,
    deleteOrder,
    refetchOrders,
    loadRange,
    rawOrdersData,
    orderGasUrl,
    setOrderGasUrl,
    toggleTripSuppression,
    suppressedTripIds,
    currentViewedDate,
    setCurrentViewedDate
  ]);

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
