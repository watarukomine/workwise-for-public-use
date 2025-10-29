
'use server';

interface UpdateSheetStatusArgs {
    orderId: string;
    staffName: string | null;
    gasUrl: string;
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
        
        // Check if the final URL after redirects is a Google sign-in page, indicating a permissions error.
        if (response.url.includes('accounts.google.com')) {
            throw new Error('GASへのアクセス権限がありません。GASのデプロイ設定で「アクセスできるユーザー」を「全員」にしてください。');
        }

        const responseText = await response.text();
        
        // First, check for a non-OK HTTP status
        if (!response.ok) {
             throw new Error(`GAS script returned a non-OK response. Status: ${response.status}. Response: ${responseText}`);
        }

        // If the response is not JSON, it's an error (e.g. HTML from a login page)
        let result: GasResponse;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
             throw new Error(`GAS script returned a non-JSON response. This often indicates a script error or permission issue. Response: ${responseText}`);
        }

        // Check for an application-level error within the JSON response
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
