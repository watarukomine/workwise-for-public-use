
'use server';

interface UpdateSheetStatusArgs {
    gasUrl: string;
    eventTitle?: string | null;
    staffName?: string | null;
    statusValue?: '未割当' | '作業待ち' | '移動中' | '作業中' | '作業完了' | '待機中' | '';
}

interface GasResponse {
    status: 'success' | 'error';
    message: string;
}

export async function updateSheetStatus(args: UpdateSheetStatusArgs): Promise<GasResponse> {
    const { gasUrl, eventTitle, staffName, statusValue } = args;

    if (!gasUrl) {
        return { status: 'error', message: 'GAS URLが設定されていません。' };
    }
    
    // Build the payload dynamically based on provided arguments.
    // This makes the action more flexible and only sends what's necessary.
    const payload: { [key: string]: any } = {};
    if (eventTitle !== undefined) {
        payload.eventTitle = eventTitle;
    }
    if (staffName !== undefined) {
        payload.staffName = staffName;
    }
    if (statusValue !== undefined) {
        payload.statusValue = statusValue;
    }

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
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`GASへのリクエストに失敗しました。 Status: ${response.status}. Response: ${errorText}`);
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
