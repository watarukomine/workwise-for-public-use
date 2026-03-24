
'use server';

import { unstable_noStore as noStore } from 'next/cache';

/**
 * Fetches data from a given Google Apps Script URL.
 * This server action acts as a proxy to bypass client-side CORS issues.
 * @param url The full URL of the Google Apps Script web app.
 * @returns A promise that resolves to an object with either 'data' or 'error' property.
 */
export async function fetchGasData(url: string): Promise<{ data?: any; staff?: any; orders?: any; customers?: any; error?: string; message?: string }> {
  // This function will always be dynamically rendered, disabling caching.
  noStore();

  if (!url) {
    return { error: 'URL is required to fetch data.' };
  }

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(id);

    if (response.url.includes('accounts.google.com')) {
      return { error: 'Failed to fetch data. The Google Apps Script is likely not deployed for public access. Please ensure "Who has access" is set to "Anyone" in your GAS deployment settings.' };
    }

    if (!response.ok) {
      let errorMessage = `GAS request failed. Status: ${response.status}.`;
      try {
        const responseText = await response.text();
        if (responseText.toLowerCase().includes('<title>google') || responseText.toLowerCase().includes('signin')) {
          errorMessage = 'Failed to fetch data. The Google Apps Script is likely not deployed for public access. Please ensure "Who has access" is set to "Anyone" in your GAS deployment settings and that you have deployed a new version after any changes.';
        } else if (response.status >= 300 && response.status < 400) {
          errorMessage = "GAS request was redirected. This usually indicates a permission issue. Please ensure your script is deployed with 'Who has access' set to 'Anyone' and that you have deployed a new version after any changes to the script. The doGet() function must also correctly return ContentService output, not an HTML page.";
        } else {
          errorMessage += ` Response: ${responseText}`;
        }
      } catch (e) { /* Ignore if we can't read the body */ }

      return { error: errorMessage };
    }

    const result = await response.json();
    if (result.status === 'error' && result.message) {
      return { error: `GAS script returned an error: ${result.message}` };
    }

    return { 
      data: result.data || (Array.isArray(result) ? result : []),
      staff: result.staff,
      orders: result.orders,
      customers: result.customers
    };

  } catch (error: any) {
    console.error('Server-side fetch to GAS failed:', error.message);
    if (error.name === 'AbortError') {
      return { error: 'データ取得がタイムアウト（30秒）しました。スプレッドシートのデータ量が多すぎるか、GAS側に問題がある可能性があります。' };
    }
    return { error: error.message || 'データ取得中に原因不明のエラーが発生しました。' };
  }
}

