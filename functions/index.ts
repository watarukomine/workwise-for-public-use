
/**
 * Firebase Cloud Functions for the WorkWise application.
 * This file contains the backend logic for interacting with Google Calendar API.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { google, type calendar_v3 } from "googleapis";
import { initializeApp, getApps } from "firebase-admin/app";

// Set the timezone for the function environment to Japan Standard Time
process.env.TZ = 'Asia/Tokyo';

// Initialize Firebase Admin SDK safely. This ensures it's done only once.
if (getApps().length === 0) {
  initializeApp();
  logger.info("Firebase Admin SDK initialized successfully.");
}


// Helper function to get an authenticated Google Calendar API client
// This function relies on Application Default Credentials provided by the Cloud Functions environment.
async function getAuthenticatedCalendarClient(): Promise<calendar_v3.Calendar> {
    logger.info("Getting Google Calendar API client...");
    // When running in a Google Cloud environment, the googleapis library
    // automatically uses the service account credentials of the function.
    const calendar = google.calendar({ version: "v3" });
    logger.info("Google Calendar API client obtained successfully.");
    return calendar;
}


// CRITICAL: The function name must be all lowercase to be callable from the client SDK.
export const updatecalendarevent = onCall({ region: 'asia-northeast1' }, async (request) => {
    // Log the entire raw request data for debugging
    logger.info("Received request data:", JSON.stringify(request.data, null, 2));
    logger.info("Auth context:", JSON.stringify(request.auth, null, 2));


    const {
        operation,
        calendarId,
        eventId,
        title,
        startTime,
        endTime,
        description,
    } = request.data;

    logger.info(`Parsed calendar request:`, { operation, calendarId, eventId });

    if (!calendarId) {
        logger.error("Validation failed: calendarId is missing.");
        throw new HttpsError("invalid-argument", "A calendarId must be provided.");
    }

    try {
        const calendar = await getAuthenticatedCalendarClient();

        switch (operation) {
            case "create":
                if (!startTime || !endTime || !title) {
                    logger.error("Validation failed for 'create': Missing required fields.", { startTime, endTime, title });
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
                     logger.error("Validation failed for 'update': Missing required fields.", { eventId, startTime, endTime, title });
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
                    logger.error("Validation failed for 'delete': eventId is missing.");
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
                 logger.error(`Unknown operation received: ${operation}`);
                throw new HttpsError("invalid-argument", `Unknown operation: ${operation}`);
        }
    } catch (error: any) {
        logger.error("--- Detailed Error Start ---");
        logger.error("Error Message:", error.message);
        logger.error("Error Code:", error.code);
        if (error.errors) {
            logger.error("Google API Errors:", JSON.stringify(error.errors, null, 2));
        }
        if (error.response) {
            logger.error("Error Response Data:", JSON.stringify(error.response.data, null, 2));
        }
        logger.error("Full Error Object:", JSON.stringify(error, null, 2));
        logger.error("--- Detailed Error End ---");
        
        // Rethrow a detailed error for the client to potentially catch more info
        throw new HttpsError("internal", `Google Calendar API Error: ${error.message}`, {
            details: error.response?.data?.error || "No further details.",
            fullError: JSON.parse(JSON.stringify(error)) // Serialize the full error object
        });
    }
});


/**
 * A simple debug function to check if data is being received from the client.
 */
export const debugcalendar = onCall({ region: 'asia-northeast1' }, (request) => {
    logger.info("--- DEBUG FUNCTION CALLED ---");
    logger.info("Received auth context:", JSON.stringify(request.auth, null, 2));
    logger.info("Received data:", JSON.stringify(request.data, null, 2));
    logger.info("--- DEBUG FUNCTION END ---");
    
    return {
        status: "success",
        message: "デバッグデータを受信しました。",
        receivedData: request.data
    };
});
