
'use server';

interface UpdateCalendarEventArgs {
    operation: 'create' | 'update' | 'delete';
    calendarId: string;
    eventId?: string;
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    gasUrl: string;
}

interface GasResponse {
    status: 'success' | 'error';
    message: string;
    eventId?: string;
    error?: boolean;
}

export async function updateCalendarEvent(args: UpdateCalendarEventArgs): Promise<GasResponse> {
    const { gasUrl, ...payload } = args;

    if (!gasUrl) {
        return { status: 'error', message: 'GAS URLが設定されていません。' };
    }
    
    // Use URLSearchParams for form-encoded data, which is more robust for GAS.
    const body = new URLSearchParams();
    // Append all keys from payload to the body. This ensures all needed data is sent.
    for (const key in payload) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
            const value = payload[key as keyof typeof payload];
            if (value !== undefined && value !== null) {
                body.append(key, String(value));
            }
        }
    }

    try {
        const response = await fetch(gasUrl, {
            method: 'POST',
            headers: {
                 'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
            cache: 'no-store',
            redirect: 'follow',
        });

        if (response.redirected && response.url.includes('accounts.google.com')) {
             throw new Error('GASへのアクセス権限がありません。GASのデプロイ設定で「アクセスできるユーザー」を「全員」にしてください。');
        }
        
        const result = await response.json();

        if (result.status === 'error' || result.error) {
            throw new Error(result.message || 'GASスクリプトでカレンダー操作エラーが発生しました。');
        }

        return result;
    } catch (error: any) {
        console.error('Failed to call GAS for calendar update:', error);
        return {
            status: 'error',
            message: `カレンダー連携用のGAS呼び出しに失敗しました: ${error.message}`,
        };
    }
}
