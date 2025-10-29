
'use server';

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
    
    if (!gasUrl) {
        return { status: 'error', message: 'GAS URLが設定されていません。' };
    }

    const formData = new URLSearchParams();
    formData.append('orderId', orderId);
    // staffName が null の場合でも、キー自体は送信するようにする
    formData.append('staffName', staffName || '');


    try {
        const response = await fetch(gasUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
            cache: 'no-store',
            redirect: 'follow'
        });

        if (response.redirected && response.url.includes('accounts.google.com')) {
             throw new Error('GASへのアクセス権限がありません。GASのデプロイ設定で「アクセスできるユーザー」を「全員」にしてください。');
        }
        
        const resultText = await response.text();
        const result = JSON.parse(resultText);


        if (result.status === 'error') {
            throw new Error(result.message || 'GASスクリプトでエラーが発生しました。');
        }

        return result;

    } catch (error: any) {
        console.error('Failed to call GAS for sheet update:', error);
        // エラーメッセージにGASからの応答を含めることでデバッグしやすくする
        return {
            status: 'error',
            message: `GASの呼び出しに失敗しました: ${error.message}`,
        };
    }
}

