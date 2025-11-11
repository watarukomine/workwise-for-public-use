'use client';

import * as React from 'react';
import { ScheduleView } from '@/components/dashboard/schedule-view';
import type { Customer, WithId, Staff, StaffStatus, Order } from '@/lib/types';
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
import { findKey, mapRawToOrder } from '@/lib/utils';
import { useCustomer } from '@/contexts/customer-context';


export default function DashboardPage() {
  const [currentDate, setCurrentDate] = React.useState(startOfToday());
  
  const { 
    orders: rawOrders, 
    isLoading: isLoadingOrders,
    scheduleEvents,
    setScheduleEvents
  } = useOrder();
  
  const { customers: allCustomers } = useCustomer();
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
  
  const statuses: StaffStatus[] = React.useMemo(() => {
    if (!filteredStaff.length || !rawOrders.length) {
        return filteredStaff.map(sf => ({
            staffId: sf.id,
            status: '待機中',
            lastAction: '現在地情報なし',
        }));
    }

    const staffStatusMap = new Map<string, StaffStatus>();

    for (const staff of filteredStaff) {
        staffStatusMap.set(staff.id, {
            staffId: staff.id,
            status: '待機中',
            lastAction: '現在地情報なし',
        });
    }

    for (const order of rawOrders) {
        const staffName = findKey(order, ['担当']);
        const staffMember = allStaff.find(s => s.name === staffName);
        if (!staffMember || !staffStatusMap.has(staffMember.id)) continue;

        const lastUpdateStr = findKey(order, ['最終更新日時']);
        const lastUpdate = lastUpdateStr ? new Date(lastUpdateStr) : new Date(0);

        const currentStatus = staffStatusMap.get(staffMember.id)!;
        const currentUpdate = currentStatus.lastUpdate ? new Date(currentStatus.lastUpdate) : new Date(0);

        if (lastUpdate.getTime() >= currentUpdate.getTime()) {
            const locationStr: string = findKey(order, ['最終位置情報（緯度,経度）']) || '';
            const [lat, lon] = locationStr.split(',').map(s => parseFloat(s.trim()));
            
            staffStatusMap.set(staffMember.id, {
                staffId: staffMember.id,
                status: findKey(order, ['受注ステータス']) || '待機中',
                lastAction: `[${findKey(order, ['受注 ID', 'id'])}] ${findKey(order, ['受注ステータス'])}`,
                latitude: !isNaN(lat) ? lat : undefined,
                longitude: !isNaN(lon) ? lon : undefined,
                lastUpdate: lastUpdate.toISOString(),
            });
        }
    }
    
    return Array.from(staffStatusMap.values());
  }, [filteredStaff, rawOrders, allStaff]);

  const isLoading = isProfileLoading || isLoadingOrders || isStaffLoading;

  const handleDateChange = (direction: 'next' | 'prev' | 'today') => {
      setCurrentDate(current => {
          if (direction === 'today') return startOfToday();
          return direction === 'next' ? addDays(current, 1) : subDays(current, 1);
      });
  };

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
        
         {profile.role === 'admin' && appliedSelectedStaffIds.length > 0 && (
          <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-medium text-muted-foreground">
                <span className="font-semibold text-foreground">表示中のスタッフ:</span>{' '}
                {appliedSelectedStaffIds.length === allStaff.length ? "全スタッフ" : allStaff.filter(s => appliedSelectedStaffIds.includes(s.id)).map(s => s.name).join('、')}
              </p>
          </div>
        )}

        {showVerticalView ? (
            <VerticalScheduleView 
                scheduleData={scheduleEvents}
                staffData={filteredStaff}
            />
        ) : (
          <ScheduleView 
              staffData={filteredStaff} 
              rawOrdersData={rawOrders}
              currentDate={currentDate}
              statuses={statuses}
          />
        )}
      </div>
  );
}
