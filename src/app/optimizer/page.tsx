
"use client";

import { RouteOptimizer } from "@/components/optimizer/route-optimizer";
import { staffData, staffStatusData } from "@/lib/data";
import { RouteMap } from "@/components/optimizer/route-map";
import { APIProvider } from "@vis.gl/react-google-maps";
import { staffData as allStaff } from "@/lib/data";
import type { Customer, Staff, StaffStatus } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useCollection, useMemoFirebase } from "@/firebase";
import { collection, getFirestore } from "firebase/firestore";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function OptimizerPage() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const firestore = getFirestore();
  const customersCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'customers') : null),
    [firestore]
  );
  const { data: customers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersCollection);


  const staffWithStatus = staffStatusData.map(status => {
    const staffDetails = allStaff.find(staff => staff.id === status.staffId);
    return { ...staffDetails, ...status } as (Staff & StaffStatus);
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Route Optimizer</h1>
        <p className="text-muted-foreground">
          Generate the most efficient route between multiple work locations.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          {isLoadingCustomers ? (
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
            <RouteOptimizer customers={customers || []} staff={staffWithStatus} />
          )}
        </div>
        <div className="lg:col-span-2">
          {apiKey ? (
            <APIProvider apiKey={apiKey}>
              <RouteMap staff={staffWithStatus} customers={customers || []} />
            </APIProvider>
          ) : (
            <div className="flex items-center justify-center h-full rounded-lg border border-dashed shadow-sm">
                <Alert variant="destructive" className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Google Maps API Key Missing</AlertTitle>
                    <AlertDescription>
                        The Google Maps API key is not configured. Please add it to your <code>.env</code> file as <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to display the map.
                    </AlertDescription>
                </Alert>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
