
'use server';

// This action now acts as a more direct proxy to the centralized GAS proxy API route.
// It requires the specific GAS URL to be passed in.

interface UpdateCalendarEventArgs {
    operation: 'create' | 'update' | 'delete';
    calendarId: string;
    eventId?: string;
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    gasUrl: string; // The GAS URL (from the order context) is now a required parameter.
}

interface GasResponse {
    status: 'success' | 'error';
    message: string;
    eventId?: string;
    error?: boolean;
}

export async function updateCalendarEvent(args: UpdateCalendarEventArgs): Promise<GasResponse> {
    
    // We pass all arguments, including the gasUrl, to the centralized proxy.
    const response = await fetch(process.env.NEXT_PUBLIC_BASE_URL + '/api/gas-proxy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
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
