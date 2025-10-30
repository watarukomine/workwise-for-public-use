"use strict";
/**
 * Firebase Cloud Functions for the WorkWise application.
 * This file contains the backend logic for interacting with Google Calendar API.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatecalendarevent = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const google_auth_library_1 = require("google-auth-library");
const googleapis_1 = require("googleapis");
// Helper function to get an authenticated Google Calendar API client
async function getAuthenticatedCalendarClient() {
    logger.info("Authenticating with Google Calendar API...");
    const auth = new google_auth_library_1.GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/calendar"],
    });
    const authClient = await auth.getClient();
    const calendar = googleapis_1.google.calendar({ version: "v3", auth: authClient });
    logger.info("Authentication successful.");
    return calendar;
}
// CRITICAL: The function name must be all lowercase to be callable from the client SDK.
exports.updatecalendarevent = (0, https_1.onCall)({ region: 'asia-northeast1' }, async (request) => {
    var _a;
    const { operation, calendarId, eventId, title, startTime, endTime, description, } = request.data;
    logger.info(`Received calendar request:`, { operation, calendarId, eventId });
    if (!calendarId) {
        throw new https_1.HttpsError("invalid-argument", "A calendarId must be provided.");
    }
    const calendar = await getAuthenticatedCalendarClient();
    try {
        switch (operation) {
            case "create":
                if (!startTime || !endTime || !title) {
                    throw new https_1.HttpsError("invalid-argument", "For 'create' operation, startTime, endTime, and title are required.");
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
                    throw new https_1.HttpsError("invalid-argument", "For 'update' operation, eventId, startTime, endTime, and title are required.");
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
                    throw new https_1.HttpsError("invalid-argument", "For 'delete' operation, eventId is required.");
                }
                logger.info(`Deleting event ${eventId}...`);
                await calendar.events.delete({
                    calendarId,
                    eventId,
                });
                logger.info("Event deleted successfully.");
                return { status: "success", message: "イベントが削除されました。" };
            default:
                throw new https_1.HttpsError("invalid-argument", `Unknown operation: ${operation}`);
        }
    }
    catch (error) {
        logger.error("Error calling Google Calendar API:", error);
        // Rethrow a more specific error for the client
        throw new https_1.HttpsError("internal", `Google Calendar API Error: ${error.message}`, (_a = error.response) === null || _a === void 0 ? void 0 : _a.data);
    }
});
//# sourceMappingURL=index.js.map
