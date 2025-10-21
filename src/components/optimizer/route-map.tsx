
'use client';

import * as React from 'react';
import { Map, Marker } from '@vis.gl/react-google-maps';
import { Card, CardContent } from '@/components/ui/card';
import type { Customer, Staff, StaffStatus } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type StaffWithStatus = Staff & StaffStatus;

interface RouteMapProps {
  staff: StaffWithStatus[];
  customers: Customer[];
}

export function RouteMap({ staff, customers }: RouteMapProps) {
  // Calculate center of the map
  const allCoordinates = [
    ...staff.filter(s => s.latitude && s.longitude).map(s => ({ lat: s.latitude!, lng: s.longitude! })),
    ...customers.filter(c => c.latitude && c.longitude).map(c => ({ lat: c.latitude!, lng: c.longitude! }))
  ];

  const center = React.useMemo(() => {
    if (allCoordinates.length === 0) {
      return { lat: 35.45, lng: 139.63 }; // Default to Yokohama
    }
    const latSum = allCoordinates.reduce((sum, coord) => sum + coord.lat, 0);
    const lngSum = allCoordinates.reduce((sum, coord) => sum + coord.lng, 0);
    return { lat: latSum / allCoordinates.length, lng: lngSum / allCoordinates.length };
  }, [allCoordinates]);

  return (
    <Card className="h-[600px] lg:h-full">
      <CardContent className="h-full p-0 rounded-lg overflow-hidden">
        <TooltipProvider>
          <Map
            defaultCenter={center}
            defaultZoom={11}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
            mapId="f85764b3939b85c8"
          >
            {staff.map((s) =>
              s.latitude && s.longitude ? (
                <Marker key={`staff-${s.id}`} position={{ lat: s.latitude, lng: s.longitude }}>
                   <Tooltip>
                      <TooltipTrigger asChild>
                        <Avatar className="h-10 w-10 border-2" style={{borderColor: s.color}}>
                          <AvatarImage src={s.avatarUrl} alt={s.name} />
                          <AvatarFallback>{s.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-bold">{s.name}</p>
                        <p>{s.lastAction}</p>
                      </TooltipContent>
                    </Tooltip>
                </Marker>
              ) : null
            )}
            {customers.map((c) => 
               c.latitude && c.longitude ? (
                <Marker
                  key={`customer-${c.id}`}
                  position={{ lat: c.latitude, lng: c.longitude }}
                />
              ) : null
            )}
          </Map>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
