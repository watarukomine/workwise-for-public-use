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
import { useIsMobile } from '../../hooks/use-mobile';
import { VerticalScheduleView } from '../../components/dashboard/vertical-schedule-view';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { useAppShell } from '../../components/app-shell';

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
  const isDateLoading = useRef(false);
  const [isSyncing, setIsSyncing] = useState(true); // Add syncing state, default true for initial load
  const { toast } = useToast();

  useEffect(() => {
    if (!isProfileLoading && !profile) {
      router.push('/login');
    }
  }, [isProfileLoading, profile, router]);

  const filteredStaff = React.useMemo(() => {
    if (isProfileLoading || isStaffLoading || !profile) return [];

    const staffToUse = allStaff;

    let selectedStaff: WithId<Staff>[];

    if (profile.role !== 'admin') {
      selectedStaff = staffToUse.filter(staff => staff.id === profile.id || staff.name === profile.name);
    } else {
      if (appliedSelectedStaffIds.length === 0) {
        selectedStaff = staffToUse;
      } else {
        const selectedIds = new Set(appliedSelectedStaffIds);
        selectedStaff = staffToUse.filter(staff => selectedIds.has(staff.id));
      }
    }

    return selectedStaff; // Return in original order (Sheet order)

  }, [appliedSelectedStaffIds, profile, isProfileLoading, allStaff, isStaffLoading]);

  const selectedStaffNames = React.useMemo(() => {
    if (profile?.role !== 'admin' || appliedSelectedStaffIds.length === 0) {
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
        const { staffIds: attendedStaffIds, checkedOutIds = [] } = await getDailyAttendanceDetails(currentDate);
        setCheckedOutStaffIds(new Set(checkedOutIds));

        // 3. Merge lists
        const combinedStaffIds = Array.from(new Set([...attendedStaffIds, ...Array.from(staffWithOrders)]));

        if (combinedStaffIds.length > 0) {
          if (isRealDateSwitch) {
            // On Real Date Switch: Force set to new day's attendance
            setSelectedStaffIds(combinedStaffIds);
          } else {
            // On Mount/Refresh OR Same Day Update (Background Poll):
            // MERGE with existing selection to preserve localStorage state or manual changes
            setSelectedStaffIds(prev => Array.from(new Set([...prev, ...combinedStaffIds])));
          }
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

  // Save attendance when selection changes
  useEffect(() => {
    // Skip saving if we are currently loading data for a new date
    if (isDateLoading.current) return;

    // Only save if we are logged in and have a selection.
    if (profile && appliedSelectedStaffIds.length > 0) {
      // Debounce or just save? Firestore is fast. Let's just save.
      saveDailyAttendance(currentDate, appliedSelectedStaffIds)
        .then(() => {
          // Optional: toast({ title: "表示設定を保存しました", duration: 1000 }) 
          // might be too noisy if it happens on every click. 
          // But useful for debugging.
        })
        .catch(e => {
          console.error("Failed to save daily attendance:", e);
          toast({ variant: 'destructive', title: "表示設定の保存に失敗しました", description: "再読み込み時に設定がリセットされる可能性があります。" });
        });
    }
  }, [appliedSelectedStaffIds, currentDate, profile]);

  // Calculate Derived Statuses
  const derivedStatuses = React.useMemo(() => {
    if (!profile) return [];
    const now = new Date();

    return filteredStaff.map(staff => {
      // 1. Get Base Status from Order Context
      const orderStatusObj = statuses.find(s => s.staffId === staff.id);
      let displayStatus = orderStatusObj?.status || '未割当';
      const lastAction = orderStatusObj?.lastAction || '';

      // 2. Map Raw Statuses to User Requested Display
      if (displayStatus === '移動開始' || displayStatus === '移動中') displayStatus = '移動中';
      else if (displayStatus === '現場到着') displayStatus = '作業待ち';
      else if (displayStatus === '作業開始' || displayStatus === '作業中') displayStatus = '作業中';
      else if (displayStatus === '作業完了') displayStatus = '待機中';
      else if (displayStatus === '待機中') displayStatus = '待機中';

      // 3. Handle "Clock In" -> "出勤済" vs "Idle"
      // If status is "待機中" (Idle) or "未割当" (Unassigned)
      if (displayStatus === '待機中' || displayStatus === '未割当') {
        // If "Clocked In" (in selectedStaffIds) AND no specific last action implying work completion?
        // User said: "Clock In -> 出勤済". "Work Complete -> 待機中".
        // Typically, fresh clock-in has displayStatus='未割当' or '待機中' depending on initialization.
        // If `lastAction` is '情報なし' (default in context), we can say '出勤済'.
        if (appliedSelectedStaffIds.includes(staff.id)) {
          if (lastAction === '情報なし' || displayStatus === '未割当') {
            displayStatus = '出勤済';
          } else {
            // If we have history, it's '待機中' (Waiting for next order)
            displayStatus = '待機中';
          }
        }
      }

      // 4. Override with Generic Chips (if current time is within event)
      // Check for generic chips (events without orderId/rawOrderId or specific flag)
      // We look at `scheduleEvents`
      if (scheduleEvents) {
        const currentGenericEvent = scheduleEvents.find(event => {
          if (event.staffId !== staff.id) return false;
          // Check if it's a "Generic" event. 
          // Definition: No customerCode or customerName? Or explicit ID?
          // In `order-context`, generic tasks have id `generic-...` but those are draggable sources.
          // Placed events have IDs like `trip-...`.
          // If it DOESN'T have a valid `rawOrderId`, it might be generic.
          // OR if `customerCode` is empty?
          // Let's assume Order-based events have `rawOrderId`.
          if (event.rawOrderId) return false; // It's an order

          const start = typeof event.start === 'string' ? parseISO(event.start) : event.start;
          const end = typeof event.end === 'string' ? parseISO(event.end) : event.end;
          return isValid(start) && isValid(end) && now >= start && now <= end;
        });

        if (currentGenericEvent) {
          displayStatus = currentGenericEvent.title;
        }
      }

      // 5. Clock Out Override
      if (checkedOutStaffIds.has(staff.id)) {
        displayStatus = '退勤済';
      }

      return {
        ...orderStatusObj,
        staffId: staff.id,
        status: displayStatus,
      } as StaffStatus;
    });
  }, [filteredStaff, statuses, scheduleEvents, checkedOutStaffIds, appliedSelectedStaffIds, profile]);


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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold tracking-tight">ダッシュボード</h1>
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDateChange(-1)}
                className="h-7 w-7 hover:bg-background shadow-sm transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-3 py-1 min-w-[120px] text-center font-medium bg-background rounded-md shadow-sm border text-sm">
                {format(currentDate, 'yyyy年MM月dd日')}
                {isSyncing && <Loader2 className="inline ml-2 h-3 w-3 animate-spin text-muted-foreground" />}
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
          </div>
          <div className="hidden md:flex items-center space-x-2">
            <div className="flex items-center space-x-2 mr-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncOrders()}
                disabled={isSyncingOrders}
                className="hidden sm:flex"
              >
                <RefreshCw className={`mr-2 h-3 w-3 ${isSyncingOrders ? 'animate-spin' : ''}`} />
                シフト同期
              </Button>
              <div className="w-px h-6 bg-border mx-2" />
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
    </div>
  );
}
