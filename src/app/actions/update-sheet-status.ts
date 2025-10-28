
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
        const errorText = await response.text();
        
        if (!response.ok || !contentType || !contentType.includes('application/json')) {
            try {
                const errorJson = JSON.parse(errorText);
                 if (errorJson && errorJson.message) {
                    throw new Error(errorJson.message);
                }
            } catch (e) {
                // If it's not JSON, throw the raw text response
                throw new Error(`GAS script returned a non-JSON or error response. Status: ${response.status}. Response: ${errorText}`);
            }
        }

        const result: GasResponse = JSON.parse(errorText);

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
