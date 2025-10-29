
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
      // Using 'follow' is simpler and often sufficient.
      // If redirects persist, it's a clear sign of a permissions issue on the GAS side.
      redirect: 'follow', 
    });
    
    // If the final URL after following redirects is a Google sign-in page, it's a clear error.
    if (response.url.includes('accounts.google.com')) {
        throw new Error('Failed to fetch data. The Google Apps Script is likely not deployed for public access. Please ensure "Who has access" is set to "Anyone" in your GAS deployment settings.');
    }
    
    const contentType = response.headers.get('content-type');
    const responseText = await response.text();

    if (!response.ok || !contentType || !contentType.includes('application/json')) {
      let errorMessage = `GAS request failed or did not return JSON. Status: ${response.status}.`;
      
      // Check if the response looks like a Google login page HTML or a redirect message.
      if (responseText.toLowerCase().includes('<title>google') || responseText.toLowerCase().includes('signin')) {
          errorMessage = 'Failed to fetch data. The Google Apps Script is likely not deployed for public access. Please ensure "Who has access" is set to "Anyone" in your GAS deployment settings and that you have deployed a new version after any changes.';
      } else if (response.status >= 300 && response.status < 400) {
          errorMessage = "GAS request was redirected. This usually indicates a permission issue. Please ensure your script is deployed with 'Who has access' set to 'Anyone' and that you have deployed a new version after any changes to the script. The doGet() function must also correctly return ContentService output, not an HTML page.";
      }
      
      throw new Error(errorMessage);
    }

    try {
        const result = JSON.parse(responseText);
        // Check for an explicit error field within the JSON response from GAS itself.
        if (result.error && result.message) {
          throw new Error(`GAS script returned an error: ${result.message}`);
        }
        return result;
    } catch (parseError) {
        throw new Error(`Failed to parse response from GAS as JSON. Response text: ${responseText.substring(0, 500)}...`);
    }
    
  } catch (error: any) {
    console.error('Server-side fetch to GAS failed:', error.message);
    // Re-throw a cleaner error message to be caught by the client component.
    throw new Error(error.message || 'An unknown error occurred during the server fetch.');
  }
}
