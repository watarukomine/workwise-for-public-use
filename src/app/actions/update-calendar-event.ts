
'use server';

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFunctions } from 'firebase-admin/functions';
import { firebaseConfig } from '@/firebase/config';

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

// Ensure Firebase Admin is initialized only once on the server
if (getApps().length === 0) {
    initializeApp({
        projectId: firebaseConfig.projectId,
    });
}

/**
 * Calls the `updatecalendarevent` Cloud Function to interact with Google Calendar.
 * This server action acts as a client-side entry point to the secure backend function.
 * @param args - The arguments for the calendar operation.
 * @returns A promise that resolves to the response from the Cloud Function.
 */
export async function updateCalendarEvent(args: UpdateCalendarEventArgs): Promise<FunctionResponse> {
    try {
        const functions = getFunctions();
        const callable = functions.httpsCallable('updatecalendarevent', {
          region: 'asia-northeast1'
        });

        console.log("Calling 'updatecalendarevent' Cloud Function with args:", args);

        const result = await callable(args);
        
        console.log("Cloud Function response received:", result.data);

        // Assuming result.data is already in FunctionResponse format
        return result.data as FunctionResponse;

    } catch (error: any) {
        console.error('Failed to call Cloud Function for calendar update:', error);
        
        // Provide a more user-friendly error message
        return {
            status: 'error',
            message: `カレンダー連携用のCloud Function呼び出しに失敗しました: ${error.details || error.message || '不明なエラーです。'}`,
        };
    }
}
