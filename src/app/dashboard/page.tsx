'use client';
import * as React from 'react';
import { mapRawToOrder } from '../../lib/utils';
import { ScheduleView } from '../../components/dashboard/schedule-view';
import { Staff, StaffStatus, WithId } from '../../lib/types';
import { useSelectedStaff } from '../../contexts/selected-staff-context';
import { useUserProfile } from '../../hooks/use-user-profile';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { AlertCircle, Loader2, ChevronLeft, ChevronRight, Smartphone, RefreshCw, Database } from 'lucide-react';
import { useCustomer } from '../../contexts/customer-context';
import { Button } from '../../components/ui/button';
import { useOrder } from '../../contexts/order-context';
import { format, isToday, addDays, subDays, parseISO, isValid, isEqual, startOfDay, startOfToday, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useIsMobile } from '../../hooks/use-mobile';
import { VerticalScheduleView } from '../../components/dashboard/vertical-schedule-view';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { useAppShell } from '../../components/app-shell';
import { ShareOrderFormModal } from '../../components/dashboard/share-order-form-modal';
import Link from 'next/link';
import { ExternalLink, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Calendar } from '../../components/ui/calendar';


import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { getDailyAttendance, saveDailyAttendance, getDailyAttendanceDetails } from '../../services/attendance-service';
import { AttendanceControls } from '../../components/dashboard/attendance-controls';
import { STORE_ORDER } from '../../lib/constants';
import { useToast } from '../../hooks/use-toast';



