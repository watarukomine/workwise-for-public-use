'use client';
import * as React from 'react';
import { ScheduleView } from '../../components/dashboard/schedule-view';
import { Staff, StaffStatus, WithId } from '../../lib/types';
import { useSelectedStaff } from '../../contexts/selected-staff-context';
import { useUserProfile } from '../../hooks/use-user-profile';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { AlertCircle, Loader2, ChevronLeft, ChevronRight, Smartphone } from 'lucide-react';
import { useCustomer } from '../../contexts/customer-context';
import { Button } from '../../components/ui/button';
import { useOrder } from '../../contexts/order-context';
import { format, isToday, addDays, subDays, parseISO, isValid, isEqual, startOfDay, startOfToday } from 'date-fns';
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



export default function DashboardPage() {
  const [currentDate, setCurrentDate] = React.useState(startOfToday());
  const router = useRouter();
  const isMobile = useIsMobile();
  const { forceMobileView, setForceMobileView } = useAppShell();

  const {
    isLoading: isLoadingOrders,
    statuses,
    scheduleEvents,
  } = useOrder();

  const { isLoading: isLoadingCustomers } = useCustomer();
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { allStaff, appliedSelectedStaffIds, setSelectedStaffIds, isLoading: isStaffLoading } = useSelectedStaff();
  const [checkedOutStaffIds, setCheckedOutStaffIds] = useState<Set<string>>(new Set());
  const isDateLoading = useRef(false);

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

    return selectedStaff.sort((a, b) => {
      // 2. Sort: Mothershop order -> Name
      const aStore = a['母店'] || '';
      const bStore = b['母店'] || '';
      const aOrder = STORE_ORDER[aStore] || 99;
      const bOrder = STORE_ORDER[bStore] || 99;

      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.name || '').localeCompare(b.name || '');
    });

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
    total: isLoading
  });

  const handleDateChange = (direction: 'next' | 'prev' | 'today') => {
    setCurrentDate(current => {
      if (direction === 'today') return startOfToday();
      return direction === 'next' ? addDays(current, 1) : subDays(current, 1);
    });
  };

  // Sync attendance when date changes
  useEffect(() => {
    const syncAttendance = async () => {
      isDateLoading.current = true;
      try {
        // 1. Fetch explicitly attended staff from Firestore with details
        const { staffIds: attendedStaffIds, checkedOutIds = [] } = await getDailyAttendanceDetails(currentDate);
        setCheckedOutStaffIds(new Set(checkedOutIds));

        // 2. Identify staff who have assigned orders for this date (Safety Mechanism)
        // Even if marked absent, if they have work, they must be shown.
        const staffWithOrders = new Set<string>();
        if (scheduleEvents) {
          scheduleEvents.forEach((event: any) => {
            const eventStart = typeof event.start === 'string' ? parseISO(event.start) : event.start;
            if (isValid(eventStart) && isToday(eventStart) ? isToday(currentDate) : isEqual(startOfDay(eventStart), startOfDay(currentDate))) {
              if (event.staffId) {
                staffWithOrders.add(event.staffId);
              }
            }
          });
        }

        // 3. Merge lists
        const combinedStaffIds = Array.from(new Set([...attendedStaffIds, ...Array.from(staffWithOrders)]));

        if (combinedStaffIds.length > 0) {
          setSelectedStaffIds(combinedStaffIds);
        }
        // If no record, we currently keep the previous selection (or default) as a feature to allow easy copy-over.
      } catch (e) {
        console.error("Failed to sync attendance:", e);
      } finally {
        // Short timeout to ensure state updates trigger effects before we re-enable saving
        setTimeout(() => {
          isDateLoading.current = false;
        }, 500);
      }
    };
    syncAttendance();
  }, [currentDate, setSelectedStaffIds, scheduleEvents]);

  // Save attendance when selection changes
  useEffect(() => {
    // Skip saving if we are currently loading data for a new date
    if (isDateLoading.current) return;

    // Skip saving if we are in admin mode but haven't selected anyone (optional safeguard)
    // Only save if we are admin? Users might want to save their own attendance? 
    // Usually only admins or managers set the daily list.
    if (profile?.role === 'admin' && appliedSelectedStaffIds.length > 0) {
      // Debounce or just save? Firestore is fast. Let's just save.
      saveDailyAttendance(currentDate, appliedSelectedStaffIds).catch(e => {
        console.error("Failed to save daily attendance:", e);
      });
    }
  }, [appliedSelectedStaffIds, currentDate, profile]);


  if (isLoading || !profile) {
    return (
      <div className="flex flex-col items-center justify-center p-10 gap-4 min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">データを読み込み中...</p>
      </div>
    );
  }

  const showVerticalView = forceMobileView || (isMobile && profile.role !== 'admin');

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="w-full sm:w-auto">
          <AttendanceControls onStatusChange={() => {
            // Determine direction based on whether we are viewing "today" or not?
            // Actually, re-fetching for 'currentDate' is what matters. 
            // But AttendanceControls only affects TODAY.
            // If currentDate is today, refresh.
            if (isToday(currentDate)) {
              // This is a bit hacky to trigger re-fetch basically by causing re-render or effect
              // setCurrentDate(new Date()); // No, this resets time.
              // Ideally we have a 'refresh' trigger.
              // But since syncAttendance depends on currentDate, maybe just toggling it or having a separate refresh function?
              // For now, simple page reload or let the user navigate is ok, 
              // BUT for better UX, let's trigger a re-fetch manually.
              // We don't have a refetch function exposed easily for syncAttendance effect.
              // Maybe just window.location.reload() for MVP or reliable update? 
              // Or standardizing 'refetch' context.
              // For now, let's just let it be, or do a soft refresh.
              window.location.reload();
            }
          }} />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isToday(currentDate) ? "ダッシュボード" : format(currentDate, "M月d日 (E)")}
          </h1>
          <p className="text-muted-foreground">
            スタッフのスケジュールと現在の状況を一覧で確認できます。
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => handleDateChange('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => handleDateChange('today')} disabled={isToday(currentDate)}>今日</Button>
            <Button variant="outline" size="icon" onClick={() => handleDateChange('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Smartphone className="h-5 w-5" />
            <Switch
              id="mobile-view-switch"
              checked={forceMobileView}
              onCheckedChange={setForceMobileView}
            />
            <Label htmlFor="mobile-view-switch" className="hidden sm:inline">モバイル表示</Label>
          </div>
        </div>
      </div>

      {selectedStaffNames && (
        <div className="rounded-lg bg-muted p-3">
          <p className="text-sm font-medium text-muted-foreground">
            <span className="font-semibold text-foreground">表示中のスタッフ:</span> {selectedStaffNames}
          </p>
        </div>
      )}

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
          statuses={statuses}
          checkedOutStaffIds={checkedOutStaffIds}
        />
      )}
    </div>
  );
}
