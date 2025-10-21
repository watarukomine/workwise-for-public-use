
'use client';

import * as React from 'react';
import {
  Map,
  AdvancedMarker,
  useMap,
} from '@vis.gl/react-google-maps';
import { Card, CardContent } from '@/components/ui/card';
import type { Customer, Staff, StaffStatus } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { User } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

type StaffWithStatus = Staff & StaffStatus;

interface StaffMapProps {
  staff: StaffWithStatus[];
  customers: Customer[];
  isLoading: boolean;
}

export function StaffMap({ staff, customers, isLoading }: StaffMapProps) {
  const allCoordinates = [
    ...staff
      .filter((s) => s.latitude && s.longitude)
      .map((s) => ({ lat: s.latitude!, lng: s.longitude! })),
    ...customers
      .filter((c) => c.緯度 && c.経度)
      .map((c) => ({
        lat: typeof c.緯度! === 'string' ? parseFloat(c.緯度!) : c.緯度!,
        lng: typeof c.経度! === 'string' ? parseFloat(c.経度!) : c.経度!,
      })),
  ];

  const center = React.useMemo(() => {
    if (allCoordinates.length === 0) {
      return { lat: 35.45, lng: 139.63 }; // Default to Yokohama
    }
    const latSum = allCoordinates.reduce((sum, coord) => sum + coord.lat, 0);
    const lngSum = allCoordinates.reduce((sum, coord) => sum + coord.lng, 0);
    return { lat: latSum / allCoordinates.length, lng: lngSum / allCoordinates.length };
  }, [allCoordinates]);

  if (isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  return (
    <Card className="h-full">
      <CardContent className="h-full p-0 rounded-lg overflow-hidden">
        <TooltipProvider>
          <Map
            center={center}
            defaultZoom={11}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
            mapId="f85764b3939b85c8"
          >
            {staff.map((s) =>
              s.latitude && s.longitude ? (
                <AdvancedMarker
                  key={`staff-${s.id}`}
                  position={{ lat: s.latitude, lng: s.longitude }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-8 h-8 rounded-full bg-white border-2 border-primary flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-bold">{s.name}</p>
                      <p>{s.lastAction}</p>
                    </TooltipContent>
                  </Tooltip>
                </AdvancedMarker>
              ) : null
            )}
            {customers.map((c) =>
              c.緯度 && c.経度 ? (
                <AdvancedMarker
                  key={`customer-${c.id}`}
                  position={{
                    lat:
                      typeof c.緯度 === 'string' ? parseFloat(c.緯度) : c.緯度,
                    lng:
                      typeof c.経度 === 'string' ? parseFloat(c.経度) : c.経度,
                  }}
                >
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-bold">{c.店舗}</p>
                      <p>{c.住所}</p>
                    </TooltipContent>
                  </Tooltip>
                </AdvancedMarker>
              ) : null
            )}
          </Map>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
