"use client";
import * as React from 'react';
import { RouteOptimizer } from "@/components/optimizer/route-optimizer";
import { RouteMap } from "@/components/optimizer/route-map";
import { APIProvider } from "@vis.gl/react-google-maps";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { OptimizeRouteOutput } from '@/ai/flows/optimize-route-for-efficiency';
import type { Customer, Staff, StaffStatus } from '@/lib/types';
import { customerData, staffData, staffStatusData } from '@/lib/data';
import { useSelectedStaff } from '@/contexts/selected-staff-context';

export default function OptimizerPage() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [optimizedRoute, setOptimizedRoute] = React.useState<OptimizeRouteOutput | null>(null);
  const [avoidHighways, setAvoidHighways] = React.useState(false);

  const [customers] = React.useState<Customer[]>(customerData);
  const { selectedStaffIds } = useSelectedStaff();

  const filteredStaff = React.useMemo(() => {
    if (selectedStaffIds.length === 0) {
      return staffData; // No selection, show all
    }
    return staffData.filter(s => selectedStaffIds.includes(s.id));
  }, [selectedStaffIds]);


  const staffWithStatus = React.useMemo(() => {
    return staffStatusData.map(status => {
      const staffDetails = filteredStaff.find(s => s.id === status.staffId);
      return staffDetails ? { ...staffDetails, ...status } as (Staff & StaffStatus) : null;
    }).filter((s): s is (Staff & StaffStatus) => s !== null);
  }, [filteredStaff]);

  const handleRouteOptimized = (data: OptimizeRouteOutput | null, options: { avoidHighways: boolean }) => {
    setOptimizedRoute(data);
    setAvoidHighways(options.avoidHighways);
  }
  
  const isLoading = !customers || !staffData;

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
          {isLoading ? (
            <p>Loading optimizer...</p>
          ) : (
            <RouteOptimizer 
              onRouteOptimized={handleRouteOptimized}
              staff={filteredStaff}
              staffStatus={staffStatusData}
            />
          )}
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
                        Google Maps APIキーが設定されていません。地図を表示するには、<code>.env</code>ファイルに<code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>として追加してください。
                    </AlertDescription>
                </Alert>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
