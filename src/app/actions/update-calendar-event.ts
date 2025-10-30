
'use server';

import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeFirebase } from '@/firebase';

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
        // Firebase must be initialized to get the Functions instance.
        // This initialization is lightweight and safe to call multiple times.
        const { firebaseApp } = initializeFirebase();
        const functions = getFunctions(firebaseApp, 'asia-northeast1'); // It's good practice to specify the region.

        // Get a callable reference to the Cloud Function.
        const callable = httpsCallable<UpdateCalendarEventArgs, FunctionResponse>(functions, 'updatecalendarevent');

        console.log("Calling 'updateCalendarEvent' Cloud Function with args:", args);

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
