
"use client";
import * as React from 'react';
import { RouteOptimizer, type Location } from "@/components/optimizer/route-optimizer";
import { RouteMap } from "@/components/optimizer/route-map";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import type { OptimizeRouteOutput } from '@/ai/flows/optimize-route-for-efficiency';
import type { Customer, Staff, StaffStatus, WithId, Order, ScheduleEvent } from '@/lib/types';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { useUserProfile } from '@/hooks/use-user-profile';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCustomer } from '@/contexts/customer-context';
import { useOrder } from '@/contexts/order-context';
import { findKey, mapRawToOrder } from '@/lib/utils';
import { isToday, parseISO, isValid, isEqual, startOfDay, format } from 'date-fns';

const getStorageKey = (date: Date) => {
    return `scheduleData-${format(date, 'yyyy-MM-dd')}`;
};

function OptimizerLayout() {
  const placesLibrary = useMapsLibrary('places');

  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { customers: allCustomers, isLoading: isLoadingCustomers } = useCustomer();
  const { orders: rawOrders, isLoading: isLoadingOrders } = useOrder();
  const { appliedSelectedStaffIds, allStaff, isLoading: isStaffLoading } = useSelectedStaff();
  
  const [optimizedRoute, setOptimizedRoute] = React.useState<OptimizeRouteOutput | null>(null);
  const [avoidHighways, setAvoidHighways] = React.useState(false);
  const [scheduleData, setScheduleData] = React.useState<WithId<ScheduleEvent>[]>([]);
  const [currentDate, setCurrentDate] = React.useState(startOfDay(new Date()));

   React.useEffect(() => {
    if (typeof window !== 'undefined') {
        try {
            const key = getStorageKey(currentDate);
            const savedData = localStorage.getItem(key);
            setScheduleData(savedData ? JSON.parse(savedData) : []);
        } catch (error) {
            console.error("Failed to parse schedule data for new date", error);
            setScheduleData([]);
        }
    }
  }, [currentDate]);

  const todaysCustomers = React.useMemo(() => {
    if (isLoadingOrders || !rawOrders || !allCustomers) {
      return [];
    }

    const scheduledRawOrderIds = new Set(scheduleData.map(e => e.rawOrderId).filter(Boolean));
    const allMappedOrders = rawOrders.map(mapRawToOrder);

    const todaysUnassignedOrders = allMappedOrders.filter(order => {
        if (!order.rawOrderId) return false;
        
        if (scheduledRawOrderIds.has(order.rawOrderId)) return false;
        
        const scheduledDateKey = findKey(order.raw, ['作業予定日']);
        if (!scheduledDateKey) return false;

        const scheduledDate = parseISO(scheduledDateKey);
        return isValid(scheduledDate) && isEqual(startOfDay(scheduledDate), currentDate);
    });

    const todaysCustomerCodes = new Set(todaysUnassignedOrders.map(o => o.customerCode));

    return allCustomers.filter(c => {
        const customerUserCode = findKey(c, ['ユーザーコード', 'usercode']);
        return customerUserCode && todaysCustomerCodes.has(String(customerUserCode));
    });

  }, [rawOrders, allCustomers, isLoadingOrders, scheduleData, currentDate]);


  const filteredStaff = React.useMemo(() => {
    if (isStaffLoading || !allStaff) return [];
    if (appliedSelectedStaffIds.length === 0) {
      return allStaff;
    }
    const selectedIds = new Set(appliedSelectedStaffIds);
    return allStaff.filter(s => selectedIds.has(s.id));
  }, [appliedSelectedStaffIds, allStaff, isStaffLoading]);
  
  const statuses = React.useMemo(() => {
    return filteredStaff.map((staff, index) => ({
        staffId: staff.id,
        status: '待機中' as const,
        lastAction: '現在地で待機中',
        latitude: 35.45 + (index * 0.01), // Demo latitude around Yokohama
        longitude: 139.63 + (index * 0.01), // Demo longitude around Yokohama
    }));
  }, [filteredStaff]);

  const handleRouteOptimized = (data: OptimizeRouteOutput | null, options: { avoidHighways: boolean }) => {
    setOptimizedRoute(data);
    setAvoidHighways(options.avoidHighways);
  }
  
  const isLoading = isProfileLoading || isStaffLoading || isLoadingCustomers || isLoadingOrders || !placesLibrary;
  
  const mapLocations = React.useMemo(() => {
      const staffLocs = filteredStaff
          .map(staffMember => {
              const status = statuses.find(s => s.staffId === staffMember.id);
              return status && status.latitude && status.longitude ? { ...staffMember, ...status } : null;
          })
          .filter((s): s is Staff & StaffStatus => s !== null);

      if (!optimizedRoute?.optimizedRoute) {
          return { staff: staffLocs, customers: [], route: [] };
      }

      const routeIds = new Set(optimizedRoute.optimizedRoute.map(r => r.id));
      
      const routeCustomers = allCustomers.filter(c => {
          const userCode = findKey(c, ['ユーザーコード']);
          return userCode && routeIds.has(String(userCode));
      });

      const routeStaff = filteredStaff
          .filter(s => routeIds.has(s.id))
          .map(staffMember => {
              const status = statuses.find(s => s.staffId === staffMember.id);
              return status ? { ...staffMember, ...status } : staffMember;
          });
      
      const customLocations: Location[] = optimizedRoute.optimizedRoute.filter(r => r.type === 'custom');

      return { staff: routeStaff, customers: routeCustomers, route: optimizedRoute.optimizedRoute, custom: customLocations };

  }, [filteredStaff, allCustomers, statuses, optimizedRoute]);

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
          <AlertTitle>ログインしてください</AlertTitle>
          <AlertDescription>
            <p>このページを表示するにはログインが必要です。</p>
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
          <h1 className="text-2xl font-semibold tracking-tight">ルート最適化</h1>
          <p className="text-muted-foreground">
          複数の作業場所間の最も効率的なルートを生成します。
          </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <RouteOptimizer 
                onRouteOptimized={handleRouteOptimized}
                staff={filteredStaff}
                staffStatus={statuses}
                customers={allCustomers}
                todaysCustomers={todaysCustomers}
                rawOrders={rawOrders}
            />
          </div>
          <div className="lg:col-span-2">
            <RouteMap 
                staff={mapLocations.staff} 
                customers={mapLocations.customers}
                customLocations={mapLocations.custom}
                optimizedRoute={mapLocations.route}
                avoidHighways={avoidHighways}
            />
          </div>
      </div>
    </div>
  );
}


export default function OptimizerPage() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
        <div className="flex items-center justify-center h-full rounded-lg border border-dashed shadow-sm p-8">
            <Alert variant="destructive" className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Google Maps APIキーがありません</AlertTitle>
                <AlertDescription>
                    Google Maps APIキーが設定されていません。地図を表示するには、<code>.env.local</code>ファイルに<code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>として追加してください。
                </AlertDescription>
            </Alert>
        </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={['places']}>
      <OptimizerLayout />
    </APIProvider>
  );
}
