
'use server';

import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeServerFirebase } from '@/firebase/server-init';

interface UpdateCalendarEventArgs {
    operation: 'create' | 'update' | 'delete';
    calendarId: string;
    eventId?: string;
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
}

interface FunctionResponse {
    status: 'success' | 'error';
    message: string;
    eventId?: string;
}

/**
 * Calls the `updateCalendarEvent` Cloud Function to interact with Google Calendar.
 * This server action acts as a client-side entry point to the secure backend function.
 * @param args - The arguments for the calendar operation.
 * @returns A promise that resolves to the response from the Cloud Function.
 */
export async function updateCalendarEvent(args: UpdateCalendarEventArgs): Promise<FunctionResponse> {
    try {
        // Use the server-side Firebase initialization.
        const { firebaseApp } = initializeServerFirebase();
        const functions = getFunctions(firebaseApp, 'asia-northeast1');

        // Get a callable reference to the Cloud Function.
        // CRITICAL: The function name MUST be all lowercase for the callable to work.
        const callable = httpsCallable<UpdateCalendarEventArgs, FunctionResponse>(functions, 'updatecalendarevent');

        console.log("Calling 'updatecalendarevent' Cloud Function with args:", args);

        // Call the function with the provided arguments.
        const result = await callable(args);
        
        console.log("Cloud Function response received:", result.data);

        return result.data;

    } catch (error: any) {
        console.error('Failed to call Cloud Function for calendar update:', error);
        
        // Provide a more user-friendly error message
        return {
            status: 'error',
            message: `カレンダー連携用のCloud Function呼び出しに失敗しました: ${error.message || '不明なエラーです。'}`,
        };
    }
}
