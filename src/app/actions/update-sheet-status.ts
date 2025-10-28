
'use server';

interface UpdateSheetStatusArgs {
    orderId: string;
    staffName: string;
    gasUrl: string;
}

interface GasResponse {
    status: 'success' | 'error';
    message: string;
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
            redirect: 'follow', 
        });

        const contentType = response.headers.get('content-type');
        const responseText = await response.text();
        
        if (!response.ok) {
             throw new Error(`GAS script returned an error. Status: ${response.status}. Response: ${responseText}`);
        }

        if (!contentType || !contentType.includes('application/json')) {
            // If the response is not JSON but the request was otherwise OK,
            // it might be an HTML error page from Google.
            throw new Error(`GAS script returned a non-JSON response. This often indicates a permission or script error. Response: ${responseText}`);
        }
        
        const result: GasResponse = JSON.parse(responseText);

        // Handle cases where GAS returns a JSON with an error status
        if(result.status === 'error'){
            throw new Error(result.message);
        }

        return result;

    } catch (error: any) {
        console.error('Failed to call GAS for status update:', error);
        return {
            status: 'error',
            message: error.message || 'An unknown error occurred while updating the sheet.',
        };
    }
}
