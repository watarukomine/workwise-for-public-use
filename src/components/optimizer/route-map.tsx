
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
import { User, Building2, MapPin } from 'lucide-react';

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
    ...(customLocations || []).map(l => ({ lat: l.latitude, lng: l.longitude }))
  ];

  const defaultCenter = React.useMemo(() => {
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
  const destination = showRoute ? optimizedRoute[optimizedRoute.length - 1] : null;

  return (
    <Card className="h-[600px] lg:h-full">
      <CardContent className="h-full p-0 rounded-lg overflow-hidden">
        <TooltipProvider>
          <Map
            defaultCenter={defaultCenter}
            defaultZoom={11}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
            mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID"}
          >
            {staff.map((s) => {
              const lat = Number(s.latitude);
              const lng = Number(s.longitude);
              const displayName = s.name || (s as any)['氏名'] || (s as any)['名前'] || (s as any)['担当'] || '名前未設定';
              const markerColor = s.color || '#3b82f6';

              return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 ? (
                <AdvancedMarker key={`staff-${s.id}`} position={{ lat, lng }}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="w-8 h-8 rounded-full bg-white border-2 flex items-center justify-center shadow-md cursor-pointer hover:scale-110 transition-transform"
                        style={{ borderColor: markerColor }}
                      >
                        <User className="w-5 h-5" style={{ color: markerColor }} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-bold">{displayName}</p>
                      <p className="text-xs">{s.lastAction || '現在地'}</p>
                    </TooltipContent>
                  </Tooltip>
                </AdvancedMarker>
              ) : null;
            })}
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
                    <TooltipTrigger asChild>
                      <div className="w-8 h-8 rounded-full bg-purple-600 border-2 border-white shadow-md flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-bold">{l.name}</p>
                      <p>{l.address}</p>
                    </TooltipContent>
                  </Tooltip>
                </AdvancedMarker>
              ) : null
            )}
            {showRoute && optimizedRoute && optimizedRoute.length > 0 && (
              <AdvancedMarker
                key={`start-${optimizedRoute[0].id}`}
                position={{ lat: optimizedRoute[0].latitude, lng: optimizedRoute[0].longitude }}
                zIndex={10}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-10 h-10 rounded-full bg-green-500 border-2 border-white shadow-md flex items-center justify-center">
                      <span className="text-white font-bold text-lg">S</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-bold">出発地: {optimizedRoute[0].name}</p>
                  </TooltipContent>
                </Tooltip>
              </AdvancedMarker>
            )}
            {showRoute && destination && (
              <AdvancedMarker
                key={`destination-${destination.id}`}
                position={{ lat: destination.latitude, lng: destination.longitude }}
                zIndex={10}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-10 h-10 rounded-full bg-red-500 border-2 border-white shadow-md flex items-center justify-center">
                      <span className="text-white font-bold text-lg">G</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-bold">目的地: {destination.name}</p>
                  </TooltipContent>
                </Tooltip>
              </AdvancedMarker>
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
