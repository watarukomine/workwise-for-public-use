
"use client";
import * as React from 'react';
import { RouteOptimizer, type Location } from "@/components/optimizer/route-optimizer";
import { RouteMap } from "@/components/optimizer/route-map";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import type { OptimizeRouteOutput } from '@/ai/flows/optimize-route-for-efficiency';
import type { Customer, Staff, StaffStatus, WithId } from '@/lib/types';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { useUserProfile } from '@/hooks/use-user-profile';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCustomer } from '@/contexts/customer-context';
import { useOrder } from '@/contexts/order-context';
import { findKey } from '@/lib/utils';

function OptimizerLayout() {
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const [optimizedRoute, setOptimizedRoute] = React.useState<OptimizeRouteOutput | null>(null);
  const [avoidHighways, setAvoidHighways] = React.useState(false);
  const { customers: allCustomers, isLoading: isLoadingCustomers } = useCustomer();
  const { orders: rawOrders, isLoading: isLoadingOrders } = useOrder();
  
  const { appliedSelectedStaffIds, allStaff, isLoading: isStaffLoading } = useSelectedStaff();
  
  const placesLibrary = useMapsLibrary('places');

  const scheduledCustomers = React.useMemo(() => {
    if (isLoadingOrders || isLoadingCustomers || !rawOrders || !allCustomers) {
      return [];
    }
    
    // For route optimization, we consider all customers present in the customer list,
    // not just those with orders today. This allows for more flexible planning.
    return allCustomers;
  
  }, [rawOrders, allCustomers, isLoadingOrders, isLoadingCustomers]);
  
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
      if (!optimizedRoute?.optimizedRoute) {
          const staffLocs = filteredStaff
              .map(staffMember => {
                  const status = statuses.find(s => s.staffId === staffMember.id);
                  return status && status.latitude && status.longitude ? { ...staffMember, ...status } : null;
              })
              .filter((s): s is Staff & StaffStatus => s !== null);

          return { staff: staffLocs, customers: scheduledCustomers, route: [] };
      }

      const routeIds = new Set(optimizedRoute.optimizedRoute.map(r => r.id));

      const routeStaff = filteredStaff
          .filter(s => routeIds.has(s.id))
          .map(staffMember => {
              const status = statuses.find(s => s.staffId === staffMember.id);
              return status ? { ...staffMember, ...status } : staffMember;
          });

      const routeCustomers = scheduledCustomers.filter(c => {
          const userCode = findKey(c, ['ユーザーコード']);
          return userCode && routeIds.has(String(userCode));
      });
      
      const customLocations: Location[] = optimizedRoute.optimizedRoute.filter(r => r.type === 'custom');

      return { staff: routeStaff, customers: routeCustomers, route: optimizedRoute.optimizedRoute, custom: customLocations };

  }, [filteredStaff, scheduledCustomers, statuses, optimizedRoute]);

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
              customers={scheduledCustomers}
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
