
'use server';

interface UpdateSheetStatusArgs {
    orderId?: string | null;
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

    // If there's no orderId, it's a generic task, so skip sheet update.
    if (!orderId) {
        return { status: 'success', message: '汎用タスクのためシート更新はスキップされました。' };
    }
    
    // This payload will be sent to the doPost function in Google Apps Script.
    // It's crucial that the keys here ('orderId', 'staffName', 'eventTitle')
    // match what the doPost function expects in its e.parameter.
    const payload = {
        orderId: orderId,
        staffName: staffName, // Can be null, which means un-assigning the task.
        eventTitle: eventTitle,
    };

    try {
        const response = await fetch(gasUrl, {
            method: 'POST',
            headers: {
                 // To send a JSON payload, you must set the Content-Type to application/json.
                 // GAS's `doPost` will then receive it in `e.postData.contents`.
                 'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            cache: 'no-store',
            // It's important to follow redirects, as a script published to "Anyone"
            // might initially redirect. A redirect to a Google sign-in page is a
            // clear indicator of a permissions issue.
            redirect: 'follow',
        });
        
        // If the final URL after following redirects is a Google sign-in page, it's an error.
        if (response.redirected && response.url.includes('accounts.google.com')) {
             throw new Error('GASへのアクセス権限がありません。GASのデプロイ設定で「アクセスできるユーザー」を「全員」にしてください。');
        }

        // We expect a JSON response from our GAS.
        const result = await response.json();
        
        // The GAS should return a `status` field. If it's 'error', something went wrong on the script side.
        if (result.status === 'error' || result.error) {
            throw new Error(result.message || 'GASスクリプトでシート更新エラーが発生しました。');
        }

        return result;
    } catch (error: any) {
        console.error('Failed to call GAS for sheet update:', error);
        // Return a structured error to the client.
        return {
            status: 'error',
            message: `シート更新用のGAS呼び出しに失敗しました: ${error.message}`,
        };
    }
}
