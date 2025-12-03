
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

export async function optimizeRoute(input: OptimizeRouteInput): Promise<OptimizeRouteOutput> {
  return optimizeRouteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'optimizeRoutePrompt',
  input: {schema: OptimizeRouteInputSchema},
  output: {schema: OptimizeRouteOutputSchema},
  prompt: `あなたは、複数の地点間の最も効率的なルートを見つけ出す、熟練したルート最適化のエキスパートです。

出発地、目的地、そして中間地点のリストが与えられます。あなたのタスクは、出発地から始まり、すべての中間地点を巡り、目的地で終わる最適なルートを決定することです。目的は、移動時間と燃料コストを最小限に抑えることです。
最適化の基準は「{{{optimizeFor}}}」です。
{{#if avoidHighways}}
ルートは高速道路を避ける必要があります。
{{/if}}

出発地:
- ID: {{startLocation.id}}, 名称: {{startLocation.name}}, 住所: {{startLocation.address}}, 緯度: {{startLocation.latitude}}, 経度: {{startLocation.longitude}}

中間地点:
{{#each waypoints}}
- ID: {{this.id}}, 名称: {{this.name}}, 住所: {{this.address}}, 緯度: {{this.latitude}}, 経度: {{this.longitude}}
{{else}}
中間地点はありません。
{{/each}}
  
目的地:
- ID: {{endLocation.id}}, 名称: {{endLocation.name}}, 住所: {{endLocation.address}}, 緯度: {{endLocation.latitude}}, 経度: {{endLocation.longitude}}

最適化されたルートを、全地点（出発地、中間地点、目的地）の順序付きリストとして提供してください。また、推定所要時間と推定移動距離も日本語で含めてください（例：1時間15分、75.0 km）。
optimizedRoute配列内の各地点には、入力から受け取った元のフィールド（id, name, address, latitude, longitude, type）がすべて含まれていることを確認してください。最終的なoptimizedRoute配列には、計算された最適な順序で、出発地、すべての中間地点、および目的地が含まれている必要があります。
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
