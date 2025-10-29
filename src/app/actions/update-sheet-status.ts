
'use server';

interface UpdateSheetStatusArgs {
    orderId: string;
    staffName: string | null; // Allow null to clear the name
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
        // Use URLSearchParams to send data as form data, which is robust for GAS.
        const formData = new URLSearchParams();
        formData.append('orderId', orderId);
        // Append staffName only if it's not null. GAS will see it as an empty string if it's ""
        // and won't see the parameter at all if it's null, which is fine.
        if (staffName !== null) {
            formData.append('staffName', staffName);
        }

        const response = await fetch(gasUrl, {
            method: 'POST',
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
            redirect: 'follow', 
        });

        const contentType = response.headers.get('content-type');
        const responseText = await response.text();
        
        if (!response.ok) {
             throw new Error(`GAS script returned a non-OK response. Status: ${response.status}. Response: ${responseText}`);
        }

        try {
            const result: GasResponse = JSON.parse(responseText);

            if(result.error === true || result.status === 'error'){
                throw new Error(result.message || 'GAS returned a JSON-formatted error.');
            }

            return result;
        } catch (parseError) {
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
