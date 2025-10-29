
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

// This URL will be updated by the user's input.
const DEFAULT_CALENDAR_GAS_URL = 'https://script.google.com/macros/s/AKfycbzoWDxQQlLCDBZ8tsXPCVavazZ14gkH--Q8AQ81rT7Ok1lxl_3lLNtgBdZ9ok6Run_X/exec';


export async function updateCalendarEvent(args: UpdateCalendarEventArgs): Promise<GasResponse> {
    
    const gasUrl = process.env.CALENDAR_GAS_URL || DEFAULT_CALENDAR_GAS_URL;

    if (!gasUrl || gasUrl.includes('YOUR_NEW_CALENDAR_GAS_URL')) {
        console.error('GAS URL for Calendar is not provided or is default.');
        return { status: 'error', message: 'カレンダー連携用のGAS URLが設定されていません。' };
    }

    try {
        // GASで e.parameter を使用するための形式に変換
        const formData = new URLSearchParams();
        Object.entries(args).forEach(([key, value]) => {
            if (value !== undefined) {
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
