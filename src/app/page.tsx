'use client';

import * as React from 'react';
import { ScheduleView } from '@/components/dashboard/schedule-view';
import { StatusUpdates } from '@/components/dashboard/status-updates';
import { customerData, scheduleData as initialScheduleData, unassignedOrdersData, staffStatusData } from '@/lib/data';
import type { Customer, Order, ScheduleEvent, Staff, StaffStatus, WithId } from '@/lib/types';
import { useSelectedStaff } from '@/contexts/selected-staff-context';

export default function DashboardPage() {
  const [customers] = React.useState<WithId<Customer>[]>(customerData);
  const [scheduleData, setScheduleData] = React.useState<WithId<ScheduleEvent>[]>(initialScheduleData);
  const [orders, setOrders] = React.useState<WithId<Order>[]>(unassignedOrdersData);
  const [statuses] = React.useState<StaffStatus[]>(staffStatusData);
  const { appliedSelectedStaffIds, allStaff } = useSelectedStaff();

  const filteredStaff = React.useMemo(() => {
    if (appliedSelectedStaffIds.length === 0) {
      return allStaff; // If no staff are selected, show all from context
    }
    return allStaff.filter(staff => appliedSelectedStaffIds.includes(staff.id));
  }, [appliedSelectedStaffIds, allStaff]);


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
