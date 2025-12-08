import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';


// Debug: Check if env var is loaded
console.log("Genkit initialization: GOOGLE_API_KEY is", process.env.GOOGLE_API_KEY ? "Set" : "Unset");
console.log("Genkit initialization: GEMINI_API_KEY is", process.env.GEMINI_API_KEY ? "Set" : "Unset");
// Fallback to NEXT_PUBLIC_... if necessary (though verify security implications if client-side visible)
const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export const ai = genkit({
  plugins: [googleAI({ apiKey })],
  model: 'googleai/gemini-2.5-flash',
});
