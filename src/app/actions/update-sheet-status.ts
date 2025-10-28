
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
            // The body needs to be a stringified JSON object
            body: JSON.stringify({
                orderId: orderId,
                staffName: staffName,
            }),
            // Since GAS POST requests might redirect, we follow them
            redirect: 'follow', 
        });

        // Check if the response is OK, and if the content type is JSON
        const contentType = response.headers.get('content-type');
        if (!response.ok || !contentType || !contentType.includes('application/json')) {
            const errorText = await response.text();
            throw new Error(`GAS script returned a non-JSON or error response. Status: ${response.status}. Response: ${errorText}`);
        }

        const result: GasResponse = await response.json();

        return result;

    } catch (error: any) {
        console.error('Failed to call GAS for status update:', error);
        return {
            status: 'error',
            message: error.message || 'An unknown error occurred while updating the sheet.',
        };
    }
}
