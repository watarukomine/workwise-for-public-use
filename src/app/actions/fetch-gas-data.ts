
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

    // Check the content-type before parsing as JSON
    const contentType = response.headers.get('content-type');
    if (!response.ok || !contentType || !contentType.includes('application/json')) {
      const errorText = await response.text();
      let errorMessage = `GAS request failed or did not return JSON. Status: ${response.status}.`;
      
      // If we get a Google login page, it's a permission issue with the GAS deployment.
      if (errorText.includes('signin') && errorText.includes('accounts.google.com')) {
         errorMessage = 'Failed to fetch data. The Google Apps Script is likely not deployed for public access. Please ensure "Who has access" is set to "Anyone" in your GAS deployment settings.';
      } else {
        // Fallback for other non-JSON responses
        errorMessage += ` Response: ${errorText.substring(0, 300)}...`;
      }
      
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result;
    
  } catch (error: any) {
    console.error('Server-side fetch to GAS failed:', error);
    // Re-throw the error to be caught by the client component
    throw new Error(error.message || 'An unknown error occurred during the server fetch.');
  }
}
