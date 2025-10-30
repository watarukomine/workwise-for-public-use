
/**
 * Firebase Cloud Functions for the WorkWise application.
 * This file contains the backend logic for interacting with Google Calendar API.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { GoogleAuth } from "google-auth-library";
import { calendar_v3, google } from "googleapis";
import { initializeApp, getApps } from "firebase-admin/app";

// Set the timezone for the function environment to Japan Standard Time
process.env.TZ = 'Asia/Tokyo';

// Initialize Firebase Admin SDK safely. This ensures it's done only once.
if (getApps().length === 0) {
  initializeApp();
  logger.info("Firebase Admin SDK initialized successfully.");
}


// Define the structure of the data expected from the client
interface CalendarEventArgs {
    operation: "create" | "update" | "delete";
    calendarId: string;
    eventId?: string;
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
}

// Helper function to get an authenticated Google Calendar API client
async function getAuthenticatedCalendarClient(): Promise<calendar_v3.Calendar> {
    logger.info("Authenticating with Google Calendar API...");
    // Use Application Default Credentials, which are available in the Cloud Functions environment.
    // The scope is specified to request permission for calendar events.
    const auth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/calendar.events"],
    });
    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: "v3", auth: authClient });
    logger.info("Authentication successful.");
    return calendar;
}

// CRITICAL: The function name must be all lowercase to be callable from the client SDK.
export const updatecalendarevent = onCall({ region: 'asia-northeast1' }, async (request) => {
    const {
        operation,
        calendarId,
        eventId,
        title,
        startTime,
        endTime,
        description,
    } = request.data as CalendarEventArgs;

    logger.info(`Received calendar request:`, { operation, calendarId, eventId });

    if (!calendarId) {
        throw new HttpsError("invalid-argument", "A calendarId must be provided.");
    }

    const calendar = await getAuthenticatedCalendarClient();

    try {
        switch (operation) {
            case "create":
                if (!startTime || !endTime || !title) {
                    throw new HttpsError("invalid-argument", "For 'create' operation, startTime, endTime, and title are required.");
                }
                logger.info("Creating event...");
                const createdEvent = await calendar.events.insert({
                    calendarId,
                    requestBody: {
                        summary: title,
                        description: description || "",
                        start: { dateTime: startTime, timeZone: "Asia/Tokyo" },
                        end: { dateTime: endTime, timeZone: "Asia/Tokyo" },
                    },
                });
                logger.info("Event created successfully:", { eventId: createdEvent.data.id });
                return {
                    status: "success",
                    message: "イベントがカレンダーに作成されました。",
                    eventId: createdEvent.data.id,
                };

            case "update":
                if (!eventId || !startTime || !endTime || !title) {
                    throw new HttpsError("invalid-argument", "For 'update' operation, eventId, startTime, endTime, and title are required.");
                }
                logger.info(`Updating event ${eventId}...`);
                const updatedEvent = await calendar.events.update({
                    calendarId,
                    eventId,
                    requestBody: {
                        summary: title,
                        description: description || "",
                        start: { dateTime: startTime, timeZone: "Asia/Tokyo" },
                        end: { dateTime: endTime, timeZone: "Asia/Tokyo" },
                    },
                });
                logger.info("Event updated successfully:", { eventId: updatedEvent.data.id });
                return {
                    status: "success",
                    message: "イベントが更新されました。",
                    eventId: updatedEvent.data.id,
                };

            case "delete":
                if (!eventId) {
                    throw new HttpsError("invalid-argument", "For 'delete' operation, eventId is required.");
                }
                logger.info(`Deleting event ${eventId}...`);
                await calendar.events.delete({
                    calendarId,
                    eventId,
                });
                logger.info("Event deleted successfully.");
                return { status: "success", message: "イベントが削除されました。" };

            default:
                throw new HttpsError("invalid-argument", `Unknown operation: ${operation}`);
        }
    } catch (error: any) {
        logger.error("Error calling Google Calendar API:", {
            message: error.message,
            code: error.code,
            errors: error.errors, // Google API often returns detailed errors here
            response: error.response?.data,
        });
        // Rethrow a more specific error for the client
        throw new HttpsError("internal", `Google Calendar API Error: ${error.message}`, {
            details: error.response?.data?.error?.message || "No further details.",
        });
    }
});
