'use server';

/**
 * @fileOverview Google Maps Routes API for high-precision route optimization.
 * Falling back to programmatic TSP solver for >25 waypoints or API errors.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const LocationSchema = z.object({
  id: z.string().describe('The unique identifier for the location.'),
  name: z.string().describe('The name of the location.'),
  address: z.string().describe('The street address of the location.'),
  latitude: z.number().describe('The latitude of the location.'),
  longitude: z.number().describe('The longitude of the location.'),
  type: z.enum(['customer', 'staff', 'custom']).describe('The type of location.'),
});

const OptimizeRouteInputSchema = z.object({
  startLocation: LocationSchema.describe('The starting location for the route.'),
  endLocation: LocationSchema.describe('The ending location for the route.'),
  waypoints: z.array(LocationSchema).describe('An array of locations to visit between the start and end locations.'),
  optimizeFor:
    z.enum(['time', 'distance'])
      .default('time')
      .describe('Whether to optimize for time or distance.'),
  avoidHighways: z.boolean().optional().describe('Whether to avoid highways in the route calculation.'),
});
export type OptimizeRouteInput = z.infer<typeof OptimizeRouteInputSchema>;

const OptimizeRouteOutputSchema = z.object({
  optimizedRoute: z
    .array(
      z.object({
        id: z.string().describe('The unique identifier for the location.'),
        name: z.string().describe('The name of the location.'),
        address: z.string().describe('The street address of the location.'),
        latitude: z.number().describe('The latitude of the location.'),
        longitude: z.number().describe('The longitude of the location.'),
        type: z.enum(['customer', 'staff', 'custom']).optional().describe('The type of location.'),
        travelTimeFromPrevious: z.number().optional().describe('Travel time from the previous location in minutes.'),
        travelDistanceFromPrevious: z.string().optional().describe('Travel distance from the previous location.'),
        orderId: z.string().optional().describe('The order ID associated with this location.'),
      })
    )
    .describe('An array of work locations in the optimized order, starting with the start location and ending with the end location.'),
  estimatedTravelTime: z
    .string()
    .optional()
    .describe('The estimated travel time for the optimized route, in Japanese format (e.g., "1時間15分").'),
  estimatedTravelDistance: z
    .string()
    .optional()
    .describe('The estimated travel distance for the optimized route, in Japanese format (e.g., "75.0 km").'),
});
export type OptimizeRouteOutput = z.infer<typeof OptimizeRouteOutputSchema>;

/**
 * Fallback: Calculates the Haversine distance between two points on Earth in km.
 */
function calculateDistanceFallback(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Fallback TSP solver (Greedy Nearest Neighbor).
 */
function solveTSPFallback(start: any, end: any, waypoints: any[]): any[] {
  if (waypoints.length === 0) return [start, end];
  const result = [start];
  const remaining = [...waypoints];
  let currentLoc = start;

  while (remaining.length > 0) {
    let nearestIdx = -1;
    let minDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
        const d = calculateDistanceFallback(currentLoc.latitude, currentLoc.longitude, remaining[i].latitude, remaining[i].longitude);
        if (d < minDist) {
            minDist = d;
            nearestIdx = i;
        }
    }
    currentLoc = remaining.splice(nearestIdx, 1)[0];
    result.push(currentLoc);
  }
  result.push(end);
  return result;
}

function parseDurationSeconds(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const clean = val.replace('s', '').trim();
    const num = parseFloat(clean);
    return !isNaN(num) ? num : 0;
  }
  return 0;
}

/**
 * Main Flow for Route Optimization.
 * Calls Google Maps Routes API to get the same logic as Google Maps.
 */
