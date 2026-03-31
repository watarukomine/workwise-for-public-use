'use server';

/**
 * @fileOverview A high-performance programmatic route optimizer for staff work locations.
 * Uses a TSP (Traveling Salesman Problem) solver based on Haversine distance.
 * 
 * - optimizeRoute - A function that handles the route optimization process.
 * - OptimizeRouteInput - The input type for the optimizeRoute function.
 * - OptimizeRouteOutput - The return type for the optimizeRoute function.
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
 * Calculates the Haversine distance between two points on Earth in km.
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
 * Solves the Traveling Salesman Problem (TSP) with fixed start and end points.
 */
function solveTSP(start: any, end: any, waypoints: any[]): any[] {
  if (waypoints.length === 0) return [start, end];

  // For small number of waypoints (<= 8), use brute force for exact shortest path
  // 8! = 40,320 permutations, which is fast in modern JS.
  if (waypoints.length <= 8) {
    let minDistance = Infinity;
    let bestWaypoints: any[] = [];

    const getPermutations = (arr: any[]): any[][] => {
      if (arr.length <= 1) return [arr];
      const result: any[][] = [];
      for (let i = 0; i < arr.length; i++) {
        const current = arr[i];
        const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
        for (const p of getPermutations(remaining)) {
          result.push([current, ...p]);
        }
      }
      return result;
    };

    const allPermutations = getPermutations(waypoints);
    
    for (const p of allPermutations) {
      let currentDist = 0;
      let prevLoc = start;
      
      for (const loc of p) {
        currentDist += calculateDistance(prevLoc.latitude, prevLoc.longitude, loc.latitude, loc.longitude);
        prevLoc = loc;
      }
      currentDist += calculateDistance(prevLoc.latitude, prevLoc.longitude, end.latitude, end.longitude);
      
      if (currentDist < minDistance) {
        minDistance = currentDist;
        bestWaypoints = p;
      }
    }
    
    return [start, ...bestWaypoints, end];
  }

  // For larger sets, use Greedy (Nearest Neighbor) heuristic
  const result = [start];
  const remaining = [...waypoints];
  let currentLoc = start;

  while (remaining.length > 0) {
    let nearestIdx = -1;
    let minDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const d = calculateDistance(currentLoc.latitude, currentLoc.longitude, remaining[i].latitude, remaining[i].longitude);
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

export async function optimizeRoute(input: OptimizeRouteInput): Promise<OptimizeRouteOutput> {
  return optimizeRouteFlow(input);
}

/**
 * Programmatic Flow for Route Optimization.
 * Replaces the AI-based prompt with a deterministic algorithm for speed and accuracy.
 */
const optimizeRouteFlow = ai.defineFlow(
  {
    name: 'optimizeRouteFlow',
    inputSchema: OptimizeRouteInputSchema,
    outputSchema: OptimizeRouteOutputSchema,
  },
  async input => {
    try {
      // 1. Solve TSP programmatically (Instant!)
      const optimizedRoute = solveTSP(input.startLocation, input.endLocation, input.waypoints);

      // 2. Calculate Total Distance (Haversine)
      let totalDistanceKm = 0;
      for (let i = 0; i < optimizedRoute.length - 1; i++) {
        totalDistanceKm += calculateDistance(
          optimizedRoute[i].latitude, optimizedRoute[i].longitude,
          optimizedRoute[i + 1].latitude, optimizedRoute[i + 1].longitude
        );
      }

      // Add a factor for real-road distance (typically 1.2x - 1.4x of air distance)
      const roadDistanceMultiplier = 1.3;
      const estimatedRoadDistance = totalDistanceKm * roadDistanceMultiplier;

      // 3. Estimate Travel Time
      // Base speed: 30km/h for local roads, adjusted if avoiding highways
      const averageSpeedKmh = input.avoidHighways ? 25 : 35;
      const totalMinutes = Math.round((estimatedRoadDistance / averageSpeedKmh) * 60);
      
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      
      const estimatedTravelTime = hours > 0 
        ? `${hours}時間${mins}分` 
        : `${mins}分`;
      
      const estimatedTravelDistance = `${estimatedRoadDistance.toFixed(1)} km`;

      return {
        optimizedRoute,
        estimatedTravelTime,
        estimatedTravelDistance,
      };
    } catch (e: any) {
      console.error('[OPTIMIZE_ROUTE_ERROR]', e);
      throw e;
    }
  }
);

