
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
  const { appliedSelectedStaffIds } = useSelectedStaff();

  const filteredStaff = React.useMemo(() => {
    if (isLoading || !profile) return [];

    if (profile.role === 'admin') {
        // If no staff are selected via the filter, show all
        if (appliedSelectedStaffIds.length === 0) {
            return allStaffData;
        }
        // Filter based on admin's selection
        return allStaffData.filter(staff => appliedSelectedStaffIds.includes(staff.id));
    }
    // For staff, only show their own data
    return allStaffData.filter(staff => staff.id === profile.id);
  }, [appliedSelectedStaffIds, profile, isLoading]);

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
        <h1 className="text-2xl font-semibold tracking-tight">管理者ダッシュボード</h1>
        <p className="text-muted-foreground">
          スタッフのスケジュールと現在の状況を一覧で確認できます。
        </p>
      </div>
      <div className="flex flex-col gap-8">
        <ScheduleView 
            staffData={filteredStaff} 
            customerData={customers} 
            scheduleData={scheduleData}
            ordersData={orders}
            setScheduleData={setScheduleData}
            setOrdersData={setOrders}
        />
        <StatusUpdates staffData={filteredStaff} statuses={statuses} />
      </div>
    </div>
  );
}
