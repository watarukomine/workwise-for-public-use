
'use server';

interface UpdateSheetStatusArgs {
    orderId: string;
    staffName: string;
    gasUrl: string;
}

interface GasResponse {
    status: 'success' | 'error';
    message: string;
    error?: boolean; // Some GAS implementations might return 'error: true'
}

/**
 * Calls a Google Apps Script to update the status of an order in a spreadsheet.
 * @param {UpdateSheetStatusArgs} args - The arguments for updating the sheet.
 * @returns {Promise<GasResponse>} The response from the Google Apps Script.
 */
export async function updateSheetStatus({ orderId, staffName, gasUrl }: UpdateSheetStatusArgs): Promise<GasResponse> {
    if (!gasUrl) {
        console.error('GAS URL is not provided.');
        return { status: 'error', message: 'GAS URL is not configured.' };
    }

    try {
        const response = await fetch(gasUrl, {
            method: 'POST',
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                orderId: orderId,
                staffName: staffName,
            }),
            redirect: 'follow', // Follow redirects for POST requests
        });

        const contentType = response.headers.get('content-type');
        const responseText = await response.text();
        
        if (!response.ok) {
             // Handle non-200 responses more gracefully
             throw new Error(`GAS script returned a non-OK response. Status: ${response.status}. Response: ${responseText}`);
        }

        try {
            const result: GasResponse = JSON.parse(responseText);

            // Check for both 'error: true' and 'status: "error"' patterns
            if(result.error === true || result.status === 'error'){
                // Prefer the JSON error message if it exists
                throw new Error(result.message || 'GAS returned a JSON-formatted error.');
            }

            return result;
        } catch (parseError) {
             // If parsing fails, it means the response was not valid JSON.
             // This is a critical error state, likely a script error or permission issue on the GAS side.
             throw new Error(`GAS script returned a non-JSON response. This often indicates a script error or permission issue. Response: ${responseText}`);
        }

    } catch (error: any) {
        console.error('Failed to call GAS for status update:', error.message);
        // The error is now more specific, so we can return its message directly
        return {
            status: 'error',
            message: error.message || 'An unknown error occurred while updating the sheet.',
        };
    }
}
