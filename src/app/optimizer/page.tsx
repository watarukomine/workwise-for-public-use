
"use client";
import * as React from 'react';
import { RouteOptimizer, type Location } from "@/components/optimizer/route-optimizer";
import { RouteMap } from "@/components/optimizer/route-map";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import type { OptimizeRouteOutput } from '@/ai/flows/optimize-route-for-efficiency';
import type { Customer, Staff, StaffStatus, WithId, ScheduleEvent } from '@/lib/types';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { useUserProfile } from '@/hooks/use-user-profile';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCustomer } from '@/contexts/customer-context';
import { useOrder } from '@/contexts/order-context';
import { findKey } from '@/lib/utils';


function OptimizerPageContent() {
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { customers: allCustomers, isLoading: isLoadingCustomers } = useCustomer();
  const { rawOrdersData: rawOrders, isLoading: isLoadingOrders } = useOrder();
  const { appliedSelectedStaffIds, allStaff, isLoading: isStaffLoading } = useSelectedStaff();
  
  const [optimizedRoute, setOptimizedRoute] = React.useState<OptimizeRouteOutput | null>(null);
  const [avoidHighways, setAvoidHighways] = React.useState(false);
  const placesLibrary = useMapsLibrary("places");

  const filteredStaffFromSelection = React.useMemo(() => {
    if (isStaffLoading || !allStaff) return [];
    if (appliedSelectedStaffIds.length === 0) {
      return allStaff;
    }
    const selectedIds = new Set(appliedSelectedStaffIds);
    return allStaff.filter(s => selectedIds.has(s.id));
  }, [appliedSelectedStaffIds, allStaff, isStaffLoading]);
  
  const statuses: StaffStatus[] = React.useMemo(() => {
    const orders = rawOrders || [];
    if (!filteredStaffFromSelection.length || !orders.length) {
        return filteredStaffFromSelection.map(sf => ({
            staffId: sf.id,
            status: '待機中',
            lastAction: '現在地情報なし',
        }));
    }

    const staffStatusMap = new Map<string, StaffStatus>();

    // Initialize with default status
    for (const staff of filteredStaffFromSelection) {
        staffStatusMap.set(staff.id, {
            staffId: staff.id,
            status: '待機中',
            lastAction: '現在地情報なし',
        });
    }

    // Process orders to find the latest status for each staff member
    for (const order of orders) {
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
  }, [filteredStaffFromSelection, rawOrders, allStaff]);

  const staffWithLocation = React.useMemo(() => {
      return filteredStaffFromSelection.filter(staffMember => {
          const status = statuses.find(s => s.staffId === staffMember.id);
          return status && status.latitude && status.longitude;
      });
  }, [filteredStaffFromSelection, statuses]);


  const handleRouteOptimized = (data: OptimizeRouteOutput | null, options: { avoidHighways: boolean }) => {
    setOptimizedRoute(data);
    setAvoidHighways(options.avoidHighways);
  }
  
  const baseIsLoading = isProfileLoading || isStaffLoading || isLoadingCustomers || isLoadingOrders;

  const mapLocations = React.useMemo(() => {
    const staffLocs = filteredStaffFromSelection
      .map(staffMember => {
        const status = statuses.find(s => s.staffId === staffMember.id);
        return status && status.latitude && status.longitude ? { ...staffMember, ...status } : null;
      })
      .filter((s): s is Staff & StaffStatus => s !== null);

    const customLocationsInRoute = optimizedRoute?.optimizedRoute.filter(r => r.type === 'custom') || [];

    return { 
        staff: staffLocs, 
        customers: allCustomers || [], 
        route: optimizedRoute?.optimizedRoute || [], 
        custom: customLocationsInRoute
    };

  }, [filteredStaffFromSelection, allCustomers, statuses, optimizedRoute]);

  if (baseIsLoading) {
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
            {!placesLibrary ? (
              <div className="flex items-center justify-center p-10 rounded-lg border border-dashed">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
                <RouteOptimizer 
                    onRouteOptimized={handleRouteOptimized}
                    staff={staffWithLocation}
                    staffStatus={statuses}
                    allCustomers={allCustomers || []}
                    placesLibraryReady={!!placesLibrary}
                />
            )}
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
      <OptimizerPageContent />
    </APIProvider>
  );
}
