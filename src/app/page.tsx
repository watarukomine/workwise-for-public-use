
'use client';

import * as React from 'react';
import { ScheduleView } from '@/components/dashboard/schedule-view';
import { StatusUpdates } from '@/components/dashboard/status-updates';
import { customerData, staffStatusData } from '@/lib/data';
import type { Customer, ScheduleEvent, StaffStatus, WithId, Staff } from '@/lib/types';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useOrder } from '@/contexts/order-context';
import { format, startOfToday } from 'date-fns';

const getTodayStorageKey = () => {
    const today = format(startOfToday(), 'yyyy-MM-dd');
    return `scheduleData-${today}`;
};

export default function DashboardPage() {
  const [customers] = React.useState<WithId<Customer>[]>(customerData);
  
  const [scheduleData, setScheduleData] = React.useState<WithId<ScheduleEvent>[]>(() => {
      if (typeof window === 'undefined') return [];
      try {
          // 古いキーを削除
          Object.keys(localStorage).forEach(key => {
              if (key.startsWith('scheduleData-') && key !== getTodayStorageKey()) {
                  localStorage.removeItem(key);
              }
          });
          const savedData = localStorage.getItem(getTodayStorageKey());
          return savedData ? JSON.parse(savedData) : [];
      } catch (error) {
          console.error("Failed to parse schedule data from localStorage", error);
          return [];
      }
  });

  const { orders: rawOrders, isLoading: isLoadingOrders } = useOrder();
  
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { allStaff, appliedSelectedStaffIds, isLoading: isStaffLoading } = useSelectedStaff();

  React.useEffect(() => {
      try {
          if (typeof window !== 'undefined') {
              localStorage.setItem(getTodayStorageKey(), JSON.stringify(scheduleData));
          }
      } catch (error) {
          console.error("Failed to save schedule data to localStorage", error);
      }
  }, [scheduleData]);

  // 「スタッフ管理」で選択されたスタッフのみをフィルタリングし、「母店」で並び替え
  const filteredStaff = React.useMemo(() => {
    if (isProfileLoading || isStaffLoading || !profile) return [];

    const staffToUse = allStaff;

    let selectedStaff: WithId<Staff>[];

    // 管理者でない場合は、自分自身のみ表示
    if (profile.role !== 'admin') {
      selectedStaff = staffToUse.filter(staff => staff.id === profile.id);
    } else {
      // 管理者の場合、選択がなければ全員表示
      if (appliedSelectedStaffIds.length === 0) {
        selectedStaff = staffToUse;
      } else {
        // 選択があれば、そのスタッフのみ表示
        selectedStaff = staffToUse.filter(staff => appliedSelectedStaffIds.includes(staff.id));
      }
    }

    // 母店でソートする
    const areaOrder: { [key: string]: number } = {
      '横浜店': 1,
      '東名川崎店': 2,
      '綾瀬店': 3,
    };

    return selectedStaff.sort((a, b) => {
      const areaA = a['母店'] || '';
      const areaB = b['母店'] || '';
      const orderA = areaOrder[areaA] || 99; // 未定義のエリアは最後に
      const orderB = areaOrder[areaB] || 99;
      return orderA - orderB;
    });

  }, [appliedSelectedStaffIds, profile, isProfileLoading, allStaff, isStaffLoading]);
  
  // フィルタリングされたスタッフに基づいてステータスもフィルタリング
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ダッシュボード</h1>
        <p className="text-muted-foreground">
          スタッフのスケジュールと現在の状況を一覧で確認できます。
        </p>
         {selectedStaffNames && (
          <div className="mt-4 rounded-lg bg-muted p-3">
              <p className="text-sm font-medium text-muted-foreground">
                <span className="font-semibold text-foreground">表示中のスタッフ:</span> {selectedStaffNames}
              </p>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-8">
        <ScheduleView 
            staffData={filteredStaff} 
            customerData={customers} 
            scheduleData={scheduleData}
            rawOrdersData={rawOrders}
            setScheduleData={setScheduleData}
        />
        <StatusUpdates staffData={filteredStaff} statuses={filteredStatuses} />
      </div>
    </div>
  );
}
