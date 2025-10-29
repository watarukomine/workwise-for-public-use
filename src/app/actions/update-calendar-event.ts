
'use server';

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

// 【重要】このURLは、ユーザーが作成するGoogleカレンダー連携用の新しいGASのウェブアプリURLに置き換える必要があります。
const DEFAULT_CALENDAR_GAS_URL = 'https://script.google.com/macros/s/AKfycbzoWDxQQlLCDBZ8tsXPCVavazZ14gkH--Q8AQ81rT7Ok1lxl_3lLNtgBdZ9ok6Run_X/exec';


export async function updateCalendarEvent(args: UpdateCalendarEventArgs): Promise<GasResponse> {
    
    // TODO: このURLをユーザーが設定できるように、将来的にはContextや設定ページから取得するように変更するのが望ましい。
    const gasUrl = process.env.CALENDAR_GAS_URL || DEFAULT_CALENDAR_GAS_URL;

    if (!gasUrl || gasUrl.includes('YOUR_NEW_CALENDAR_GAS_URL')) {
        console.error('GAS URL for Calendar is not provided or is default.');
        return { status: 'error', message: 'カレンダー連携用のGAS URLが設定されていません。' };
    }

    try {
        const response = await fetch(gasUrl, {
            method: 'POST',
            cache: 'no-store',
            headers: {
                // 'Content-Type': 'application/json' // GAS doPost with payload doesn't need this
            },
            // The `doPost(e)` in GAS expects the data in `e.postData.contents`.
            // To achieve this with `fetch`, the body should be a stringified payload.
            // However, some environments/fetch versions require it to be structured differently.
            // A common way that works is to send it as 'payload'.
            // Let's try sending a simple stringified body first.
            body: JSON.stringify(args),
            redirect: 'follow',
        });

        const contentType = response.headers.get('content-type');
        const responseText = await response.text();
        
        if (!response.ok) {
             throw new Error(`GAS script returned a non-OK response. Status: ${response.status}. Response: ${responseText}`);
        }

        try {
            const result: GasResponse = JSON.parse(responseText);

            if(result.error === true || result.status === 'error'){
                throw new Error(result.message || 'GAS returned a JSON-formatted error.');
            }

            return result;
        } catch (parseError) {
             throw new Error(`GAS script returned a non-JSON response. Response: ${responseText}`);
        }

    } catch (error: any) {
        console.error('Failed to call GAS for calendar update:', error.message);
        return {
            status: 'error',
            message: error.message || 'カレンダーの更新中に不明なエラーが発生しました。',
        };
    }
}
