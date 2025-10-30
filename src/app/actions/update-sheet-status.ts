
'use server';

interface UpdateSheetStatusArgs {
    gasUrl: string;
    eventTitle?: string | null;
    staffName?: string | null;
}

interface GasResponse {
    status: 'success' | 'error';
    message: string;
}

export async function updateSheetStatus(args: UpdateSheetStatusArgs): Promise<GasResponse> {
    const { gasUrl, eventTitle, staffName } = args;

    if (!gasUrl) {
        return { status: 'error', message: 'GAS URLが設定されていません。' };
    }
    
    // GASに渡すペイロードをstaffNameとeventTitleのみに単純化
    const payload = {
        eventTitle,
        staffName, 
    };

    try {
        const response = await fetch(gasUrl, {
            method: 'POST',
            headers: {
                 'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            cache: 'no-store',
            redirect: 'follow',
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
