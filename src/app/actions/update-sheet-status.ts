
'use server';

interface UpdateSheetStatusArgs {
    orderId: string;
    staffName: string;
    gasUrl: string;
}

interface GasResponse {
    status: 'success' | 'error';
    message: string;
    error?: boolean; // Add error property for better compatibility
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
             throw new Error(`GAS script returned a non-OK response. Status: ${response.status}. Response: ${responseText}`);
        }

        // Try to parse as JSON, but handle cases where it might not be
        try {
            const result: GasResponse = JSON.parse(responseText);

            // Handle cases where GAS returns a JSON with an error status (e.g., {error: true, message: '...'})
            if(result.error === true || result.status === 'error'){
                throw new Error(result.message || 'GAS returned a JSON-formatted error.');
            }

            return result;
        } catch (parseError) {
             // If parsing fails, it means the response was not valid JSON.
             throw new Error(`GAS script returned a non-JSON response. This often indicates a script error or permission issue. Response: ${responseText}`);
        }

    } catch (error: any) {
        console.error('Failed to call GAS for status update:', error.message);
        return {
            status: 'error',
            message: error.message || 'An unknown error occurred while updating the sheet.',
        };
    }
}
