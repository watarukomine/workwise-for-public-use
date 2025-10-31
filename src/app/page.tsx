'use client';

import * as React from 'react';
import { ScheduleView } from '@/components/dashboard/schedule-view';
import { StatusUpdates } from '@/components/dashboard/status-updates';
import { customerData, staffStatusData } from '@/lib/data';
import type { Customer, ScheduleEvent, StaffStatus, WithId, Staff } from '@/lib/types';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useOrder } from '@/contexts/order-context';
import { format, startOfToday, addDays, subDays, isToday, isEqual, startOfDay, isValid } from 'date-fns';

const getStorageKey = (date: Date) => {
    return `scheduleData-${format(date, 'yyyy-MM-dd')}`;
};


export default function DashboardPage() {
  const [customers] = React.useState<WithId<Customer>[]>(customerData);
  const [currentDate, setCurrentDate] = React.useState(startOfToday());

  const [scheduleData, setScheduleData] = React.useState<WithId<ScheduleEvent>[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const savedData = localStorage.getItem(getStorageKey(currentDate));
      return savedData ? JSON.parse(savedData) : [];
    } catch (error) {
      console.error("Failed to parse schedule data from localStorage", error);
      return [];
    }
  });

  const { orders: rawOrders, isLoading: isLoadingOrders } = useOrder();
  
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { allStaff, appliedSelectedStaffIds, isLoading: isStaffLoading } = useSelectedStaff();
  
  // Update schedule data when date changes
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
        try {
            const savedData = localStorage.getItem(getStorageKey(currentDate));
            setScheduleData(savedData ? JSON.parse(savedData) : []);
        } catch (error) {
            console.error("Failed to parse schedule data for new date", error);
            setScheduleData([]);
        }
    }
  }, [currentDate]);


  React.useEffect(() => {
      try {
          if (typeof window !== 'undefined') {
              localStorage.setItem(getStorageKey(currentDate), JSON.stringify(scheduleData));
          }
      } catch (error) {
          console.error("Failed to save schedule data to localStorage", error);
      }
  }, [scheduleData, currentDate]);

  const filteredStaff = React.useMemo(() => {
    if (isProfileLoading || isStaffLoading || !profile) return [];

    const staffToUse = allStaff;

    let selectedStaff: WithId<Staff>[];

    if (profile.role !== 'admin') {
      selectedStaff = staffToUse.filter(staff => staff.id === profile.id);
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

  const isLoading = isProfileLoading || isLoadingOrders || isStaffLoading;

  const handleDateChange = (direction: 'next' | 'prev' | 'today') => {
      setCurrentDate(current => {
          if (direction === 'today') return startOfToday();
          return direction === 'next' ? addDays(current, 1) : subDays(current, 1);
      });
  };
  
  const dailySchedule = React.useMemo(() => {
    if (!scheduleData) return [];
    return scheduleData.filter(event => {
        const eventDate = typeof event.start === 'string' ? new Date(event.start) : event.start;
        return isValid(eventDate) && isEqual(startOfDay(eventDate), startOfDay(currentDate));
    });
  }, [scheduleData, currentDate]);


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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => handleDateChange('prev')}>
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => handleDateChange('today')} disabled={isToday(currentDate)}>今日</Button>
            <Button variant="outline" size="icon" onClick={() => handleDateChange('next')}>
                <ChevronRight className="h-4 w-4" />
            </Button>
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
        <ScheduleView 
            staffData={filteredStaff} 
            customerData={customers} 
            scheduleData={dailySchedule}
            rawOrdersData={rawOrders}
            setScheduleData={setScheduleData}
            currentDate={currentDate}
        />
        {isToday(currentDate) && <StatusUpdates staffData={filteredStaff} statuses={filteredStatuses} />}
      </div>
    </div>
  );
}
