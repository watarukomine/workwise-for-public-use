
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

    const payload = {
        orderId: orderId,
        staffName: staffName,
    };

    try {
        const response = await fetch(gasUrl, {
            method: 'POST',
            headers: {
                // 明示的にJSON形式で送信することを宣言
                'Content-Type': 'application/json',
            },
            // JavaScriptオブジェクトをJSON文字列に変換してbodyに設定
            body: JSON.stringify(payload),
            cache: 'no-store',
            redirect: 'follow'
        });

        if (response.redirected && response.url.includes('accounts.google.com')) {
             throw new Error('GASへのアクセス権限がありません。GASのデプロイ設定で「アクセスできるユーザー」を「全員」にしてください。');
        }
        
        // GASからのレスポンスは常にJSONとしてパースする
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
