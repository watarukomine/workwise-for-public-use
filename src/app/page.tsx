
'use client';

import * as React from 'react';
import { ScheduleView } from '@/components/dashboard/schedule-view';
import { StatusUpdates } from '@/components/dashboard/status-updates';
import { customerData, staffStatusData, staffData as allStaffData } from '@/lib/data';
import type { Customer, Order, ScheduleEvent, StaffStatus, WithId } from '@/lib/types';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useOrder } from '@/contexts/order-context';
import { isToday, parseISO, isValid } from 'date-fns';

const parseDate = (dateString: any): Date | null => {
  if (!dateString || typeof dateString !== 'string') return null;
  const date = parseISO(dateString);
  return isValid(date) ? date : null;
};

// Map raw order data from GAS to a structured Order object
const mapRawToOrder = (rawOrder: any): WithId<Order> => {
  const duration = parseInt(rawOrder['作業時間（分）'], 10);
  return {
    id: String(rawOrder['No.'] || rawOrder.id || `ord-${Math.random()}`),
    customerCode: String(rawOrder['ユーザーコード'] || ''),
    taskDetails: `${rawOrder['お取引先']}: ${rawOrder['作業内容'] || '未定義のタスク'}`,
    estimatedDuration: !isNaN(duration) && duration > 0 ? duration : 60,
    raw: rawOrder,
  };
};

export default function DashboardPage() {
  const [customers] = React.useState<WithId<Customer>[]>(customerData);
  const [scheduleData, setScheduleData] = React.useState<WithId<ScheduleEvent>[]>([]);
  
  const { orders: rawOrders, isLoading: isLoadingOrders } = useOrder();
  
  const [orders, setOrders] = React.useState<WithId<Order>[]>([]);
  const [statuses] = React.useState<StaffStatus[]>(staffStatusData);

  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { allStaff, appliedSelectedStaffIds } = useSelectedStaff();

  // Filter orders for today and map them to the Order type
  React.useEffect(() => {
    if (rawOrders && rawOrders.length > 0) {
      const filteredAndMapped = rawOrders
        .filter(order => {
          const scheduledDate = parseDate(order['作業予定日']);
          const receptionDate = parseDate(order['受付日']);
          const isScheduledForToday = scheduledDate ? isToday(scheduledDate) : false;
          const isReceivedToday = receptionDate ? isToday(receptionDate) : false;
          return isScheduledForToday || isReceivedToday;
        })
        .map(mapRawToOrder);
      setOrders(filteredAndMapped);
    } else {
      setOrders([]);
    }
  }, [rawOrders]);

  const filteredStaff = React.useMemo(() => {
    if (isProfileLoading || !profile) return [];

    const staffToUse = allStaff.length > 0 ? allStaff : allStaffData;

    if (profile.role === 'admin') {
        if (appliedSelectedStaffIds.length === 0) {
            return staffToUse;
        }
        return staffToUse.filter(staff => appliedSelectedStaffIds.includes(staff.id));
    }
    return staffToUse.filter(staff => staff.id === profile.id);
  }, [appliedSelectedStaffIds, profile, isProfileLoading, allStaff]);
  
  const filteredSchedule = React.useMemo(() => {
    const selectedIds = new Set(filteredStaff.map(s => s.id));
    return scheduleData.filter(event => selectedIds.has(event.staffId));
  }, [filteredStaff, scheduleData]);

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

  const isLoading = isProfileLoading || isLoadingOrders;

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
