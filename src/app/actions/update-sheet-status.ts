
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
        return { status: 'error', message: 'GAS URLが設定されていません。' };
    }

    // Use URLSearchParams to ensure 'application/x-www-form-urlencoded' format
    const body = new URLSearchParams();
    body.append('orderId', orderId);
    // Ensure staffName is always present, even if empty, to satisfy GAS.
    body.append('staffName', staffName || '');

    try {
        const response = await fetch(gasUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
            cache: 'no-store',
            redirect: 'follow'
        });

        if (response.redirected && response.url.includes('accounts.google.com')) {
             throw new Error('GASへのアクセス権限がありません。GASのデプロイ設定で「アクセスできるユーザー」を「全員」にしてください。');
        }
        
        const result = await response.json();

        if (result.status === 'error' || result.error) {
            throw new Error(result.message || 'GASスクリプトでエラーが発生しました。');
        }

        return result;

    } catch (error: any) {
        console.error('Failed to call GAS for sheet update:', error);
        return {
            status: 'error',
            message: `GASの呼び出しに失敗しました: ${error.message}`,
        };
    }
}
