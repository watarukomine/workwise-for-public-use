
'use server';

// This action is now a wrapper. The actual logic is handled by updateSheetStatus
// to centralize the use of a single GAS URL from the order context.
// We keep this file for now to avoid breaking imports, but the goal is to merge logic.

interface UpdateSheetStatusArgs {
    orderId: string;
    staffName: string | null;
    gasUrl: string; // The specific GAS URL for orders must now be passed in.
}

interface GasResponse {
    status: 'success' | 'error';
    message: string;
    error?: boolean; 
}


export async function updateSheetStatus({ orderId, staffName, gasUrl }: UpdateSheetStatusArgs): Promise<GasResponse> {
    
    // The API proxy route is now more generic.
    // We pass the specific URL to it, which this action receives from the calling component.
    const response = await fetch(process.env.NEXT_PUBLIC_BASE_URL + '/api/gas-proxy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        // Pass the URL to the proxy, along with other arguments
        body: JSON.stringify({ gasUrl, orderId, staffName }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to call proxy for sheet update:', errorText);
        return {
            status: 'error',
            message: `プロキシ経由でのシート更新に失敗しました: ${errorText}`,
        };
    }
    
    return await response.json();
}
