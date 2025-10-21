
'use client';

import * as React from 'react';
import { Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Card, CardContent } from '@/components/ui/card';
import type { Customer, Staff, StaffStatus } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OptimizeRouteOutput } from '@/ai/flows/optimize-route-for-efficiency';

type StaffWithStatus = Staff & StaffStatus;
type OptimizedRouteLocation = OptimizeRouteOutput['optimizedRoute'][0];


interface RouteMapProps {
  staff: StaffWithStatus[];
  customers: Customer[];
  optimizedRoute?: OptimizedRouteLocation[];
}

function RoutePolyline({ path }: { path: google.maps.LatLngLiteral[] }) {
  const map = useMap();
  const maps = useMapsLibrary('maps');
  const polylineRef = React.useRef<google.maps.Polyline | null>(null);


  React.useEffect(() => {
    if (!map || !maps) return;

    // Clear existing polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }
    
    if (path.length > 0) {
      const polyline = new maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#4285F4',
        strokeOpacity: 0.8,
        strokeWeight: 5,
      });

      polyline.setMap(map);
      polylineRef.current = polyline;
    }


    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
    };
  }, [map, maps, path]);

  return null;
}


export function RouteMap({ staff, customers, optimizedRoute }: RouteMapProps) {
  // Calculate center of the map
  const allCoordinates = [
    ...staff.filter(s => s.latitude && s.longitude).map(s => ({ lat: s.latitude!, lng: s.longitude! })),
    ...customers.filter(c => c.緯度 && c.経度).map(c => ({ lat: typeof c.緯度! === 'string' ? parseFloat(c.緯度!) : c.緯度!, lng: typeof c.経度! === 'string' ? parseFloat(c.経度!) : c.経度! }))
  ];

  const center = React.useMemo(() => {
    if (allCoordinates.length === 0) {
      return { lat: 35.45, lng: 139.63 }; // Default to Yokohama
    }
    const latSum = allCoordinates.reduce((sum, coord) => sum + coord.lat, 0);
    const lngSum = allCoordinates.reduce((sum, coord) => sum + coord.lng, 0);
    return { lat: latSum / allCoordinates.length, lng: lngSum / allCoordinates.length };
  }, [allCoordinates]);

  const routeCoordinates = React.useMemo(() => {
    if (!optimizedRoute) return [];
    return optimizedRoute.map(loc => ({ lat: loc.latitude, lng: loc.longitude }));
  }, [optimizedRoute]);

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
               c.緯度 && c.経度 ? (
                <Marker
                  key={`customer-${c.id}`}
                  position={{ 
                    lat: typeof c.緯度 === 'string' ? parseFloat(c.緯度) : c.緯度, 
                    lng: typeof c.経度 === 'string' ? parseFloat(c.経度) : c.経度
                  }}
                />
              ) : null
            )}
            {routeCoordinates.length > 0 && (
                <RoutePolyline path={routeCoordinates} />
            )}
          </Map>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
