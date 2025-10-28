'use server';

/**
 * Fetches data from a given Google Apps Script URL.
 * This server action acts as a proxy to bypass client-side CORS issues.
 * @param url The full URL of the Google Apps Script web app.
 * @returns A promise that resolves to the JSON data from the GAS endpoint.
 */
export async function fetchGasData(url: string): Promise<any> {
  if (!url) {
    throw new Error('URL is required to fetch data.');
  }

  try {
    const response = await fetch(url, {
      cache: 'no-store', // Ensures fresh data is fetched every time
    });

    if (!response.ok) {
      // Try to parse the error message from GAS if available
      const errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson && errorJson.message) {
          throw new Error(errorJson.message);
        }
      } catch (e) {
        // Fallback to HTTP status if the error is not JSON
        throw new Error(`HTTP error: ${response.status} ${response.statusText} - ${errorText}`);
      }
    }

    const result = await response.json();
    return result;
    
  } catch (error: any) {
    console.error('Server-side fetch to GAS failed:', error);
    // Re-throw the error to be caught by the client component
    throw new Error(error.message || 'An unknown error occurred during the server fetch.');
  }
}
