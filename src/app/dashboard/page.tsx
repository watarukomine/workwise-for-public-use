'use client';
import * as React from 'react';
import { ScheduleView } from '../../components/dashboard/schedule-view';
import { Staff, StaffStatus, WithId } from '../../lib/types';
import { useSelectedStaff } from '../../contexts/selected-staff-context';
import { useUserProfile } from '../../hooks/use-user-profile';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { AlertCircle, Loader2, ChevronLeft, ChevronRight, Smartphone, RefreshCw } from 'lucide-react';
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
import { ExternalLink } from 'lucide-react';


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
  const { forceMobileView, setForceMobileView } = useAppShell();

  const {
    statuses,
    isLoading: isLoadingOrders,
    scheduleEvents,
    loadOrders,
    syncOrders,
    isSyncingOrders
  } = useOrder();

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
        }
      }
    };
    syncAttendance();
  }, [currentDate, setSelectedStaffIds, scheduleEvents]);

  // Selection state is persisted in localStorage via SelectedStaffContext.
  // We NO LONGER auto-save selection to "saveDailyAttendance" (Database) 
  // because that field (staffIds) represents "Clocked In", not "Viewed".
  // Visibility is purely local + Shift Schedule + Clocked In status.

  // Calculate Derived Statuses
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);

  useEffect(() => {
    const intervalId = setInterval(async () => {
      setIsAutoRefreshing(true);
      await syncOrders();
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
    const now = new Date();

    return filteredStaff.map(staff => {
      const orderStatusObj = statuses.find(s => s.staffId === staff.id);

      const getDisplayStatus = () => {
        // 1. Generic Task Status (Priority 1: Time Window)
        if (scheduleEvents) {
          const currentGenericEvent = scheduleEvents.find(event => {
            if (event.staffId !== staff.id) return false;
            if (event.rawOrderId) return false;

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
        let displayStatus = '未割当';
        let lastAction = '情報なし';

        if (orderStatusObj?.lastUpdate) {
          const lastUpdateDate = new Date(orderStatusObj.lastUpdate);
          if (isToday(lastUpdateDate)) {
            displayStatus = orderStatusObj.status || '未割当';
            lastAction = orderStatusObj.lastAction || '';
          }
        }

        if (displayStatus === '移動開始' || displayStatus === '移動中') return '移動中';
        if (displayStatus === '現場到着' || displayStatus === '作業待ち') return '作業待ち';
        if (displayStatus === '作業開始' || displayStatus === '作業中') return '作業中';
        // Note: '作業完了' falls through to step 3.

        // 3. Attendance / Shift Status (Priority 3: Fallback)
        if (presentStaffIds.has(staff.id)) {
          // Present but not in active button state
          return '待機中';
          // Note: Logic simplified to '待機中' if present and not working/moving.
          // '出勤済' can be used if explicit differentiation needed, but '待機中' is safe.
        } else if (scheduledStaffIds.has(staff.id)) {
          return '出勤予定';
        }

        return '未割当';
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
  }, [filteredStaff, statuses, scheduleEvents, checkedOutStaffIds, presentStaffIds, scheduledStaffIds, profile]);


  const showVerticalView = forceMobileView || (isMobile && profile?.role !== 'admin');

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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-y-2">
          {/* Title Area */}
          <div className="flex items-center justify-between w-full md:w-auto">
            <h1 className="text-xl font-bold tracking-tight whitespace-nowrap">ダッシュボード</h1>
          </div>

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
