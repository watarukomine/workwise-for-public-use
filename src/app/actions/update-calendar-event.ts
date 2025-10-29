
'use server';

// This action is now a wrapper. The actual logic is handled by updateSheetStatus
// to centralize the use of a single GAS URL from the order context.
// We keep this file for now to avoid breaking imports, but the goal is to merge logic.

interface UpdateCalendarEventArgs {
    operation: 'create' | 'update' | 'delete';
    calendarId: string;
    eventId?: string;
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
}

interface GasResponse {
    status: 'success' | 'error';
    message: string;
    eventId?: string;
    error?: boolean;
}

export async function updateCalendarEvent(args: UpdateCalendarEventArgs): Promise<GasResponse> {
    // This is a proxy to the central GAS handling function.
    // In a future refactor, the calling components (e.g., schedule-view)
    // should be updated to call a more generic `updateGas` function.

    const gasUrl = null; // This will force the updateSheetStatus function to use its own logic to find the URL.

    const response = await fetch(process.env.NEXT_PUBLIC_BASE_URL + '/api/gas-proxy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...args, gasUrlSource: 'order' }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to call proxy for calendar update:', errorText);
        return {
            status: 'error',
            message: `プロキシ経由でのカレンダー更新に失敗しました: ${errorText}`,
        };
    }
    
    return await response.json();
}

async function callGas(gasUrl: string, args: UpdateCalendarEventArgs): Promise<GasResponse> {
     if (!gasUrl) {
        console.error('GAS URL for Calendar is not provided.');
        return { status: 'error', message: 'カレンダー連携用のGAS URLが設定されていません。' };
    }

    try {
        const formData = new URLSearchParams();
        // The operation is essential to distinguish between sheet updates and calendar events in the GAS doPost
        Object.entries(args).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                formData.append(key, String(value));
            }
        });

        const response = await fetch(gasUrl, {
            method: 'POST',
            cache: 'no-store',
            headers: {
                 'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
            redirect: 'follow',
        });
        
        if (response.url.includes('accounts.google.com')) {
            throw new Error('GASへのアクセス権限がありません。GASのデプロイ設定で「アクセスできるユーザー」を「全員」にしてください。');
        }

        const responseText = await response.text();
        
        if (!response.ok) {
             throw new Error(`GAS script returned a non-OK response. Status: ${response.status}. Response: ${responseText}`);
        }

        let result: GasResponse;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
             throw new Error(`GAS script returned a non-JSON response. This often indicates a script error or permission issue. Response: ${responseText}`);
        }
        
        if (result.error === true || result.status === 'error') {
            throw new Error(result.message || 'GAS script returned a JSON-formatted error.');
        }

        return result;

    } catch (error: any) {
        console.error('Failed to call GAS for calendar update:', error.message);
        return {
            status: 'error',
            message: error.message || 'カレンダーの更新中に不明なエラーが発生しました。',
        };
    }
}
