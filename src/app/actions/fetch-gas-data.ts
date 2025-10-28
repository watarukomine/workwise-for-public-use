
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
      method: 'GET',
      cache: 'no-store',
      // Manual redirect handling to better diagnose auth issues
      redirect: 'manual', 
    });

    // Handle redirects manually to provide a clearer error message
    if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
       throw new Error(`GAS request was redirected. This usually indicates a permission issue. Please ensure your script is deployed with 'Who has access' set to 'Anyone' and that you have deployed a new version after any changes to the script. The doGet() function must also correctly return ContentService output, not an HTML page.`);
    }

    // Check if the final URL is a Google Accounts sign-in page, indicating a permission issue.
    if (response.url.includes('accounts.google.com')) {
        throw new Error('Failed to fetch data. The Google Apps Script is likely not deployed for public access. Please ensure "Who has access" is set to "Anyone" in your GAS deployment settings.');
    }
    
    // Check the content-type before parsing as JSON
    const contentType = response.headers.get('content-type');
    if (!response.ok || !contentType || !contentType.includes('application/json')) {
      const errorText = await response.text();
      // For debugging, log the entire response
      console.error(`[GAS DEBUG] Status: ${response.status}, Content-Type: ${contentType}, Response Body: ${errorText}`);
      
      let errorMessage = `GAS request failed or did not return JSON. Status: ${response.status}.`;
      
      if (errorText.toLowerCase().includes('<title>google') || errorText.toLowerCase().includes('signin')) {
          errorMessage = 'Failed to fetch data. The Google Apps Script is likely not deployed for public access. Please ensure "Who has access" is set to "Anyone" in your GAS deployment settings and that you have deployed a new version after any changes.';
      } else {
          errorMessage += ` Response Preview: ${errorText.substring(0, 500)}...`;
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
