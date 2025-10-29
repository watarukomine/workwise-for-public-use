
'use server';

import { useOrder } from "@/contexts/order-context";

interface UpdateSheetStatusArgs {
    orderId: string;
    staffName: string | null;
    gasUrl: string; // This URL will be passed from the component
}

interface GasResponse {
    status: 'success' | 'error';
    message: string;
    error?: boolean; 
}


export async function updateSheetStatus({ orderId, staffName, gasUrl }: UpdateSheetStatusArgs): Promise<GasResponse> {
    if (!gasUrl) {
        console.error('担当者更新用のGAS URLが提供されていません。');
        return { status: 'error', message: '担当者更新用のGAS URLが設定されていません。「受注管理」ページで設定してください。' };
    }

    try {
        const formData = new URLSearchParams();
        formData.append('orderId', orderId);
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
        
        if (response.url.includes('accounts.google.com')) {
            throw new Error('GASへのアクセス権限がありません。GASのデプロイ設定で「アクセスできるユーザー」を「全員」にしてください。');
        }

        const responseText = await response.text();
        
        if (!response.ok) {
             throw new Error(`GAS script returned a non-OK response. Status: ${response.status}. Response: ${responseText}`);
        }

        let result: GasResponse;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
             throw new Error(`GAS script returned a non-JSON response. This often indicates a script error or permission issue. Response: ${responseText}`);
        }

        if (result.error === true || result.status === 'error') {
            throw new Error(result.message || 'GAS script returned a JSON-formatted error.');
        }

        return result;

    } catch (error: any) {
        console.error('Failed to call GAS for status update:', error.message);
        return {
            status: 'error',
            message: error.message || 'An unknown error occurred while updating the sheet.',
        };
    }
}
