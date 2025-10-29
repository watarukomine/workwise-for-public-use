
'use server';

interface UpdateSheetStatusArgs {
    orderId: string;
    staffName?: string | null;
    gasUrl: string;
}

interface GasResponse {
    status: 'success' | 'error';
    message: string;
}

export async function updateSheetStatus(args: UpdateSheetStatusArgs): Promise<GasResponse> {
    const { gasUrl, orderId, staffName } = args;

    if (!gasUrl) {
        return { status: 'error', message: 'GAS URLが設定されていません。' };
    }
     if (!orderId) {
        return { status: 'error', message: '更新対象の受注IDが必要です。' };
    }

    // Use URLSearchParams for form-encoded data, which is more robust for GAS.
    const body = new URLSearchParams();
    body.append('orderId', orderId);
    // Ensure staffName is always sent, even if it's an empty string to signify un-assignment.
    body.append('staffName', staffName || "");

    try {
        const response = await fetch(gasUrl, {
            method: 'POST',
            headers: {
                 'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
            cache: 'no-store',
            redirect: 'follow', // Important for handling GAS redirects
        });
        
        if (response.redirected && response.url.includes('accounts.google.com')) {
             throw new Error('GASへのアクセス権限がありません。GASのデプロイ設定で「アクセスできるユーザー」を「全員」にしてください。');
        }

        const result = await response.json();
        
        if (result.status === 'error' || result.error) {
            throw new Error(result.message || 'GASスクリプトでシート更新エラーが発生しました。');
        }

        return result;
    } catch (error: any) {
        console.error('Failed to call GAS for sheet update:', error);
        return {
            status: 'error',
            message: `シート更新用のGAS呼び出しに失敗しました: ${error.message}`,
        };
    }
}
