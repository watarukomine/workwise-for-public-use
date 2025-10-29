
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
      redirect: 'manual', // Manually handle redirects to get more info
    });

    // Check for redirects (status 300-399)
    if (response.status >= 300 && response.status < 400) {
       const locationHeader = response.headers.get('location');
       console.error(`[GAS DEBUG] Redirect detected. Status: ${response.status}. Location: ${locationHeader}`);
       let redirectError = `GAS request was redirected. This usually indicates a permission issue. Please ensure your script is deployed with 'Who has access' set to 'Anyone' and that you have deployed a new version after any changes to the script. The doGet() function must also correctly return ContentService output, not an HTML page.`;
       if (locationHeader && locationHeader.includes('accounts.google.com')) {
           redirectError += ' Redirected to Google sign-in page.';
       }
       throw new Error(redirectError);
    }
    
    // As a fallback, check if the final URL is a Google sign-in page
    if (response.url.includes('accounts.google.com')) {
        throw new Error('Failed to fetch data. The Google Apps Script is likely not deployed for public access. Please ensure "Who has access" is set to "Anyone" in your GAS deployment settings.');
    }
    
    const contentType = response.headers.get('content-type');
    const responseText = await response.text();

    if (!response.ok || !contentType || !contentType.includes('application/json')) {
      console.error(`[GAS DEBUG] Status: ${response.status}, Content-Type: ${contentType}, Response Body: ${responseText}`);
      
      let errorMessage = `GAS request failed or did not return JSON. Status: ${response.status}.`;
      
      // Check if the response looks like a Google login page HTML
      if (responseText.toLowerCase().includes('<title>google') || responseText.toLowerCase().includes('signin')) {
          errorMessage = 'Failed to fetch data. The Google Apps Script is likely not deployed for public access. Please ensure "Who has access" is set to "Anyone" in your GAS deployment settings and that you have deployed a new version after any changes.';
      } else {
          errorMessage += ` Response Preview: ${responseText.substring(0, 500)}...`;
      }
      
      throw new Error(errorMessage);
    }

    try {
        const result = JSON.parse(responseText);
        // Check for error field within the JSON response from GAS itself
        if (result.error && result.message) {
          throw new Error(`GAS script returned an error: ${result.message}`);
        }
        return result;
    } catch (parseError) {
        console.error("[GAS DEBUG] JSON Parse Error. Response was not valid JSON.", responseText);
        throw new Error(`Failed to parse response from GAS as JSON. Response text: ${responseText.substring(0, 500)}...`);
    }
    
  } catch (error: any) {
    console.error('Server-side fetch to GAS failed:', error.message);
    // Re-throw the error to be caught by the client component
    throw new Error(error.message || 'An unknown error occurred during the server fetch.');
  }
}
