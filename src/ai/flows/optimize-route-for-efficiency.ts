
'use server';

/**
 * @fileOverview An AI agent that optimizes routes between work locations for staff.
 *
 * - optimizeRoute - A function that handles the route optimization process.
 * - OptimizeRouteInput - The input type for the optimizeRoute function.
 * - OptimizeRouteOutput - The return type for the optimizeRoute function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const LocationSchema = z.object({
  id: z.string().describe('The unique identifier for the location.'),
  name: z.string().describe('The name of the location.'),
  address: z.string().describe('The street address of the location.'),
  latitude: z.number().describe('The latitude of the location.'),
  longitude: z.number().describe('The longitude of the location.'),
  type: z.enum(['customer', 'staff']).describe('The type of location.'),
});

const OptimizeRouteInputSchema = z.object({
  startLocation: LocationSchema.describe('The starting location for the route.'),
  endLocation: LocationSchema.describe('The ending location for the route.'),
  waypoints: z.array(LocationSchema).describe('An array of locations to visit between the start and end locations.'),
  optimizeFor:
    z.enum(['time', 'distance'])
      .default('time')
      .describe('Whether to optimize for time or distance.'),
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
      })
    )
    .describe('An array of work locations in the optimized order, starting with the start location and ending with the end location.'),
  estimatedTravelTime: z
    .string()
    .optional()
    .describe('The estimated travel time for the optimized route.'),
  estimatedTravelDistance: z
    .string()
    .optional()
    .describe('The estimated travel distance for the optimized route.'),
  summary: z
    .string()
    .describe('A summary of the route optimization, including key waypoints.'),
});
export type OptimizeRouteOutput = z.infer<typeof OptimizeRouteOutputSchema>;

export async function optimizeRoute(input: OptimizeRouteInput): Promise<OptimizeRouteOutput> {
  return optimizeRouteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'optimizeRoutePrompt',
  input: {schema: OptimizeRouteInputSchema},
  output: {schema: OptimizeRouteOutputSchema},
  prompt: `You are an expert route optimizer, skilled at finding the most efficient routes between multiple locations.

  Given a starting location, an ending location, and a list of intermediate waypoints, your task is to determine the optimal route that starts at the start location, visits all waypoints, and ends at the end location. The goal is to minimize travel time and fuel costs.
  The optimization is based on {{{optimizeFor}}}.

  Start Location:
  - ID: {{startLocation.id}}, Name: {{startLocation.name}}, Address: {{startLocation.address}}, Latitude: {{startLocation.latitude}}, Longitude: {{startLocation.longitude}}

  Waypoints:
  {{#each waypoints}}
  - ID: {{this.id}}, Name: {{this.name}}, Address: {{this.address}}, Latitude: {{this.latitude}}, Longitude: {{this.longitude}}
  {{else}}
  No waypoints provided.
  {{/each}}
  
  End Location:
  - ID: {{endLocation.id}}, Name: {{endLocation.name}}, Address: {{endLocation.address}}, Latitude: {{endLocation.latitude}}, Longitude: {{endLocation.longitude}}

  Please provide the optimized route as an ordered list of all locations (start, waypoints, and end). Also include the estimated travel time, estimated travel distance, and a summary of the route optimization.
  Ensure that the locations in the optimizedRoute array contain all the original fields (id, name, address, latitude, longitude) from the input. The final optimizedRoute array must include the start location, all waypoints, and the end location in the calculated optimal order.
  `,
});

const optimizeRouteFlow = ai.defineFlow(
  {
    name: 'optimizeRouteFlow',
    inputSchema: OptimizeRouteInputSchema,
    outputSchema: OptimizeRouteOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
