
/**
 * Firebase Cloud Functions for the WorkWise application.
 * This file contains the backend logic for interacting with Google Calendar and Google Sheets APIs.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { google, type calendar_v3, type sheets_v4 } from "googleapis";
import { initializeApp, getApps } from "firebase-admin/app";

// Set the timezone for the function environment to Japan Standard Time
process.env.TZ = 'Asia/Tokyo';

// Initialize Firebase Admin SDK safely. This ensures it's done only once.
if (getApps().length === 0) {
  initializeApp();
  logger.info("Firebase Admin SDK initialized successfully.");
}

// This helper is simplified as auth is now handled directly in the onCall function.
async function getGoogleApis() {
    const auth = new google.auth.GoogleAuth({
        scopes: [
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/spreadsheets",
        ],
    });
    const authClient = await auth.getClient();
    google.options({ auth: authClient });
    return google;
}


// CRITICAL: The function name must be all lowercase to be callable from the client SDK.
export const updatecalendarevent = onCall({ region: 'asia-northeast1' }, async (request) => {
    // Log the entire raw request data for debugging
    logger.info("Received request data:", JSON.stringify(request.data, null, 2));

    const {
        operation,
        calendarId,
        eventId,
        title,
        startTime,
        endTime,
        description,
        spreadsheetId,
        sheetName,
        orderId,
        staffName,
    } = request.data;

    logger.info(`Parsed request for operation:`, { operation });

    try {
        const googleApi = await getGoogleApis();
        const calendar = googleApi.calendar({ version: "v3" });
        const sheets = googleApi.sheets({ version: "v4" });

        switch (operation) {
            case "create":
                if (!calendarId || !startTime || !endTime || !title) {
                    throw new HttpsError("invalid-argument", "For 'create', calendarId, startTime, endTime, and title are required.");
                }
                logger.info("Creating calendar event...");
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
                 if (!calendarId || !eventId || !startTime || !endTime || !title) {
                    throw new HttpsError("invalid-argument", "For 'update', eventId, startTime, endTime, and title are required.");
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
                if (!calendarId || !eventId) {
                    throw new HttpsError("invalid-argument", "For 'delete', calendarId and eventId are required.");
                }
                logger.info(`Deleting event ${eventId}...`);
                await calendar.events.delete({
                    calendarId,
                    eventId,
                });
                logger.info("Event deleted successfully.");
                return { status: "success", message: "イベントが削除されました。" };

            case "updateSheetStatus":
                 if (!spreadsheetId || !sheetName || !orderId) {
                    throw new HttpsError("invalid-argument", "For 'updateSheetStatus', spreadsheetId, sheetName, and orderId are required.");
                }
                return await updateSheet(sheets, spreadsheetId, sheetName, orderId, staffName);

            default:
                 logger.error(`Unknown operation received: ${operation}`);
                throw new HttpsError("invalid-argument", `Unknown operation: ${operation}`);
        }
    } catch (error: any) {
        logger.error("--- Detailed Error Start ---");
        logger.error("Error Name:", error.name);
        logger.error("Error Message:", error.message);
        logger.error("Error Code:", error.code || 'N/A');
        if (error.errors) {
            logger.error("Google API Errors:", JSON.stringify(error.errors, null, 2));
        }
        if (error.response?.data) {
            logger.error("Error Response Data:", JSON.stringify(error.response.data, null, 2));
        }
        logger.error("Full Error Stack:", error.stack);
        logger.error("--- Detailed Error End ---");
        
        // Throw a generic internal error to the client, but log the details for debugging.
        throw new HttpsError("internal", `An internal error occurred. Check function logs for details. Original: ${error.message}`);
    }
});


async function updateSheet(
    sheets: sheets_v4.Sheets,
    spreadsheetId: string,
    sheetName: string,
    orderId: string,
    staffName: string | null
) {
    logger.info("Starting sheet update...", { spreadsheetId, sheetName, orderId, staffName });
    
    // 1. Get spreadsheet metadata to find sheetId
    let sheetId: number | undefined;
    try {
        const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
        const sheet = spreadsheetMeta.data.sheets?.find(s => s.properties?.title === sheetName);
        if (sheet?.properties?.sheetId === undefined || sheet.properties.sheetId === null) {
            throw new HttpsError("not-found", `Sheet with name "${sheetName}" not found.`);
        }
        sheetId = sheet.properties.sheetId;
        logger.info(`Found sheetId: ${sheetId} for sheetName: "${sheetName}"`);
    } catch (e: any) {
        logger.error("Failed to get spreadsheet metadata.", { error: e.message });
        throw new HttpsError("internal", `Failed to get sheet metadata: ${e.message}`);
    }


    // 2. Find the header row to identify column indices
    let headers;
    try {
        const headerRange = `${sheetName}!1:1`;
        const headerResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: headerRange,
        });
        headers = headerResponse.data.values?.[0];
        if (!headers) {
            throw new HttpsError("not-found", `Sheet "${sheetName}" is empty or header row not found.`);
        }
    } catch (e: any) {
        logger.error("Failed to get header row.", { error: e.message });
        throw new HttpsError("internal", `Failed to read header row: ${e.message}`);
    }

    const orderIdColIndex = headers.findIndex(h => ['受注 ID', '受注id', '受注ID', 'id'].includes(h));
    const staffColIndex = headers.findIndex(h => h === '担当');
    const statusColIndex = headers.findIndex(h => h === 'ステータス');

    if (orderIdColIndex === -1) throw new HttpsError("not-found", "Could not find '受注 ID' column in the sheet.");
    if (staffColIndex === -1) throw new HttpsError("not-found", "Could not find '担当' column in the sheet.");
    if (statusColIndex === -1) throw new HttpsError("not-found", "Could not find 'ステータス' column in the sheet.");
    logger.info("Found column indices:", { orderIdColIndex, staffColIndex, statusColIndex });


    // 3. Find the row for the given orderId
    let targetRowIndex = -1;
    try {
        const orderIdColumnLetter = String.fromCharCode('A'.charCodeAt(0) + orderIdColIndex);
        const dataRange = `${sheetName}!${orderIdColumnLetter}2:${orderIdColumnLetter}`;
        const dataResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: dataRange,
        });
        const allOrderIds = dataResponse.data.values?.flat() || [];
        targetRowIndex = allOrderIds.findIndex(id => String(id) === String(orderId));

        if (targetRowIndex === -1) {
            throw new HttpsError("not-found", `Order with ID "${orderId}" not found in the sheet.`);
        }
    } catch (e: any) {
        logger.error("Failed to find orderId in sheet.", { orderId, error: e.message });
        if (e instanceof HttpsError) throw e;
        throw new HttpsError("internal", `Failed to search for orderId: ${e.message}`);
    }
    const targetRow = targetRowIndex + 2; // +1 for 1-based index, +1 because we started from row 2
    logger.info(`Found orderId "${orderId}" at row ${targetRow}`);

    // 4. Prepare the update requests
    const requests: sheets_v4.Schema$Request[] = [];
    const newStatus = staffName ? '割当済み' : '未割当';

    // Update staff name
    requests.push({
        updateCells: {
            range: {
                sheetId: sheetId,
                startRowIndex: targetRow - 1,
                endRowIndex: targetRow,
                startColumnIndex: staffColIndex,
                endColumnIndex: staffColIndex + 1,
            },
            rows: [{ values: [{ userEnteredValue: { stringValue: staffName || '' } }] }],
            fields: 'userEnteredValue',
        },
    });

    // Update status
    requests.push({
        updateCells: {
            range: {
                sheetId: sheetId,
                startRowIndex: targetRow - 1,
                endRowIndex: targetRow,
                startColumnIndex: statusColIndex,
                endColumnIndex: statusColIndex + 1,
            },
            rows: [{ values: [{ userEnteredValue: { stringValue: newStatus } }] }],
            fields: 'userEnteredValue',
        },
    });
    
    // 5. Execute the batch update
    try {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests },
        });

        logger.info("Sheet updated successfully.", { targetRow });
        return { status: "success", message: `シートのステータスを「${newStatus}」に更新しました。` };
    } catch(e: any) {
        logger.error("Failed to execute batchUpdate.", { error: e.message });
        throw new HttpsError("internal", `Failed to update sheet values: ${e.message}`);
    }
}
