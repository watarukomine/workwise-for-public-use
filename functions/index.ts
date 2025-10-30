
/**
 * Firebase Cloud Functions for the WorkWise application.
 * This file contains the backend logic for interacting with Google Calendar API.
 */

import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {GoogleAuth} from "google-auth-library";
import {calendar_v3, google} from "googleapis";
import * as cors from "cors";

const corsHandler = cors({origin: true});

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
    const auth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/calendar"],
    });
    const authClient = await auth.getClient();
    const calendar = google.calendar({version: "v3", auth: authClient as any});
    logger.info("Authentication successful.");
    return calendar;
}

// CRITICAL: The function name must be all lowercase to be callable from the client SDK.
export const updatecalendarevent = onRequest({region: 'asia-northeast1'}, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== "POST") {
            res.status(405).send("Method Not Allowed");
            return;
        }

        const {
            operation,
            calendarId,
            eventId,
            title,
            startTime,
            endTime,
            description,
        } = req.body as CalendarEventArgs;

        logger.info(`Received calendar request:`, {operation, calendarId, eventId});

        if (!calendarId) {
            res.status(400).json({ status: "error", message: "A calendarId must be provided." });
            return;
        }

        const calendar = await getAuthenticatedCalendarClient();

        try {
            switch (operation) {
                case "create":
                    if (!startTime || !endTime || !title) {
                        res.status(400).json({ status: "error", message: "For 'create' operation, startTime, endTime, and title are required." });
                        return;
                    }
                    logger.info("Creating event...");
                    const createdEvent = await calendar.events.insert({
                        calendarId,
                        requestBody: {
                            summary: title,
                            description: description || "",
                            start: {dateTime: startTime, timeZone: "Asia/Tokyo"},
                            end: {dateTime: endTime, timeZone: "Asia/Tokyo"},
                        },
                    });
                    logger.info("Event created successfully:", {eventId: createdEvent.data.id});
                    res.status(200).json({
                        status: "success",
                        message: "イベントがカレンダーに作成されました。",
                        eventId: createdEvent.data.id,
                    });
                    return;

                case "update":
                    if (!eventId || !startTime || !endTime || !title) {
                        res.status(400).json({ status: "error", message: "For 'update' operation, eventId, startTime, endTime, and title are required."});
                        return;
                    }
                    logger.info(`Updating event ${eventId}...`);
                    const updatedEvent = await calendar.events.update({
                        calendarId,
                        eventId,
                        requestBody: {
                            summary: title,
                            description: description || "",
                            start: {dateTime: startTime, timeZone: "Asia/Tokyo"},
                            end: {dateTime: endTime, timeZone: "Asia/Tokyo"},
                        },
                    });
                    logger.info("Event updated successfully:", {eventId: updatedEvent.data.id});
                    res.status(200).json({
                        status: "success",
                        message: "イベントが更新されました。",
                        eventId: updatedEvent.data.id,
                    });
                    return;

                case "delete":
                    if (!eventId) {
                        res.status(400).json({ status: "error", message: "For 'delete' operation, eventId is required." });
                        return;
                    }
                    logger.info(`Deleting event ${eventId}...`);
                    await calendar.events.delete({
                        calendarId,
                        eventId,
                    });
                    logger.info("Event deleted successfully.");
                    res.status(200).json({status: "success", message: "イベントが削除されました。"});
                    return;

                default:
                    res.status(400).json({ status: "error", message: `Unknown operation: ${operation}` });
                    return;
            }
        } catch (error: any) {
            logger.error("Error calling Google Calendar API:", error);
            res.status(500).json({
                status: "error",
                message: `Google Calendar API Error: ${error.message}`,
                details: error.response?.data
            });
        }
    });
});
