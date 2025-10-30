
'use server';

interface UpdateSheetStatusArgs {
    staffId?: string | null;
    staffName?: string | null;
    eventTitle?: string | null;
    orderId?: string | null;
    gasUrl: string;
    statusColumnName?: string;
    statusValue?: string;
}

interface GasResponse {
    status: 'success' | 'error';
    message: string;
}

export async function updateSheetStatus(args: UpdateSheetStatusArgs): Promise<GasResponse> {
    const { gasUrl, staffId, staffName, eventTitle, orderId, statusColumnName, statusValue } = args;

    if (!gasUrl) {
        return { status: 'error', message: 'GAS URLが設定されていません。' };
    }
    
    // The payload sent to the doPost function in Google Apps Script.
    // The keys must match what the doPost function expects in e.parameter or e.postData.contents
    const payload = {
        staffId,
        staffName, 
        eventTitle,
        orderId,
        statusColumnName,
        statusValue,
    };

    try {
        const response = await fetch(gasUrl, {
            method: 'POST',
            headers: {
                 'Content-Type': 'text/plain;charset=utf-8',
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
