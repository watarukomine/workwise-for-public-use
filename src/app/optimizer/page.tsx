
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
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';


function OptimizerPageContent() {
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { customers: allCustomers, isLoading: isLoadingCustomers } = useCustomer();
  const { rawOrdersData: _rawOrders, isLoading: isLoadingOrders } = useOrder();
  const { appliedSelectedStaffIds, allStaff, isLoading: isStaffLoading } = useSelectedStaff();
  const router = useRouter();

  const [optimizedRoute, setOptimizedRoute] = React.useState<OptimizeRouteOutput | null>(null);
  const [avoidHighways, setAvoidHighways] = React.useState(false);
  const placesLibrary = useMapsLibrary("places");

  useEffect(() => {
    if (!isProfileLoading && !profile) {
      router.push('/login');
    }
  }, [isProfileLoading, profile, router]);

  const filteredStaffFromSelection = React.useMemo(() => {
    if (isStaffLoading || !allStaff) return [];
    if (appliedSelectedStaffIds.length === 0) {
      return allStaff;
    }
    const selectedIds = new Set(appliedSelectedStaffIds);
    return allStaff.filter(s => selectedIds.has(s.id));
  }, [appliedSelectedStaffIds, allStaff, isStaffLoading]);

  const { statuses: contextStatuses } = useOrder();

  const statuses: StaffStatus[] = React.useMemo(() => {
    // Filter context statuses to only include selected staff
    if (!contextStatuses) return [];

    // Create a map for quick lookup
    const statusMap = new Map(contextStatuses.map(s => [s.staffId, s]));

    return filteredStaffFromSelection.map(staff => {
      const existingStatus = statusMap.get(staff.id);
      if (existingStatus) return existingStatus;

      return {
        staffId: staff.id,
        status: '待機中',
        lastAction: '現在地情報なし',
      };
    });
  }, [filteredStaffFromSelection, contextStatuses]);

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
        return status && status.latitude && status.longitude ? { ...staffMember, ...status, type: 'staff' as const } : null;
      })
      .filter((s): s is Staff & StaffStatus & { type: 'staff' } => s !== null);

    const customLocationsInRoute = optimizedRoute?.optimizedRoute
      .filter(r => r.type === 'custom')
      .map(r => ({ ...r, type: 'custom' as const })) || [];

    const routeLocations = optimizedRoute?.optimizedRoute.map(r => ({
      ...r,
      type: r.type || 'custom'
    })) || [];

    return {
      staff: staffLocs,
      customers: allCustomers || [],
      route: routeLocations,
      custom: customLocationsInRoute
    };

  }, [filteredStaffFromSelection, allCustomers, statuses, optimizedRoute]);

  if (baseIsLoading || !profile) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
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
