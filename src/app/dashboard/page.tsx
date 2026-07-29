'use client';
import * as React from 'react';
import { mapRawToOrder, normalizeDateStr, findKey, cn } from '../../lib/utils';
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
  const [isPending, startTransition] = React.useTransition();
  const [calendarOpen, setCalendarOpen] = React.useState(false);
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
    orders,
    setCurrentViewedDate
  } = useOrder();

  const counts = React.useMemo(() => {
    if (!rawOrdersData || !orders) return { total: 0, displayed: 0, hidden: 0 };

    const dateStr = format(currentDate, 'yyyy-MM-dd');

    // Normalize and Filter raw data using mapRawToOrder
    const dayOrders = rawOrdersData
      .map((raw, idx) => mapRawToOrder(raw, `check-${idx}`))
      .filter(o => {
        // Filter out empty rows
        const hasNoCustomer = !o.customerCode || o.customerCode === '00000' || !o.customerName || o.customerName === '（店舗名未設定）';
        const hasNoDetails = !o.taskDetails && !o.orderNo && !o.regNo && !o.productName;
        if (hasNoCustomer && hasNoDetails) return false;

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

  const orderCountsByDate = React.useMemo(() => {
    if (!rawOrdersData) return {} as Record<string, number>;
    const countsMap: Record<string, number> = {};

    rawOrdersData.forEach((raw, idx) => {
      const o = mapRawToOrder(raw, `cnt-${idx}`);
      const hasNoCustomer = !o.customerCode || o.customerCode === '00000' || !o.customerName || o.customerName === '（店舗名未設定）';
      const hasNoDetails = !o.taskDetails && !o.orderNo && !o.regNo && !o.productName;
      if (hasNoCustomer && hasNoDetails) return;

      const normDate = normalizeDateStr(o.scheduledDate);
      if (normDate) {
        countsMap[normDate] = (countsMap[normDate] || 0) + 1;
      }
    });

    return countsMap;
  }, [rawOrdersData]);

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
        const roleStr = String(staff.role || (staff as any).raw?.role || (staff as any).raw?.['ロール'] || (staff as any).raw?.['役職'] || (staff as any)['ロール'] || (staff as any)['役職'] || '').toLowerCase().trim();
        const staffName = staff.name || (staff as any)['氏名'] || (staff as any)['名前'] || '';

        // Check if user is an Admin/Staff dual role (e.g. "admin/staff", "admin\staff", "admin_staff", "管理者/スタッフ", "兼任", or 杉山和彦)
        const isAdminStaff = (roleStr.includes('admin') && roleStr.includes('staff')) ||
                             (roleStr.includes('管理者') && roleStr.includes('スタッフ')) ||
                             roleStr.includes('兼任') ||
                             staffName.includes('杉山和彦');

        if (isAdminStaff) {
          // Keep Admin/Staff dual roles visible even when showManagement is OFF
          return true;
        }

        // Pure Admin or Controller
        const isController = staff['コントローラー'] === '⚪︎' || staff.controller === '⚪︎' || staff['コントローラー'] === '○' || staff.controller === '○';
        const isPureAdmin = (roleStr === 'admin' || roleStr === '管理者') && !isAdminStaff;

        if (isController || isPureAdmin) {
          // Hide pure Admin / Controllers when showManagement is OFF
          return false;
        }

        return true;
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

  const handleDateChange = React.useCallback((direction: 'next' | 'prev' | 'today' | number | Date) => {
    let nextDate: Date;
    if (direction instanceof Date) {
      nextDate = direction;
    } else if (direction === 'today' || direction === 0) {
      nextDate = startOfToday();
    } else if (typeof direction === 'number') {
      nextDate = addDays(currentDate, direction);
    } else {
      nextDate = direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1);
    }

    // Instantly sync viewed date to OrderContext
    setCurrentViewedDate(nextDate);

    // Non-blocking UI update transition
    startTransition(() => {
      setCurrentDate(nextDate);
    });
  }, [currentDate, setCurrentViewedDate]);

  // Keyboard navigation shortcuts (Left Arrow: Prev, Right Arrow: Next, T: Today)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if active element is an input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleDateChange(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleDateChange(1);
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        handleDateChange('today');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDateChange]);

  // Sync attendance when date changes
  const lastSyncedDate = useRef<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    const syncAttendance = async () => {
      // Determine if we are mounting (Refresh) or switching dates
      const isMount = lastSyncedDate.current === null;
      const isRealDateSwitch = lastSyncedDate.current !== null && !isSameDay(currentDate, lastSyncedDate.current);
      const isDateChange = isMount || isRealDateSwitch;

      if (isDateChange) {
        if (isRealDateSwitch) {
          isDateLoading.current = true;
        }
        lastSyncedDate.current = currentDate;
        setCheckedOutStaffIds(new Set());
      }

      // 0. Identify staff with orders for this day
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
      if (isRealDateSwitch || isMount) {
        if (staffWithOrders.size > 0) {
          setSelectedStaffIds(Array.from(staffWithOrders));
        } else if (allStaff && allStaff.length > 0) {
          setSelectedStaffIds(allStaff.map(s => s.id));
        }
      }

      try {
        const { staffIds: attendedStaffIds, checkedOutIds = [], scheduledStaffIds: scheduledIds = [] } = await getDailyAttendanceDetails(currentDate);
        
        // Prevent race condition if user switched date while fetching
        if (cancelled) return;

        setCheckedOutStaffIds(new Set(checkedOutIds));
        setPresentStaffIds(new Set(attendedStaffIds));
        setScheduledStaffIds(new Set(scheduledIds));

        const combinedStaffIds = Array.from(new Set([...attendedStaffIds, ...scheduledIds, ...Array.from(staffWithOrders)]));

        if (combinedStaffIds.length > 0) {
          if (isRealDateSwitch || isMount) {
            setSelectedStaffIds(combinedStaffIds);
          } else {
            setSelectedStaffIds(prev => Array.from(new Set([...prev, ...combinedStaffIds])));
          }
        } else if (isRealDateSwitch) {
          setSelectedStaffIds([]);
        } else if (isMount && allStaff && allStaff.length > 0) {
          setSelectedStaffIds(allStaff.map(s => s.id));
        }
      } catch (e) {
        if (!cancelled) console.error("Failed to sync attendance:", e);
      } finally {
        if (!cancelled) {
          isDateLoading.current = false;
          setIsSyncing(false);
          if (isDateChange) {
            loadOrders(currentDate);
          }
        }
      }
    };

    syncAttendance();

    return () => {
      cancelled = true;
    };
  }, [currentDate, setSelectedStaffIds, scheduleEvents, loadOrders, setCurrentViewedDate]);

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

        // 2. Active Order / Direct Staff Status (Priority 2: Button Status)
        let displayStatus = (staff as any).currentStatus || orderStatusObj?.status || '';
        let lastAction = orderStatusObj?.lastAction || '';

        if (orderStatusObj?.lastUpdate) {
          const lastUpdateDate = new Date(orderStatusObj.lastUpdate);
          if (isToday(lastUpdateDate)) {
            displayStatus = displayStatus || orderStatusObj.status || '';
            lastAction = orderStatusObj.lastAction || '';
          }
        }

        if (displayStatus === '移動開始' || displayStatus === '移動中') return '移動中';
        if (displayStatus === '帰社' || displayStatus === '帰社中') return '帰社中';
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
            <div className="flex items-center gap-1.5 bg-muted/60 rounded-lg p-1 border shadow-inner">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDateChange(-1)}
                title="前日へ (← キー)"
                aria-label="前日へ"
                className="h-8 w-8 hover:bg-background active:scale-90 shadow-none hover:shadow-sm transition-all duration-75 cursor-pointer select-none"
              >
                <ChevronLeft className="h-4.5 w-4.5" />
              </Button>
              <div className="px-2.5 sm:px-3.5 py-1 min-w-[90px] sm:min-w-[130px] text-center font-semibold bg-background rounded-md shadow-sm border text-sm select-none transition-all flex items-center justify-center gap-1">
                <span className="hidden sm:inline">{format(currentDate, 'yyyy年MM月dd日', { locale: ja })}</span>
                <span className="sm:hidden">{format(currentDate, 'M/d(EEE)', { locale: ja })}</span>
                {(isSyncing || isAutoRefreshing || isPending) && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDateChange(1)}
                title="翌日へ (→ キー)"
                aria-label="翌日へ"
                className="h-8 w-8 hover:bg-background active:scale-90 shadow-none hover:shadow-sm transition-all duration-75 cursor-pointer select-none"
              >
                <ChevronRight className="h-4.5 w-4.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDateChange(0)}
                disabled={isToday(currentDate)}
                title="今日へ移動 (T キー)"
                className="ml-0.5 h-8 px-3 text-xs font-medium hover:bg-background active:scale-95 shadow-none hover:shadow-sm transition-all duration-75 cursor-pointer select-none disabled:opacity-40"
              >
                今日
              </Button>

              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="日付を選択"
                    aria-label="カレンダーで日付選択"
                    className="h-8 w-8 hover:bg-background active:scale-90 shadow-none hover:shadow-sm transition-all duration-75 cursor-pointer select-none"
                  >
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={currentDate}
                    onSelect={(date: Date | undefined) => {
                      if (date) {
                        setCalendarOpen(false);
                        handleDateChange(date);
                      }
                    }}
                    initialFocus
                    locale={ja}
                    components={{
                      DayContent: (dayProps: any) => {
                        const date = dayProps.date || dayProps.day?.date || dayProps;
                        if (!date || !(date instanceof Date)) return null;
                        const dateStr = normalizeDateStr(date);
                        const count = orderCountsByDate[dateStr] || 0;
                        const isSelected = isSameDay(date, currentDate);

                        return (
                          <div className="relative flex flex-col items-center justify-center w-full h-full py-0.5">
                            <span className="text-xs font-semibold leading-tight">{date.getDate()}</span>
                            {count > 0 ? (
                              <span className={cn(
                                "mt-0.5 px-1 py-0.5 text-[9px] font-bold rounded-full leading-none shadow-sm min-w-[16px] text-center transition-all",
                                isSelected ? "bg-white text-blue-700 font-extrabold" : "bg-blue-600 text-white"
                              )}>
                                {count}件
                              </span>
                            ) : (
                              <span className="h-3" />
                            )}
                          </div>
                        );
                      }
                    } as any}
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
