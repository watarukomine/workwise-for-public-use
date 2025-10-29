
'use server';

interface UpdateSheetStatusArgs {
    eventTitle: string; // 受注IDを含むイベントのタイトル
    staffName: string | null;
    gasUrl: string;
}

interface GasResponse {
    status: 'success' | 'error';
    message: string;
    error?: boolean; 
}

export async function updateSheetStatus({ eventTitle, staffName, gasUrl }: UpdateSheetStatusArgs): Promise<GasResponse> {
    
    if (!gasUrl) {
        return { status: 'error', message: 'GAS URLが設定されていません。' };
    }
    
    // 送信するデータをシンプルなJSONオブジェクトとして定義
    const payload = {
        eventTitle: eventTitle,
        staffName: staffName, // nullの場合もそのまま送信
    };

    try {
        const response = await fetch(gasUrl, {
            method: 'POST',
            headers: {
                // 明示的にJSON形式であることを指定
                'Content-Type': 'application/json',
            },
            // オブジェクトをJSON文字列に変換してbodyに設定
            body: JSON.stringify(payload),
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
