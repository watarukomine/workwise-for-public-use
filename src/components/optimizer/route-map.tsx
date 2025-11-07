
'use client';

import * as React from 'react';
import { Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Card, CardContent } from '@/components/ui/card';
import type { Customer, Staff, StaffStatus } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Location } from './route-optimizer';
import { User, Building2 } from 'lucide-react';

type StaffWithLocation = Staff & Partial<StaffStatus>;

interface RouteMapProps {
  staff: StaffWithLocation[];
  customers: Customer[];
  customLocations?: Location[];
  optimizedRoute?: Location[];
  avoidHighways?: boolean;
}

function Directions({ route, avoidHighways }: { route: Location[], avoidHighways?: boolean }) {
  const map = useMap();
  const routesLibrary = useMapsLibrary('routes');
  const [directionsService, setDirectionsService] = React.useState<google.maps.DirectionsService>();
  const [directionsRenderer, setDirectionsRenderer] = React.useState<google.maps.DirectionsRenderer>();
  const [routes, setRoutes] = React.useState<google.maps.DirectionsRoute[]>([]);

  React.useEffect(() => {
    if (!routesLibrary || !map) return;
    setDirectionsService(new routesLibrary.DirectionsService());
    setDirectionsRenderer(new routesLibrary.DirectionsRenderer({ 
      map,
      polylineOptions: {
        strokeColor: '#4285F4', // Blue color for the route
        strokeOpacity: 0.8,
        strokeWeight: 6
      },
      suppressMarkers: true, // We add our own custom markers
    }));
  }, [routesLibrary, map]);

  React.useEffect(() => {
    if (!directionsService || !directionsRenderer || !route || route.length < 2) {
        if (directionsRenderer) {
            directionsRenderer.set('directions', null);
        }
        return;
    };

    const origin = new google.maps.LatLng(route[0].latitude, route[0].longitude);
    const destination = new google.maps.LatLng(route[route.length - 1].latitude, route[route.length - 1].longitude);
    const waypoints: google.maps.DirectionsWaypoint[] = route.slice(1, -1).map(loc => ({
      location: new google.maps.LatLng(loc.latitude, loc.longitude),
      stopover: true,
    }));

    directionsService.route({
      origin: origin,
      destination: destination,
      waypoints: waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
      avoidHighways: avoidHighways,
    }).then(response => {
      directionsRenderer.setDirections(response);
      setRoutes(response.routes);
    }).catch(e => {
        console.error("Directions request failed due to " + e);
    });

    return () => {
       if (directionsRenderer) {
          directionsRenderer.set('directions', null);
       }
    }
  }, [directionsService, directionsRenderer, route, avoidHighways]);

  return null;
}


export function RouteMap({ staff, customers, customLocations, optimizedRoute, avoidHighways }: RouteMapProps) {
  const allCoordinates = [
    ...staff.filter(s => s.latitude && s.longitude).map(s => ({ lat: s.latitude!, lng: s.longitude! })),
    ...customers.filter(c => c.latitude && c.longitude).map(c => ({ lat: c.latitude!, lng: c.longitude! })),
    ...(customLocations || []).map(l => ({ lat: l.latitude, lng: l.longitude}))
  ];

  const center = React.useMemo(() => {
    if (optimizedRoute && optimizedRoute.length > 0) {
        const latSum = optimizedRoute.reduce((sum, loc) => sum + loc.latitude, 0);
        const lngSum = optimizedRoute.reduce((sum, loc) => sum + loc.longitude, 0);
        return { lat: latSum / optimizedRoute.length, lng: lngSum / optimizedRoute.length };
    }
    if (allCoordinates.length === 0) {
      return { lat: 35.6895, lng: 139.6917 }; // Default to Tokyo
    }
    const latSum = allCoordinates.reduce((sum, coord) => sum + coord.lat, 0);
    const lngSum = allCoordinates.reduce((sum, coord) => sum + coord.lng, 0);
    return { lat: latSum / allCoordinates.length, lng: lngSum / allCoordinates.length };
  }, [allCoordinates, optimizedRoute]);

  const showRoute = optimizedRoute && optimizedRoute.length > 1;

  return (
    <Card className="h-[600px] lg:h-full">
      <CardContent className="h-full p-0 rounded-lg overflow-hidden">
        <TooltipProvider>
          <Map
            center={center}
            defaultZoom={11}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
            mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID"}
          >
            {staff.map((s) =>
              s.latitude && s.longitude ? (
                <AdvancedMarker key={`staff-${s.id}`} position={{ lat: s.latitude, lng: s.longitude }}>
                   <Tooltip>
                      <TooltipTrigger asChild>
                        <div 
                          className="w-8 h-8 rounded-full bg-white border-2 flex items-center justify-center"
                          style={{ borderColor: s.color }}
                        >
                            <User className="w-5 h-5" style={{ color: s.color }} />
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
               c.latitude && c.longitude ? (
                <AdvancedMarker
                  key={`customer-${c.userCode}`}
                  position={{ 
                    lat: c.latitude, 
                    lng: c.longitude
                  }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                       <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white shadow-md flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-bold">{c['店舗'] || c.name}</p>
                      <p>{c.address}</p>
                    </TooltipContent>
                  </Tooltip>
                </AdvancedMarker>
              ) : null
            )}
             {customLocations?.map((l) => 
               l.latitude && l.longitude ? (
                <AdvancedMarker
                  key={`custom-${l.id}`}
                  position={{ 
                    lat: l.latitude, 
                    lng: l.longitude
                  }}
                >
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="w-4 h-4 rounded-full bg-purple-500 border-2 border-white shadow-md" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-bold">{l.name}</p>
                      <p>{l.address}</p>
                    </TooltipContent>
                  </Tooltip>
                </AdvancedMarker>
              ) : null
            )}
            {showRoute && (
                <Directions route={optimizedRoute} avoidHighways={avoidHighways} />
            )}
          </Map>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