const optimizeRouteFlow = ai.defineFlow(
  {
    name: 'optimizeRouteFlow',
    inputSchema: OptimizeRouteInputSchema,
    outputSchema: OptimizeRouteOutputSchema,
  },
  async (input) => {
    const API_KEY = process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    // API LIMIT: Up to 25 intermediate waypoints.
    const canUseAPI = !!API_KEY && input.waypoints.length <= 25;

    if (canUseAPI) {
      try {
        const body = {
          origin: {
            location: {
              latLng: {
                latitude: input.startLocation.latitude,
                longitude: input.startLocation.longitude,
              },
            },
          },
          destination: {
            location: {
              latLng: {
                latitude: input.endLocation.latitude,
                longitude: input.endLocation.longitude,
              },
            },
          },
          intermediates: input.waypoints.map((wp) => ({
            location: {
              latLng: {
                latitude: wp.latitude,
                longitude: wp.longitude,
              },
            },
          })),
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
          departureTime: new Date().toISOString(),
          optimizeWaypointOrder: input.waypoints.length > 0,
          routeModifiers: {
            avoidHighways: input.avoidHighways || false,
          },
          languageCode: 'ja-JP',
          units: 'METRIC',
        };

        const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY!,
            'X-Goog-FieldMask': 'routes.optimizedIntermediateWaypointIndex,routes.duration,routes.distanceMeters,routes.legs.duration,routes.legs.distanceMeters',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.warn('[ROUTES_API_WARNING] Response not OK:', errorData);
          throw new Error('API request failed');
        }

        const data = await response.json();
        const route = data.routes?.[0];

        if (route) {
          // Reorder waypoints based on optimized index
          const optimizedIdx = route.optimizedIntermediateWaypointIndex || input.waypoints.map((_, i) => i);
          const optimizedWaypoints = optimizedIdx.map((idx: number) => input.waypoints[idx]).filter(Boolean);
          
          // Handle cases where some indexes might be missing
          const resultWaypoints = optimizedWaypoints.map((wp: any, i: number) => {
            const leg = route.legs?.[i];
            const durationSec = parseDurationSeconds(leg?.duration);
            const distKm = leg?.distanceMeters ? (leg.distanceMeters / 1000).toFixed(1) : '0.0';
            
            return {
              ...wp,
              travelTimeFromPrevious: Math.round(durationSec / 60),
              travelDistanceFromPrevious: `${distKm} km`,
              orderId: wp.orderId
            };
          });

          // Origin has 0 travel time from previous
          const startLoc = { ...input.startLocation, travelTimeFromPrevious: 0 };
          
          // Last leg is to endLocation
          const lastLeg = route.legs?.[route.legs.length - 1];
          const endLoc = { ...input.endLocation };
          if (lastLeg) {
             const durationSec = parseDurationSeconds(lastLeg.duration);
             const distKm = lastLeg.distanceMeters ? (lastLeg.distanceMeters / 1000).toFixed(1) : '0.0';
             (endLoc as any).travelTimeFromPrevious = Math.round(durationSec / 60);
             (endLoc as any).travelDistanceFromPrevious = `${distKm} km`;
          }

          const resultRoute = [startLoc, ...resultWaypoints, endLoc];

          // Format distance
          const distanceKm = route.distanceMeters ? (route.distanceMeters / 1000).toFixed(1) : '0.0';
          
          // Format duration
          const durationSeconds = parseDurationSeconds(route.duration);
          const totalMinutes = Math.round(durationSeconds / 60);
          const hours = Math.floor(totalMinutes / 60);
          const mins = totalMinutes % 60;
          
          const estimatedTravelTime = hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;
          const estimatedTravelDistance = `${distanceKm} km`;

          return {
            optimizedRoute: resultRoute,
            estimatedTravelTime,
            estimatedTravelDistance,
          };
        }
      } catch (e) {
        console.error('[ROUTES_API_ERROR] Falling back to manual calculation:', e);
      }
    }

    // FALLBACK LOGIC: 物理計算によるTSP
    const optimizedRoute = solveTSPFallback(input.startLocation, input.endLocation, input.waypoints);
    let totalDistanceKm = 0;
    for (let i = 0; i < optimizedRoute.length - 1; i++) {
      totalDistanceKm += calculateDistanceFallback(
        optimizedRoute[i].latitude, optimizedRoute[i].longitude,
        optimizedRoute[i + 1].latitude, optimizedRoute[i + 1].longitude
      );
    }
    const estimatedRoadDistance = totalDistanceKm * 1.3;
    const averageSpeedKmh = input.avoidHighways ? 25 : 35;
    const totalMinutes = Math.round((estimatedRoadDistance / averageSpeedKmh) * 60);
    
    const resultRoute = optimizedRoute.map((loc, i) => {
       if (i === 0) return { ...loc, travelTimeFromPrevious: 0 };
       
       // Simple distribution for fallback
       const d = calculateDistanceFallback(optimizedRoute[i-1].latitude, optimizedRoute[i-1].longitude, loc.latitude, loc.longitude);
       const legMinutes = Math.round(((d * 1.3) / averageSpeedKmh) * 60);
       
       return {
         ...loc,
         travelTimeFromPrevious: legMinutes,
         travelDistanceFromPrevious: `${(d * 1.3).toFixed(1)} km`,
         orderId: (loc as any).orderId
       };
    });

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    
    return {
      optimizedRoute: resultRoute as any,
      estimatedTravelTime: hours > 0 ? `${hours}時間${mins}分` : `${mins}分`,
      estimatedTravelDistance: `${estimatedRoadDistance.toFixed(1)} km`,
    };
  }
);

export async function optimizeRoute(input: OptimizeRouteInput): Promise<OptimizeRouteOutput> {
  return optimizeRouteFlow(input);
}

