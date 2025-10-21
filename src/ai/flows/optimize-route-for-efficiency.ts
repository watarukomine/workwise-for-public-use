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

const OptimizeRouteInputSchema = z.object({
  locations: z
    .array(
      z.object({
        id: z.string().describe('The unique identifier for the location.'),
        name: z.string().describe('The name of the location.'),
        address: z.string().describe('The street address of the location.'),
        latitude: z.number().describe('The latitude of the location.'),
        longitude: z.number().describe('The longitude of the location.'),
      })
    )
    .describe('An array of work locations, including ID, name, address, latitude, and longitude.'),
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
    .describe('An array of work locations in the optimized order.'),
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

  Given a list of work locations, your task is to determine the optimal route to minimize travel time and fuel costs.
  The optimization is based on {{{optimizeFor}}}.

  Locations:
  {{#each locations}}
  - ID: {{this.id}}, Name: {{this.name}}, Address: {{this.address}}, Latitude: {{this.latitude}}, Longitude: {{this.longitude}}
  {{/each}}

  Please provide the optimized route, estimated travel time, estimated travel distance, and a summary of the route optimization.
  Ensure that the locations in optimizedRoute array contains all the original fields (id, name, address, latitude, longitude) from the input.
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