export default function DashboardPage() {
  const [currentDate, setCurrentDate] = React.useState(startOfToday());
  const router = useRouter();
  const isMobile = useIsMobile();
  const { forceMobileView, setForceMobileView, adminWantsTimelineView } = useAppShell();

  const {
    statuses,
    isLoading: isLoadingOrders,
    scheduleEvents,
    loadOrders,
    syncOrders,
    isSyncingOrders,
    refetchOrders,
    rawOrdersData,
    orders
  } = useOrder();

  const counts = React.useMemo(() => {
    if (!rawOrdersData || !orders) return { total: 0, displayed: 0, hidden: 0 };

    const dateStr = format(currentDate, 'yyyy-MM-dd');

    // Normalize and Filter raw data using mapRawToOrder
    const dayOrders = rawOrdersData
      .map((raw, idx) => mapRawToOrder(raw, `check-${idx}`))
      .filter(o => {
        // Filter out empty rows
        if (!o.customerCode && !o.customerName && !o.taskDetails) return false;

        // Check scheduledDate
        if (o.scheduledDate === dateStr) return true;

        // Check scheduledTime (handles fixed 1899 dates too)
        // The prioritization for scheduledTime is handled within mapRawToOrder,
        // using "チップ配置作業予定" before "予定時間". (v1.1.5)
        if ((o.scheduledTime as any) instanceof Date) {
          if (isSameDay((o.scheduledTime as any), currentDate)) return true;
        } else if (typeof o.scheduledTime === 'string') {
          if (o.scheduledTime.startsWith(dateStr)) return true;
          const d = parseISO(o.scheduledTime);
          if (isValid(d) && isSameDay(d, currentDate)) return true;
        }
        return false;
      });

    // Count displayed orders
    const displayedOrders = dayOrders.filter(o => {
      return orders.some(displayed =>
        displayed.id === o.id ||
        (displayed.rawOrderId && displayed.rawOrderId === o.rawOrderId) ||
        // Fallback for ID matching
        (displayed.rawOrderId && displayed.rawOrderId === o.id)
      );
    });

    const hiddenDetails = dayOrders
      .filter(o => !orders.some(displayed =>
        displayed.id === o.id ||
        (displayed.rawOrderId && displayed.rawOrderId === o.rawOrderId) ||
        (displayed.rawOrderId && displayed.rawOrderId === o.id)
      ))
      .map(o => `${o.rawOrderId || o.id} ${o.customerName}`.trim());

    return {
      total: dayOrders.length,
      displayed: displayedOrders.length,
      hidden: dayOrders.length - displayedOrders.length,
      hiddenItems: hiddenDetails
    };
  }, [rawOrdersData, orders, currentDate]);

  const { isLoading: isLoadingCustomers } = useCustomer();
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { allStaff, appliedSelectedStaffIds, setSelectedStaffIds, isLoading: isStaffLoading } = useSelectedStaff();
  const [checkedOutStaffIds, setCheckedOutStaffIds] = useState<Set<string>>(new Set());
  const [presentStaffIds, setPresentStaffIds] = useState<Set<string>>(new Set());
  const [scheduledStaffIds, setScheduledStaffIds] = useState<Set<string>>(new Set());
  const isDateLoading = useRef(false);
  const [isSyncing, setIsSyncing] = useState(true); // Add syncing state, default true for initial load
  const { toast } = useToast();

  useEffect(() => {
    if (!isProfileLoading && !profile) {
      router.push('/login');
    }
  }, [isProfileLoading, profile, router]);

  const [showManagement, setShowManagement] = React.useState(true); // Default to showing all

  const filteredStaff = React.useMemo(() => {
    if (isProfileLoading || isStaffLoading || !profile) return [];

    const staffToUse = allStaff;

    let selectedStaff: WithId<Staff>[];

    if (appliedSelectedStaffIds.length === 0) {
      selectedStaff = staffToUse;
    } else {
      const selectedIds = new Set(appliedSelectedStaffIds);
      selectedStaff = staffToUse.filter(staff => selectedIds.has(staff.id));
    }

    // Filter by Management/Controller visibility
    if (!showManagement) {
      selectedStaff = selectedStaff.filter(staff => {
        const isController = staff['コントローラー'] === '⚪︎' || staff.controller === '⚪︎';
        const isAdmin = staff.role === 'admin';
        return !isController && !isAdmin;
      });
    }

    return selectedStaff; // Return in original order (Sheet order)

  }, [appliedSelectedStaffIds, profile, isProfileLoading, allStaff, isStaffLoading, showManagement]);

  const selectedStaffNames = React.useMemo(() => {
    if (appliedSelectedStaffIds.length === 0) {
      return null;
    }
    const staffToUse = allStaff;
    if (appliedSelectedStaffIds.length === staffToUse.length) {
      return "全スタッフ";
    }
    const selectedStaff = staffToUse.filter(s => appliedSelectedStaffIds.includes(s.id));
    return selectedStaff.map(s => s.name).join('、');
  }, [allStaff, appliedSelectedStaffIds, profile]);

  const isLoading = isProfileLoading || isLoadingOrders || isStaffLoading || isLoadingCustomers;

  console.log('Dashboard Loading States:', {
    profile: isProfileLoading,
    orders: isLoadingOrders,
    staff: isStaffLoading,
    customers: isLoadingCustomers,
    syncing: isSyncing,
    total: isLoading
  });

  const handleDateChange = (direction: 'next' | 'prev' | 'today' | number) => {
    setIsSyncing(true);
    setCurrentDate(current => {
      if (direction === 'today' || direction === 0) return startOfToday();
      if (typeof direction === 'number') return addDays(current, direction);
      return direction === 'next' ? addDays(current, 1) : subDays(current, 1);
    });
  };

  // Sync attendance when date changes
  const lastSyncedDate = useRef<Date | null>(null);

  useEffect(() => {
    const syncAttendance = async () => {
      // Determine if we are mounting (Refresh) or switching dates
      // If lastSyncedDate is null, this is the first sync (Mount/Refresh).
      const isMount = lastSyncedDate.current === null;
      // Real Date Switch: We were already synced to a date, and now current is different.
      const isRealDateSwitch = lastSyncedDate.current !== null && !isSameDay(currentDate, lastSyncedDate.current);

      const isDateChange = isMount || isRealDateSwitch;

      if (isDateChange) {
        // Only trigger loading UI for actual date changes or initial mount
        if (isRealDateSwitch) {
          isDateLoading.current = true;
          setIsSyncing(true);
        }
        lastSyncedDate.current = currentDate;

        // Clear cached statuses when date changes
        setCheckedOutStaffIds(new Set());
      }

      // 0. Identify staff with orders for this day
      // (This logic remains synonymous for both mount and switch)
      const staffWithOrders = new Set<string>();
      if (scheduleEvents) {
        scheduleEvents.forEach(event => {
          const eventStart = typeof event.start === 'string' ? parseISO(event.start) : event.start;
          if (isValid(eventStart) && (isToday(eventStart) ? isToday(currentDate) : isEqual(startOfDay(eventStart), startOfDay(currentDate)))) {
            if (event.staffId && event.staffId !== 'unassigned') {
              staffWithOrders.add(event.staffId);
            }
          }
        });
      }

      if (profile?.role !== 'admin' && profile) {
        const userOrders = scheduleEvents.filter(e => e.staffId === profile.id);
        if (userOrders.length > 0) {
          staffWithOrders.add(profile.id);
        }
      }

      // OPTIMISTIC UPDATE
      // If It's a Real Date Switch: Reset to Order-Based immediately.
      // If Mount (Reload) or Same Day Update (Background Poll): DO NOT RESET.
      if (isRealDateSwitch) {
        if (staffWithOrders.size > 0) {
          setSelectedStaffIds(Array.from(staffWithOrders));
        }
      }

      try {
        // 1. Fetch explicitly attended staff from Firestore with details
        const { staffIds: attendedStaffIds, checkedOutIds = [], scheduledStaffIds: scheduledIds = [] } = await getDailyAttendanceDetails(currentDate);
        setCheckedOutStaffIds(new Set(checkedOutIds));
        setPresentStaffIds(new Set(attendedStaffIds));
        setScheduledStaffIds(new Set(scheduledIds));

        // 3. Merge lists
        const combinedStaffIds = Array.from(new Set([...attendedStaffIds, ...scheduledStaffIds, ...Array.from(staffWithOrders)]));

        if (combinedStaffIds.length > 0) {
          if (isRealDateSwitch) {
            // On Real Date Switch: Force set to new day's attendance
            setSelectedStaffIds(combinedStaffIds);
          } else {
            // On Mount/Refresh OR Same Day Update (Background Poll):
            // MERGE with existing selection to preserve localStorage state or manual changes
            setSelectedStaffIds(prev => Array.from(new Set([...prev, ...combinedStaffIds])));
          }
        } else if (isRealDateSwitch) {
          // If switching date and no staff found, CLEAR the selection
          setSelectedStaffIds([]);
        }
      } catch (e) {
        console.error("Failed to sync attendance:", e);
      } finally {
        if (isDateChange) {
          isDateLoading.current = false;
          setIsSyncing(false);
          
          // CRITICAL: Fetch additional data for this date if not already in context
          // This enables lazy-loading for PC dashboard speed-up
          loadOrders(currentDate);
        }
      }
    };
    syncAttendance();
  }, [currentDate, setSelectedStaffIds, scheduleEvents, loadOrders]);

  // Selection state is persisted in localStorage via SelectedStaffContext.
  // We NO LONGER auto-save selection to "saveDailyAttendance" (Database) 
  // because that field (staffIds) represents "Clocked In", not "Viewed".
  // Visibility is purely local + Shift Schedule + Clocked In status.

  // Calculate Derived Statuses
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);

  useEffect(() => {
    const intervalId = setInterval(async () => {
      setIsAutoRefreshing(true);
      await refetchOrders();
      setIsAutoRefreshing(false);
    }, 60000); // 1 minute

    return () => clearInterval(intervalId);
  }, [syncOrders]);

  // Force re-render every minute to update time-based statuses
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    // Sync with seconds to update roughly at :00
    const now = new Date();
    const delay = (60 - now.getSeconds()) * 1000;

    // Initial timeout to align with minute boundary
    const timeoutId = setTimeout(() => {
      setCurrentTime(new Date());
      // Then interval
      const intervalId = setInterval(() => {
        setCurrentTime(new Date());
      }, 60000);

      return () => clearInterval(intervalId);
    }, delay);

    return () => clearTimeout(timeoutId);
  }, []);

  const derivedStatuses = React.useMemo(() => {
    if (!profile) return [];

    // Use currentTime state to ensure reactivity
    const now = currentTime;

    return filteredStaff.map(staff => {
      const orderStatusObj = statuses.find(s => s.staffId === staff.id);

      const getDisplayStatus = () => {
        // 1. Generic Task Status (Priority 1: Time Window)
        if (scheduleEvents) {
          const currentGenericEvent = scheduleEvents.find(event => {
            if (event.staffId !== staff.id) return false;

            // Check if it looks like a Generic Task based on title
            // Note: "移動" is usually a sub-event of an order, but standalone "移動" exists.
            // If it's a real order travel, it behaves as order.
            // However, user wants "Break" etc to be automatic.

            const title = event.title || '';
            const isGeneric = ['休憩', '商談', '研修', '同行', '業務', '会議'].some(k => title.includes(k));
            if (!isGeneric) return false;

            const start = typeof event.start === 'string' ? parseISO(event.start) : event.start;
            const end = typeof event.end === 'string' ? parseISO(event.end) : event.end;
            return isValid(start) && isValid(end) && now >= start && now <= end;
          });

          if (currentGenericEvent) {
            const title = currentGenericEvent.title || '作業';
            return title.endsWith('中') ? title : `${title}中`;
          }
        }

        // 2. Active Order Status (Priority 2: Button Status)
        let displayStatus = '';
        let lastAction = '情報なし';

        if (orderStatusObj?.lastUpdate) {
          const lastUpdateDate = new Date(orderStatusObj.lastUpdate);
          if (isToday(lastUpdateDate)) {
            displayStatus = orderStatusObj.status || '';
            lastAction = orderStatusObj.lastAction || '';
          }
        }

        if (displayStatus === '移動開始' || displayStatus === '移動中') return '移動中';
        if (displayStatus === '現場到着' || displayStatus === '作業待ち') return '作業待ち';
        if (displayStatus === '作業開始' || displayStatus === '作業中') return '作業中';
        // Note: '作業完了' falls through to step 3.

        // 3. Overdue Task Check (Implied Status)
        // If staff has a task that should have started but no button was pressed,
        // hint at the likely status with a question mark.
        let hasTasksToday = false;

        if (scheduleEvents) {
          // Check if staff has any tasks TODAY
          hasTasksToday = scheduleEvents.some(event => {
            if (event.staffId !== staff.id) return false;
            const start = typeof event.start === 'string' ? parseISO(event.start) : event.start;
            return isValid(start) && isSameDay(start, currentDate);
          });

          // Find the active event for THIS moment
          const activeEvent = scheduleEvents.find(event => {
            if (event.staffId !== staff.id) return false;
            // Ignore generic here because they are handled in Step 1
            if (event.staffId === 'unassigned') return false;

            const start = typeof event.start === 'string' ? parseISO(event.start) : event.start;
            const end = typeof event.end === 'string' ? parseISO(event.end) : event.end;
            return isValid(start) && isValid(end) && now >= start && now <= end;
          });

          if (activeEvent) {
            // If the event has a completion time (済 mark), it's done — show 待機中
            if (activeEvent.actualEndTime) return '待機中';
            const title = activeEvent.title || '';
            if (title.startsWith('移動')) return '移動中？';
            return '作業中？';
          }
        }

        // 4. Attendance / Shift Status (Fallback)
        if (presentStaffIds.has(staff.id)) {
          return '待機中';
        } else if (scheduledStaffIds.has(staff.id)) {
          return '出勤予定';
        }

        // 5. Final Fallback
        return hasTasksToday ? '待機中' : '-';
      };

      let finalStatus = getDisplayStatus();

      // 4. Clock Out Override
      if (checkedOutStaffIds.has(staff.id)) {
        finalStatus = '退勤済';
      }

      return {
        ...orderStatusObj,
        staffId: staff.id,
        status: finalStatus,
        lastAction: orderStatusObj?.lastAction || ''
      } as StaffStatus;
    });
  }, [filteredStaff, statuses, scheduleEvents, checkedOutStaffIds, presentStaffIds, scheduledStaffIds, profile, currentTime]);


  const showVerticalView = !adminWantsTimelineView && (forceMobileView || isMobile);

  if (isLoading || !profile) {
    return (
      <div className="flex flex-col items-center justify-center p-10 gap-4 min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">データを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-none px-4 py-2 space-y-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <h1 className="text-xl font-bold tracking-tight whitespace-nowrap flex items-center gap-2">
          ダッシュボード
          {/* Version indicator removed for production look */}
        </h1>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-y-2">

          {/* Controls Row (Date + Mobile Buttons) */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
            {/* Date Controls */}
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDateChange(-1)}
                className="h-7 w-7 hover:bg-background shadow-sm transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-2 sm:px-3 py-1 min-w-[80px] sm:min-w-[120px] text-center font-medium bg-background rounded-md shadow-sm border text-sm">
                <span className="hidden sm:inline">{format(currentDate, 'yyyy年MM月dd日', { locale: ja })}</span>
                <span className="sm:hidden">{format(currentDate, 'M/d(EEE)', { locale: ja })}</span>
                {(isSyncing || isAutoRefreshing) && <Loader2 className="inline ml-1 sm:ml-2 h-3 w-3 animate-spin text-muted-foreground" />}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDateChange(1)}
                className="h-7 w-7 hover:bg-background shadow-sm transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDateChange(0)}
                disabled={isToday(currentDate)}
                className="ml-1 h-7 px-3 text-xs font-medium hover:bg-background shadow-sm transition-all"
              >
                今日
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-background shadow-sm transition-all"
                  >
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={currentDate}
                    onSelect={(date) => {
                      if (date) {
                        setIsSyncing(true);
                        setCurrentDate(date);
                      }
                    }}
                    initialFocus
                    locale={ja}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Mobile Actions: Form Link & Attendance */}
            <div className="flex md:hidden items-center gap-1 ml-auto md:ml-0">
              <Button variant="ghost" size="icon" asChild className="mr-1">
                <Link href="/order-form">
                  <ExternalLink className="h-5 w-5" />
                </Link>
              </Button>
              <AttendanceControls variant="compact" />
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-2">
            <div className="flex items-center space-x-2 mr-4">

              <ShareOrderFormModal />

              <Switch
                id="show-management"
                checked={showManagement}
                onCheckedChange={setShowManagement}
              />
              <Label htmlFor="show-management" className="cursor-pointer flex items-center gap-2 mr-4">
                <span className="text-sm font-medium">管理・コントローラーを表示</span>
              </Label>

              <Switch
                id="mobile-view"
                checked={forceMobileView}
                onCheckedChange={setForceMobileView}
              />
              <Label htmlFor="mobile-view" className="cursor-pointer flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                <span className="text-sm font-medium">モバイルビュー</span>
              </Label>
            </div>
            <AttendanceControls />
          </div>
        </div>

        {selectedStaffNames && (
          <div className="rounded bg-muted/50 px-2 py-1 flex items-center">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground mr-2">表示中:</span>
              <span className="truncate max-w-[60vw] inline-block align-bottom">{selectedStaffNames}</span>
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto bg-muted/10 p-2">

        {showVerticalView ? (
          <VerticalScheduleView
            staffData={filteredStaff}
            currentDate={currentDate}
            checkedOutStaffIds={checkedOutStaffIds}
          />
        ) : (
          <ScheduleView
            staffData={filteredStaff}
            currentDate={currentDate}
            checkedOutStaffIds={checkedOutStaffIds}
            statuses={derivedStatuses}
          />
        )}
      </div>
    </div >
  );
}
