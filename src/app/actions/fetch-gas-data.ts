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
      redirect: 'follow', // Follow redirects from GAS
    });

    // It's crucial to check the content-type before parsing as JSON
    const contentType = response.headers.get('content-type');
    if (!response.ok || !contentType || !contentType.includes('application/json')) {
      const errorText = await response.text();
      // Try to parse the error message from GAS if available
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson && errorJson.message) {
          throw new Error(errorJson.message);
        }
      } catch (e) {
        // Fallback to HTTP status if the error is not JSON or doesn't have a message
        const detailedError = `GAS request failed. Status: ${response.status}. Response: ${errorText.substring(0, 200)}...`;
        throw new Error(detailedError);
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
