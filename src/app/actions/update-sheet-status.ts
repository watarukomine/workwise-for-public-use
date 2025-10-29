
'use server';

import { cookies } from 'next/headers';

interface UpdateSheetStatusArgs {
    orderId: string;
    staffName: string | null;
}

interface GasResponse {
    status: 'success' | 'error';
    message: string;
    error?: boolean; 
}


export async function updateSheetStatus({ orderId, staffName }: UpdateSheetStatusArgs): Promise<GasResponse> {
    
    // We will use a centralized proxy to handle this.
    // The component calling this doesn't know the URL, so we pass `null`.
    // The API route will retrieve the correct URL from the context's storage (localStorage via cookies).
    const response = await fetch(process.env.NEXT_PUBLIC_BASE_URL + '/api/gas-proxy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId, staffName, gasUrlSource: 'order' }),
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
