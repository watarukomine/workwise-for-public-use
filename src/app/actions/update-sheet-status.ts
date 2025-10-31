
'use server';

interface UpdateSheetStatusArgs {
    gasUrl: string;
    eventTitle?: string | null;
    staffName?: string | null;
    statusValue?: string | null;
    timestamp?: string | null;
}

interface GasResponse {
    status: 'success' | 'error';
    message: string;
    data?: any;
}

export async function updateSheetStatus(args: UpdateSheetStatusArgs): Promise<GasResponse> {
    const { gasUrl, eventTitle, staffName, statusValue, timestamp } = args;

    if (!gasUrl) {
        return { status: 'error', message: 'GAS URLが設定されていません。' };
    }

    try {
        console.log("Sending update request to GAS with body:", {
            eventTitle,
            staffName,
            statusValue,
            timestamp
        });

        const response = await fetch(gasUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                eventTitle,
                staffName,
                statusValue,
                timestamp,
            }),
            cache: 'no-store',
            redirect: 'follow',
        });
        
        console.log("GAS response status:", response.status);

        if (response.redirected && response.url.includes('accounts.google.com')) {
             throw new Error('GASへのアクセス権限がありません。GASのデプロイ設定で「アクセスできるユーザー」を「全員」にしてください。');
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`GASへのリクエストに失敗しました。 Status: ${response.status}. Response: ${errorText}`);
        }

        const result = await response.json();
        console.log("GAS response:", result);
        
        if (result.status === 'error' || result.error) {
            const errorMessage = result.message || 'GASスクリプトでシート更新エラーが発生しました。';
            if (errorMessage.includes('doPost Error') || errorMessage.includes('データ解析エラー')) {
                 throw new Error(errorMessage);
            }
            throw new Error(`GASスクリプトエラー: ${errorMessage}`);
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
