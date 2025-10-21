
"use client";

import { RouteOptimizer } from "@/components/optimizer/route-optimizer";
import { customerData, staffData, staffStatusData } from "@/lib/data";
import { RouteMap } from "@/components/optimizer/route-map";
import { APIProvider } from "@vis.gl/react-google-maps";
import { staffData as allStaff } from "@/lib/data";
import type { Staff, StaffStatus } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function OptimizerPage() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

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
          <RouteOptimizer customers={customerData} />
        </div>
        <div className="lg:col-span-2">
          {apiKey ? (
            <APIProvider apiKey={apiKey}>
              <RouteMap staff={staffWithStatus} customers={customerData} />
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
