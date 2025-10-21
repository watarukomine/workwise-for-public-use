
"use client";
import * as React from 'react';
import { RouteOptimizer } from "@/components/optimizer/route-optimizer";
import { staffData, staffStatusData } from "@/lib/data";
import { RouteMap } from "@/components/optimizer/route-map";
import { APIProvider } from "@vis.gl/react-google-maps";
import { staffData as allStaff } from "@/lib/data";
import type { Customer, Staff, StaffStatus } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, getFirestore } from "firebase/firestore";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { OptimizeRouteOutput } from '@/ai/flows/optimize-route-for-efficiency';


export default function OptimizerPage() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { user, isLoading: isUserLoading } = useUser();
  const [optimizedRoute, setOptimizedRoute] = React.useState<OptimizeRouteOutput | null>(null);

  const firestore = getFirestore();
  const customersCollection = useMemoFirebase(
    () => (firestore && user ? collection(firestore, 'customers') : null),
    [firestore, user]
  );
  const { data: customers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersCollection);

  const isLoading = isUserLoading || isLoadingCustomers;

  const staffWithStatus = staffStatusData.map(status => {
    const staffDetails = allStaff.find(staff => staff.id === status.staffId);
    return { ...staffDetails, ...status } as (Staff & StaffStatus);
  });

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
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
              <CardContent className="pt-6">
                 <Skeleton className="h-10 w-28" />
              </CardContent>
            </Card>
          ) : (
            <RouteOptimizer 
              customers={customers || []} 
              staff={staffWithStatus}
              onRouteOptimized={setOptimizedRoute}
            />
          )}
        </div>
        <div className="lg:col-span-2">
          {apiKey ? (
            <APIProvider apiKey={apiKey}>
              <RouteMap 
                staff={staffWithStatus} 
                customers={customers || []} 
                optimizedRoute={optimizedRoute?.optimizedRoute}
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
