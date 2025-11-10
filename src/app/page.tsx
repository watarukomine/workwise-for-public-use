
'use client';

import * as React from 'react';
import { ScheduleView } from '@/components/dashboard/schedule-view';
import { StatusUpdates } from '@/components/dashboard/status-updates';
import { customerData, staffStatusData } from '@/lib/data';
import type { Customer, WithId, Staff, ScheduleEvent } from '@/lib/types';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ChevronLeft, ChevronRight, Monitor, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useOrder } from '@/contexts/order-context';
import { format, startOfToday, addDays, subDays, isToday, isEqual, startOfDay, parseISO, isValid } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { VerticalScheduleView } from '@/components/dashboard/vertical-schedule-view';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAppShell } from '@/components/app-shell';
import { Loader2 } from 'lucide-react';


export default function DashboardPage() {
  const [customers] = React.useState<WithId<Customer>[]>(customerData);
  const [currentDate, setCurrentDate] = React.useState(startOfToday());
  
  const { 
    orders: rawOrders, 
    scheduleEvents,
    setScheduleEvents,
    isLoading: isLoadingOrders,
  } = useOrder();
  
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { allStaff, appliedSelectedStaffIds, isLoading: isStaffLoading } = useSelectedStaff();
  const isMobile = useIsMobile();
  const { forceMobileView, setForceMobileView } = useAppShell();
  
  const filteredStaff = React.useMemo(() => {
    if (isProfileLoading || isStaffLoading || !profile || !allStaff) return [];

    const staffToUse = allStaff;

    let selectedStaff: WithId<Staff>[];

    if (profile.role !== 'admin') {
      selectedStaff = staffToUse.filter(staff => staff.id === profile.id || staff.name === profile.name);
    } else {
      if (appliedSelectedStaffIds.length === 0) {
        selectedStaff = staffToUse;
      } else {
        selectedStaff = staffToUse.filter(staff => appliedSelectedStaffIds.includes(staff.id));
      }
    }

    const areaOrder: { [key: string]: number } = { '横浜店': 1, '東名川崎店': 2, '綾瀬店': 3 };
    return selectedStaff.sort((a, b) => {
      const areaA = a['母店'] || '';
      const areaB = b['母店'] || '';
      const orderA = areaOrder[areaA] || 99;
      const orderB = areaOrder[areaB] || 99;
      return orderA - orderB;
    });

  }, [appliedSelectedStaffIds, profile, isProfileLoading, allStaff, isStaffLoading]);
  
  const filteredStatuses = React.useMemo(() => {
    if (!staffStatusData || !filteredStaff) return [];
    const selectedIds = new Set(filteredStaff.map(s => s.id));
    return staffStatusData.filter(status => selectedIds.has(status.staffId));
  }, [filteredStaff]);

  const selectedStaffNames = React.useMemo(() => {
    if (!allStaff || profile?.role !== 'admin' || appliedSelectedStaffIds.length === 0) {
      return null;
    }
    const staffToUse = allStaff;
    if (appliedSelectedStaffIds.length === staffToUse.length) {
      return "全スタッフ";
    }
    const selectedStaff = staffToUse.filter(s => appliedSelectedStaffIds.includes(s.id));
    return selectedStaff.map(s => s.name).join('、');
  }, [allStaff, appliedSelectedStaffIds, profile]);

  const isLoading = isProfileLoading || isLoadingOrders || isStaffLoading;

  const handleDateChange = (direction: 'next' | 'prev' | 'today') => {
      setCurrentDate(current => {
          if (direction === 'today') return startOfToday();
          return direction === 'next' ? addDays(current, 1) : subDays(current, 1);
      });
  };
  
  const dailySchedule = React.useMemo(() => {
    if (!scheduleEvents) return [];
    return scheduleEvents.filter(event => {
        const eventDate = typeof event.start === 'string' ? parseISO(event.start) : event.start;
        return isValid(eventDate) && isEqual(startOfDay(eventDate), startOfDay(currentDate));
    });
}, [scheduleEvents, currentDate]);


  if (isLoading) {
      return (
        <div className="flex items-center justify-center p-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
  }

  if (!profile) {
      return (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>ようこそ WorkWiseへ</AlertTitle>
          <AlertDescription>
            <p>機能を利用するにはログインが必要です。</p>
             <Button asChild className="mt-4">
              <Link href="/login">
                 ログインページへ
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )
  }
  
  const showVerticalView = forceMobileView || (isMobile && profile.role !== 'admin');

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
                {isToday(currentDate) ? "本日の予定" : format(currentDate, "M月d日 (E)")}
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

      <div className="flex flex-col gap-8">
        {showVerticalView ? (
            <VerticalScheduleView 
                scheduleData={dailySchedule}
                staffData={filteredStaff}
            />
        ) : (
            <ScheduleView 
                staffData={filteredStaff} 
                customerData={customers} 
                rawOrdersData={rawOrders}
                scheduleData={dailySchedule}
                setScheduleData={setScheduleEvents}
            />
        )}
        {isToday(currentDate) && <StatusUpdates staffData={filteredStaff} statuses={filteredStatuses} />}
      </div>
    </div>
  );
}
