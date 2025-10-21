
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
import type { OptimizeRouteOutput } from '@/ai/flows/optimize-route-for-efficiency';
import { User } from 'lucide-react';

type StaffWithStatus = Staff & StaffStatus;
type OptimizedRouteLocation = OptimizeRouteOutput['optimizedRoute'][0];


interface RouteMapProps {
  staff: StaffWithStatus[];
  customers: Customer[];
  optimizedRoute?: OptimizedRouteLocation[];
}

function Directions({ route }: { route: OptimizedRouteLocation[] }) {
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
        // Clear previous route if any
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
    }).then(response => {
      directionsRenderer.setDirections(response);
      setRoutes(response.routes);
    }).catch(e => {
        console.error("Directions request failed due to " + e);
    });

    return () => {
        // Clean up directions
       if (directionsRenderer) {
          directionsRenderer.set('directions', null);
       }
    }
  }, [directionsService, directionsRenderer, route]);

  return null;
}


export function RouteMap({ staff, customers, optimizedRoute }: RouteMapProps) {
  const allCoordinates = [
    ...staff.filter(s => s.latitude && s.longitude).map(s => ({ lat: s.latitude!, lng: s.longitude! })),
    ...customers.filter(c => c.緯度 && c.経度).map(c => ({ lat: typeof c.緯度! === 'string' ? parseFloat(c.緯度!) : c.緯度!, lng: typeof c.経度! === 'string' ? parseFloat(c.経度!) : c.経度! }))
  ];

  const center = React.useMemo(() => {
    if (optimizedRoute && optimizedRoute.length > 0) {
        const latSum = optimizedRoute.reduce((sum, loc) => sum + loc.latitude, 0);
        const lngSum = optimizedRoute.reduce((sum, loc) => sum + loc.longitude, 0);
        return { lat: latSum / optimizedRoute.length, lng: lngSum / optimizedRoute.length };
    }
    if (allCoordinates.length === 0) {
      return { lat: 35.45, lng: 139.63 }; // Default to Yokohama
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
            mapId="f85764b3939b85c8"
          >
            {staff.map((s) =>
              s.latitude && s.longitude ? (
                <AdvancedMarker key={`staff-${s.id}`} position={{ lat: s.latitude, lng: s.longitude }}>
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
                    lat: typeof c.緯度 === 'string' ? parseFloat(c.緯度) : c.緯度, 
                    lng: typeof c.経度 === 'string' ? parseFloat(c.経度) : c.経度
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
            {showRoute && (
                <Directions route={optimizedRoute} />
            )}
          </Map>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
