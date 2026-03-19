import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';



const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export const ai = genkit({
  plugins: [googleAI({ apiKey })],
  model: 'googleai/gemini-flash-latest',
});
