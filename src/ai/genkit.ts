import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';


// Debug: Check if env var is loaded
const fs_genkit = require('fs');
const genkitLogPath = '/Users/tmpmarketingsectionofkanagawa/WorkWise/ULTIMATE_DEBUG.log';
const logMsg = `\n[${new Date().toISOString()}] Genkit init check:\n` +
  `GOOGLE_API_KEY: ${process.env.GOOGLE_API_KEY ? process.env.GOOGLE_API_KEY.substring(0, 8) + "..." : "Unset"}\n` +
  `GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 8) + "..." : "Unset"}\n` +
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: ${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.substring(0, 8) + "..." : "Unset"}\n`;
fs_genkit.appendFileSync(genkitLogPath, logMsg);

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export const ai = genkit({
  plugins: [googleAI({ apiKey })],
  model: 'googleai/gemini-flash-latest',
});
