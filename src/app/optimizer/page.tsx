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
import { useCustomer } from '@/contexts/customer-context';
import { useOrder } from '@/contexts/order-context';
import { updateSheetStatus } from '@/app/actions/gas-actions';
import { ORDER_GAS_URL } from '@/lib/settings';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getStoreLocation } from '@/lib/utils';


function OptimizerPageContent() {
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { customers: allCustomers, isLoading: isLoadingCustomers } = useCustomer();
  const { rawOrdersData: _rawOrders, isLoading: isLoadingOrders, statuses: contextStatuses, orders, refetchOrders } = useOrder();
  const { allStaff, isLoading: isStaffLoading } = useSelectedStaff();
  const router = useRouter();

  const [optimizedRoute, setOptimizedRoute] = React.useState<OptimizeRouteOutput | null>(null);
  const [avoidHighways, setAvoidHighways] = React.useState(false);
  const [_isApplying, setIsApplying] = React.useState(false);
  const { toast } = useToast();
  const placesLibrary = useMapsLibrary("places");

  useEffect(() => {
    if (!isProfileLoading && !profile) {
      router.push('/login');
    }
  }, [isProfileLoading, profile, router]);

  useEffect(() => {
    if (allStaff && allStaff.length > 0) {
      console.group('📡 [API リアルタイム位置信号デバッグログ]');
      console.table(allStaff.map(s => ({
        ID: s.id,
        名前: s.name,
        母店: (s as any)['母店'] || (s as any).mainStore || (s as any).storeName || '-',
        緯度: (s as any).latitude ?? '-',
        経度: (s as any).longitude ?? '-',
        最終位置更新日時: (s as any).lastLocationUpdatedAt || (s as any).statusUpdatedAt || (s as any).updatedAt || '-',
        ステータス: (s as any).currentStatus || (s as any).status || '-'
      })));
      console.groupEnd();
    }
  }, [allStaff]);

  // Extract ONLY staff who have updated location TODAY via check-in or location update
  const staffWithLocation = React.useMemo(() => {
    if (!allStaff || allStaff.length === 0) return [];

    const isUpdatedToday = (dateInput: any): boolean => {
      if (!dateInput) return false;
      try {
        let timeMs = 0;
        let d: Date | null = null;
        if (typeof dateInput === 'string') {
          d = new Date(dateInput);
          timeMs = d.getTime();
        } else if (typeof dateInput === 'number') {
          timeMs = dateInput.toString().length === 10 ? dateInput * 1000 : dateInput;
          d = new Date(timeMs);
        } else if (dateInput instanceof Date) {
          d = dateInput;
          timeMs = d.getTime();
        } else if (typeof dateInput === 'object' && dateInput !== null) {
          if (typeof dateInput.seconds === 'number') {
            timeMs = dateInput.seconds * 1000;
            d = new Date(timeMs);
          } else if (typeof dateInput.toDate === 'function') {
            d = dateInput.toDate();
            if (d) timeMs = d.getTime();
          }
        }

        if (isNaN(timeMs) || timeMs === 0 || !d) return false;

        const now = new Date();
        const diffHours = (now.getTime() - timeMs) / (1000 * 60 * 60);

        // Check if within last 24 hours OR same calendar date (Local/UTC)
        const isSameLocal = d.getFullYear() === now.getFullYear() &&
                            d.getMonth() === now.getMonth() &&
                            d.getDate() === now.getDate();

        const isSameUtc = d.getUTCFullYear() === now.getUTCFullYear() &&
                           d.getUTCMonth() === now.getUTCMonth() &&
                           d.getUTCDate() === now.getUTCDate();

        return (diffHours >= -2 && diffHours <= 20) || isSameLocal || isSameUtc;
      } catch {
        return false;
      }
    };

    return allStaff
      .map(staffMember => {
        const status = contextStatuses?.find(s => s.staffId === staffMember.id || (s.staffId && (staffMember as any)._docId && s.staffId === (staffMember as any)._docId));

        const parseCoord = (val: any): number | null => {
          if (val === undefined || val === null || val === '') return null;
          const num = Number(val);
          return !isNaN(num) && num !== 0 ? num : null;
        };

        const displayName = staffMember.name || (staffMember as any)['氏名'] || (staffMember as any)['名前'] || (staffMember as any)['担当'] || '名前未設定';
        const currentStatus = String((staffMember as any).currentStatus || status?.status || '').trim();

        // 1. Exclude off-duty, logged out, or un-clocked-in staff
        const isInactive =
          currentStatus === 'ログアウト' ||
          currentStatus === '退勤' ||
          currentStatus === '未出勤' ||
          (staffMember as any).isOnline === false ||
          (staffMember as any).isAttending === false;

        if (isInactive) {
          return null;
        }

        // 2. Extract location coordinates updated directly on user profile
        let rawStrLat: number | null = null;
        let rawStrLng: number | null = null;
        const locStr = (staffMember as any).lastLocation || (staffMember as any).location;
        if (typeof locStr === 'string' && locStr.includes(',')) {
          const parts = locStr.split(',').map(p => parseFloat(p.trim()));
          if (!isNaN(parts[0]) && !isNaN(parts[1])) {
            rawStrLat = parts[0];
            rawStrLng = parts[1];
          }
        }

        const actualLat = parseCoord((staffMember as any).latitude) ?? parseCoord((staffMember as any).lat) ?? rawStrLat;
        const actualLng = parseCoord((staffMember as any).longitude) ?? parseCoord((staffMember as any).lng) ?? rawStrLng;

        if (actualLat === null || actualLng === null) {
          return null;
        }

        // 3. MUST have location updated TODAY (from check-in / location update timestamp)
        const locTime = (staffMember as any).lastLocationUpdatedAt || (staffMember as any).statusUpdatedAt || (staffMember as any).updatedAt;
        const isTodayUpdated = isUpdatedToday(locTime);

        // Exclude anyone who has NOT updated location TODAY (like DEMO2 from past sessions)
        if (!isTodayUpdated) {
          return null;
        }

        console.log('[Optimizer Staff Filter Active]', {
          name: displayName,
          id: staffMember.id,
          status: currentStatus,
          lat: actualLat,
          lng: actualLng
        });

        return {
          ...staffMember,
          ...status,
          id: staffMember.id,
          name: displayName,
          latitude: actualLat,
          longitude: actualLng,
          lastAction: (staffMember as any).lastAction || status?.lastAction || currentStatus || '現在地'
        };
      })
      .filter((s): s is WithId<Staff> & { latitude: number; longitude: number; lastAction: string } =>
        s !== null && s !== undefined && typeof s.latitude === 'number' && typeof s.longitude === 'number' && !isNaN(s.latitude) && !isNaN(s.longitude)
      );
  }, [allStaff, contextStatuses]);

  const handleRouteOptimized = (data: OptimizeRouteOutput | null, options: { avoidHighways: boolean }) => {
    setOptimizedRoute(data);
    setAvoidHighways(options.avoidHighways);
  };

  const handleApplyToSchedule = async () => {
    if (!optimizedRoute || !optimizedRoute.optimizedRoute) return;

    setIsApplying(true);
    try {
      let updateCount = 0;
      for (const loc of optimizedRoute.optimizedRoute) {
        if (loc.orderId && typeof loc.travelTimeFromPrevious === 'number') {
          await updateSheetStatus({
            gasUrl: ORDER_GAS_URL,
            systemId: loc.orderId,
            travelTime: loc.travelTimeFromPrevious,
            travelDistance: loc.travelDistanceFromPrevious
          });
          updateCount++;
        }
      }

      if (updateCount > 0) {
        await refetchOrders();
        toast({ title: "スケジュールに適用しました", description: `${updateCount}件の移動時間を更新しました。` });
      } else {
        toast({ title: "更新対象がありません", description: "受注に関連付けられた経由地が見つかりませんでした。" });
      }
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: "適用に失敗しました", description: e.message });
    } finally {
      setIsApplying(false);
    }
  };

  const baseIsLoading = isProfileLoading || isStaffLoading || isLoadingCustomers || isLoadingOrders;

  const mapLocations = React.useMemo(() => {
    const customLocationsInRoute = optimizedRoute?.optimizedRoute
      .filter(r => r.type === 'custom')
      .map(r => ({ ...r, type: 'custom' as const })) || [];

    const routeLocations = optimizedRoute?.optimizedRoute.map(r => ({
      ...r,
      type: r.type || 'custom'
    })) || [];

    return {
      staff: staffWithLocation,
      customers: allCustomers || [],
      route: routeLocations,
      custom: customLocationsInRoute
    };
  }, [staffWithLocation, allCustomers, optimizedRoute]);

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
          出勤中スタッフの位置・拠点と複数の作業場所間の最も効率的なルートを生成します。
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
              staffStatus={contextStatuses || []}
              allCustomers={allCustomers || []}
              orders={orders}
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
            Google Maps APIキーが設定されていません。
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
