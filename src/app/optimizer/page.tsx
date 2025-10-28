
"use client";
import * as React from 'react';
import { RouteOptimizer } from "@/components/optimizer/route-optimizer";
import { RouteMap } from "@/components/optimizer/route-map";
import { APIProvider } from "@vis.gl/react-google-maps";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { OptimizeRouteOutput } from '@/ai/flows/optimize-route-for-efficiency';
import type { Customer, Staff, StaffStatus } from '@/lib/types';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { customerData, staffStatusData } from '@/lib/data'; // Use static data
import { useUserProfile } from '@/hooks/use-user-profile';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function OptimizerPage() {
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [optimizedRoute, setOptimizedRoute] = React.useState<OptimizeRouteOutput | null>(null);
  const [avoidHighways, setAvoidHighways] = React.useState(false);
  const [customers, setCustomers] = React.useState<Customer[]>(customerData);
  const [statuses, setStatuses] = React.useState<StaffStatus[]>(staffStatusData);

  const { appliedSelectedStaffIds, allStaff } = useSelectedStaff();
  
  const filteredStaff = React.useMemo(() => {
    if (appliedSelectedStaffIds.length === 0) {
      return allStaff;
    }
    const selectedIds = new Set(appliedSelectedStaffIds);
    return allStaff.filter(s => selectedIds.has(s.id));
  }, [appliedSelectedStaffIds, allStaff]);
  
  const staffWithStatus = React.useMemo(() => {
    return filteredStaff.map(staffMember => {
      const status = statuses.find(s => s.staffId === staffMember.id);
      return status ? { ...staffMember, ...status } : null;
    }).filter((s): s is (Staff & StaffStatus) => s !== null);
  }, [filteredStaff, statuses]);

  const handleRouteOptimized = (data: OptimizeRouteOutput | null, options: { avoidHighways: boolean }) => {
    setOptimizedRoute(data);
    setAvoidHighways(options.avoidHighways);
  }
  
  const isLoading = isProfileLoading;

  if (isLoading) {
    return <p>Loading...</p>
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
            customers={customers}
          />
        </div>
        <div className="lg:col-span-2">
          {apiKey ? (
            <APIProvider apiKey={apiKey}>
               {isLoading ? (
                 <p>Loading map...</p>
               ) : (
                <RouteMap 
                  staff={staffWithStatus} 
                  customers={customers || []} 
                  optimizedRoute={optimizedRoute?.optimizedRoute}
                  avoidHighways={avoidHighways}
                />
               )}
            </APIProvider>
          ) : (
            <div className="flex items-center justify-center h-full rounded-lg border border-dashed shadow-sm">
                <Alert variant="destructive" className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Google Maps APIキーがありません</AlertTitle>
                    <AlertDescription>
                        Google Maps APIキーが設定されていません。地図を表示するには、<code>.env.local</code>ファイルに<code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>として追加してください。
                    </AlertDescription>
                </Alert>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
