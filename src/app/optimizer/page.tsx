
"use client";
import * as React from 'react';
import { RouteOptimizer } from "@/components/optimizer/route-optimizer";
import { staffData, staffStatusData, customerData } from "@/lib/data";
import { RouteMap } from "@/components/optimizer/route-map";
import { APIProvider } from "@vis.gl/react-google-maps";
import type { Customer, Staff, StaffStatus } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { OptimizeRouteOutput } from '@/ai/flows/optimize-route-for-efficiency';

export default function OptimizerPage() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [optimizedRoute, setOptimizedRoute] = React.useState<OptimizeRouteOutput | null>(null);
  const [avoidHighways, setAvoidHighways] = React.useState(false);

  const customers: Customer[] = customerData;

  const staffWithStatus = staffStatusData.map(status => {
    const staffDetails = staffData.find(staff => staff.id === status.staffId);
    return { ...staffDetails, ...status } as (Staff & StaffStatus);
  });

  const handleRouteOptimized = (data: OptimizeRouteOutput | null, options: { avoidHighways: boolean }) => {
    setOptimizedRoute(data);
    setAvoidHighways(options.avoidHighways);
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
            customers={customers} 
            staff={staffWithStatus}
            onRouteOptimized={handleRouteOptimized}
          />
        </div>
        <div className="lg:col-span-2">
          {apiKey ? (
            <APIProvider apiKey={apiKey}>
              <RouteMap 
                staff={staffWithStatus} 
                customers={customers} 
                optimizedRoute={optimizedRoute?.optimizedRoute}
                avoidHighways={avoidHighways}
              />
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
