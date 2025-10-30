
'use server';

interface UpdateSheetStatusArgs {
    orderId?: string | null; // Make orderId optional
    staffName?: string | null;
    eventTitle?: string | null;
    gasUrl: string;
}

interface GasResponse {
    status: 'success' | 'error';
    message: string;
}

export async function updateSheetStatus(args: UpdateSheetStatusArgs): Promise<GasResponse> {
    const { gasUrl, orderId, staffName, eventTitle } = args;

    if (!gasUrl) {
        return { status: 'error', message: 'GAS URLが設定されていません。' };
    }

    // If there is no orderId, it's a generic task, so we can skip the sheet update.
    if (!orderId) {
        return { status: 'success', message: '汎用タスクのためシート更新はスキップされました。' };
    }
    
    // データがnullの場合でもキーが存在するように、明示的にnullを割り当て
    const payload = {
        orderId: orderId,
        staffName: staffName === undefined ? null : staffName,
        eventTitle: eventTitle === undefined ? null : eventTitle,
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
            // GAS側から返されたエラーメッセージを優先的に使用
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
