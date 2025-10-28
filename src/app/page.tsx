
'use client';

import * as React from 'react';
import { ScheduleView } from '@/components/dashboard/schedule-view';
import { StatusUpdates } from '@/components/dashboard/status-updates';
import { customerData, scheduleData as initialScheduleData, unassignedOrdersData, staffStatusData, staffData as allStaffData } from '@/lib/data';
import type { Customer, Order, ScheduleEvent, StaffStatus, WithId } from '@/lib/types';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const [customers] = React.useState<WithId<Customer>[]>(customerData);
  const [scheduleData, setScheduleData] = React.useState<WithId<ScheduleEvent>[]>(initialScheduleData);
  const [orders, setOrders] = React.useState<WithId<Order>[]>(unassignedOrdersData);
  const [statuses] = React.useState<StaffStatus[]>(staffStatusData);

  const { profile, isLoading } = useUserProfile();
  const { allStaff, appliedSelectedStaffIds } = useSelectedStaff();

  const filteredStaff = React.useMemo(() => {
    if (isLoading || !profile) return [];

    const staffToUse = allStaff.length > 0 ? allStaff : allStaffData;

    if (profile.role === 'admin') {
        if (appliedSelectedStaffIds.length === 0) {
            return staffToUse;
        }
        return staffToUse.filter(staff => appliedSelectedStaffIds.includes(staff.id));
    }
    return staffToUse.filter(staff => staff.id === profile.id);
  }, [appliedSelectedStaffIds, profile, isLoading, allStaff]);
  
  const filteredSchedule = React.useMemo(() => {
    const selectedIds = new Set(filteredStaff.map(s => s.id));
    return initialScheduleData.filter(event => selectedIds.has(event.staffId));
  }, [filteredStaff]);

  const filteredStatuses = React.useMemo(() => {
    const selectedIds = new Set(filteredStaff.map(s => s.id));
    return staffStatusData.filter(status => selectedIds.has(status.staffId));
  }, [filteredStaff]);


  const selectedStaffNames = React.useMemo(() => {
    if (profile?.role !== 'admin' || appliedSelectedStaffIds.length === 0) {
      return null;
    }
    const staffToUse = allStaff.length > 0 ? allStaff : allStaffData;
    if (appliedSelectedStaffIds.length === staffToUse.length) {
      return "全スタッフ";
    }
    const selectedStaff = staffToUse.filter(s => appliedSelectedStaffIds.includes(s.id));
    return selectedStaff.map(s => s.name).join('、');
  }, [allStaff, appliedSelectedStaffIds, profile]);

  if (isLoading) {
      return <div>Loading...</div>
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
            scheduleData={filteredSchedule}
            ordersData={orders}
            setScheduleData={setScheduleData}
            setOrdersData={setOrders}
        />
        <StatusUpdates staffData={filteredStaff} statuses={filteredStatuses} />
      </div>
    </div>
  );
}
