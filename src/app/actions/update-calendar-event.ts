
'use server';

interface UpdateCalendarEventArgs {
    operation: 'create' | 'update' | 'delete';
    calendarId: string;
    eventId?: string;
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    gasUrl: string; // The GAS URL is now a required parameter.
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

    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(payload)) {
        if (value !== undefined && value !== null) {
            formData.append(key, String(value));
        }
    }

    try {
        const response = await fetch(gasUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
            cache: 'no-store',
            redirect: 'follow',
        });

        if (response.redirected && response.url.includes('accounts.google.com')) {
             throw new Error('GASへのアクセス権限がありません。GASのデプロイ設定で「アクセスできるユーザー」を「全員」にしてください。');
        }

        const result = await response.json();

        if (result.status === 'error') {
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
