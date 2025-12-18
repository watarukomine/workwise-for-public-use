// ↓↓↓↓【要設定】↓↓↓↓
// 「受注管理」シートがあるスプレッドシートのIDを貼り付けてください
const ORDER_SPREADSHEET_ID = "17P4aHYXFdPUtWCrZY4G_LY_zcUYP9ClHNRVcMvj6c6s";
const ORDER_SHEET_NAME = "受注管理";

// 「スタッフマスタ」シートがあるスプレッドシートのIDを貼り付けてください
const STAFF_SPREADSHEET_ID = "18vztZhnAqDmQtlCNMERncTsCSe_hfMQ7TvcF-5S6IIo";
const STAFF_SHEET_NAME = "スタッフマスタ";
// ↓↓↓↓【設定はここまで】↓↓↓↓


/**
 * GET リクエストを処理し、スプレッドシートのデータを JSON で返します
 */
function doGet(e) {
    try {
        const spreadsheet = SpreadsheetApp.openById(ORDER_SPREADSHEET_ID);
        const sheet = spreadsheet.getSheetByName(ORDER_SHEET_NAME);
        if (!sheet) throw new Error(`シート '${ORDER_SHEET_NAME}' がスプレッドシートID '${ORDER_SPREADSHEET_ID}' 内に見つかりません。`);

        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();

        if (values.length < 1) {
            return ContentService.createTextOutput(JSON.stringify({ data: [] })).setMimeType(ContentService.MimeType.JSON);
        }

        const headers = values.shift();
        const sheetId = sheet.getSheetId();
        const spreadsheetId = sheet.getParent().getId();

        const data = values.map((row, rowIndex) => {
            const obj = {};
            headers.forEach((header, index) => {
                const cellValue = row[index];
                if (cellValue && cellValue instanceof Date && !isNaN(cellValue)) {
                    obj[header] = cellValue.toISOString();
                } else {
                    obj[header] = cellValue;
                }
            });
            obj["Order_URL"] = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}&range=A${rowIndex + 2}`;
            return obj;
        });

        return ContentService.createTextOutput(JSON.stringify({ data: data })).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
        console.error("GAS doGet Error:", error.message, error.stack);
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: `GAS doGet Error: ${error.message}` })).setMimeType(ContentService.MimeType.JSON);
    }
}

/**
 * POST リクエストを処理し、スプレッドシートを更新します
 */
function doPost(e) {
    try {
        console.log("doPost Request received:", JSON.stringify(e));

        let params;
        if (e.postData && e.postData.type === "application/json") {
            try {
                params = JSON.parse(e.postData.contents);
                console.log("JSON data parsed:", JSON.stringify(params));
            } catch (parseError) {
                console.error("JSON parse error:", parseError.message);
                return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "JSONデータの解析に失敗しました: " + parseError.message })).setMimeType(ContentService.MimeType.JSON);
            }
        } else {
            console.error("No JSON data received in request");
            return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "リクエストにJSONデータがありません" })).setMimeType(ContentService.MimeType.JSON);
        }

        // アクション分岐
        if (params.action === 'createOrder') {
            return createOrder(params);
        }

        // 既存の分岐処理
        if (params.operation === 'sendEmail') {
            return sendIcsEmail(params);
        } else if (params.eventTitle) { // Update sheet from app
            return updateSheetWithOrderInfo(params);
        } else {
            return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "必要なパラメータ (eventTitle, operation, action) がありません" })).setMimeType(ContentService.MimeType.JSON);
        }
    } catch (error) {
        console.error("Error in doPost:", error.message, error.stack);
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "エラーが発生しました: " + error.message })).setMimeType(ContentService.MimeType.JSON);
    }
}

/**
 * 新規注文を作成する関数
 */
function createOrder(data) {
    try {
        const spreadsheet = SpreadsheetApp.openById(ORDER_SPREADSHEET_ID);
        let sheet = spreadsheet.getSheetByName(ORDER_SHEET_NAME);

        if (!sheet) {
            // もしシート名が見つからない場合は、名前で探さずに一番左のシートを使う（フォールバック）
            sheet = spreadsheet.getSheets()[0];
        }

        var nextRow = sheet.getLastRow() + 1;
        var timestamp = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");

        // カラム構成（A列=0番目スタート）に合わせてデータを配置
        // ※シートの列順序が変更された場合は、この配列の順序も修正する必要があります。
        // 今回の変更: C列を「店舗名」、D列を「主管店舗」として扱います。
        var rowData = [
            '',                   // A: 受注ID (自動採番または空欄)
            data.userCode,        // B: ユーザーコード
            data.storeName,       // C: 店舗名 (旧: お取引先名)
            data.mainStore || '', // D: 主管店舗 (新規追加)
            '',                   // E: 機材有無 (フォーム入力なし、空欄)
            "'" + data.scheduledDate, // F: 作業予定日
            "'" + data.scheduledTime, // G: 予定時間
            data.picName,         // H: ご担当者様
            data.workType || '販売店店舗内作業', // I: 作業 (デフォルト「販売店店舗内作業」)
            data.orderNo,         // J: 受注No(リマーク1)
            data.comment,         // K: 任意コメント(リマーク2)
            data.carName,         // L: 車名
            data.regNo,           // M: 登録ナンバー
            data.status,          // N: 入庫状況
            data.tireNumber,      // O: タイヤ品番
            data.tireSize,        // P: タイヤサイズ
            data.productName,     // Q: 品名
            '',                   // R: 作業内容
            data.quantity,        // S: 本数
            data.sensor,          // T: タイヤ手配状況 (注意: カラムズレの可能性あり、元のコードの順序に従う)
            data.arrangement,     // U: タイヤ手配状況 (選択式)
            data.disposal,        // V: 廃タイヤ処分
            data.contact,         // W: 連絡先
            '未着手',             // X: 受注ステータス (デフォルト)
            '',                   // Y: 担当
            timestamp             // Z: 最終更新日時
        ];

        sheet.appendRow(rowData);

        return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Order created', row: nextRow })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        console.error("Error in createOrder:", error.message, error.stack);
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "作成中にエラーが発生しました: " + error.message })).setMimeType(ContentService.MimeType.JSON);
    }
}

/**
 * 受注IDでシートを検索し、指定された情報で更新する
 */
/**
 * 受注IDでシートを検索し、指定された情報で更新する
 */
function updateSheetWithOrderInfo(params) {
    const {
        eventTitle, staffName, statusValue, timestamp, latitude, longitude, actionType,
        actionTimestamp, scheduledTime, scheduledEndTime
    } = params;

    try {
        console.log("Updating sheet with:", JSON.stringify(params));

        const orderSpreadsheet = SpreadsheetApp.openById(ORDER_SPREADSHEET_ID);
        const sheet = orderSpreadsheet.getSheetByName(ORDER_SHEET_NAME);
        if (!sheet) throw new Error(`シート「${ORDER_SHEET_NAME}」がスプレッドシートID '${ORDER_SPREADSHEET_ID}' 内に見つかりません。`);

        const data = sheet.getDataRange().getValues();
        const headers = data[0];

        let rowNum = -1;
        let foundOrder = false;
        let orderId = null;

        // 1. Try to extract Order ID from eventTitle
        const match = eventTitle ? eventTitle.match(/\(ID:\s*([\w-]+)\)/) : null;

        if (match && match[1] && match[1].toUpperCase() !== 'N/A') {
            orderId = match[1];
            const orderIdCol = headers.indexOf("受注ID");
            if (orderIdCol !== -1) {
                for (let i = 1; i < data.length; i++) {
                    if (String(data[i][orderIdCol]) === String(orderId)) {
                        rowNum = i + 1;
                        break;
                    }
                }
            }
        }

        // 2. Special Logic for "Clock In" only: If no ID found/provided, search for FIRST order of the day
        if (rowNum === -1 && actionType === 'Clock In' && staffName) {
            console.log("Clock In: No ID provided. Searching for first order of day for staff:", staffName);

            const today = timestamp ? new Date(timestamp) : new Date();
            today.setHours(0, 0, 0, 0);

            // Support both "スタッフ名" and "担当"
            let staffColIdx = headers.indexOf("スタッフ名");
            if (staffColIdx === -1) staffColIdx = headers.indexOf("担当");

            const dateColIdx = headers.indexOf("作業予定日");
            const timeColIdx = headers.indexOf("予定時間");

            if (staffColIdx !== -1 && dateColIdx !== -1) {
                let candidates = [];
                for (let i = 1; i < data.length; i++) {
                    const rowStaff = String(data[i][staffColIdx]);
                    const rowDateVal = data[i][dateColIdx];

                    let rowDate = null;
                    if (rowDateVal instanceof Date) rowDate = rowDateVal;
                    else if (rowDateVal && !isNaN(new Date(rowDateVal).getTime())) rowDate = new Date(rowDateVal);

                    if (rowDate) {
                        rowDate.setHours(0, 0, 0, 0);
                        // Clean up staff name comparison (trim)
                        if (rowStaff.trim() === staffName.trim() && rowDate.getTime() === today.getTime()) {
                            candidates.push({ rowIndex: i + 1, timeVal: data[i][timeColIdx], rowData: data[i] });
                        }
                    }
                }

                if (candidates.length > 0) {
                    // Sort by time
                    candidates.sort((a, b) => {
                        let tA = a.timeVal;
                        let tB = b.timeVal;
                        // Handle Date objects or Strings
                        if (tA instanceof Date) tA = Utilities.formatDate(tA, "Asia/Tokyo", "HH:mm");
                        if (tB instanceof Date) tB = Utilities.formatDate(tB, "Asia/Tokyo", "HH:mm");
                        return (tA < tB) ? -1 : (tA > tB) ? 1 : 0;
                    });

                    rowNum = candidates[0].rowIndex;
                    foundOrder = true;
                    console.log("Found first order for Clock In. Row:", rowNum);
                } else {
                    console.log("No orders found for staff today.");
                }
            } else {
                console.warn("Columns 'スタッフ名'/'担当' or '作業予定日' not found.");
            }
        }


        // 3. Update Logic
        const updateColumn = (colName, value) => {
            if (value !== undefined) {
                let colIdx = headers.indexOf(colName);

                // Fallback alias for Staff/ 担当
                if (colIdx === -1) {
                    if (colName === "担当") colIdx = headers.indexOf("スタッフ名");
                    else if (colName === "スタッフ名") colIdx = headers.indexOf("担当");
                }

                if (colIdx !== -1) {
                    sheet.getRange(rowNum, colIdx + 1).setValue(value);
                    console.log(`Updated column '${colName}' (or alias) with value: ${value}`);
                } else {
                    console.log(`Column '${colName}' not found. Skipping.`);
                }
            }
        };

        if (rowNum !== -1) {
            console.log(`Updating row: ${rowNum}`);

            // For normal flow with ID, we update everything.
            // For Clock In flow (foundOrder), specific updates.

            if (foundOrder && actionType === 'Clock In') {
                // Logic: Found first order -> Update "出勤ボタン"
                updateColumn("出勤ボタン", actionTimestamp ? new Date(actionTimestamp) : new Date());
                // Also update Location and Timestamp
                updateColumn("最終更新日時", timestamp ? new Date(timestamp) : new Date());
                if (latitude !== undefined && longitude !== undefined) {
                    updateColumn("最終位置情報（緯度,経度）", `${latitude}, ${longitude}`);
                }

                return ContentService.createTextOutput(JSON.stringify({
                    status: "success",
                    message: "当日の最初の案件の出勤ボタンを更新しました。",
                    row: rowNum
                })).setMimeType(ContentService.MimeType.JSON);

            } else {
                // Normal Update (ID based)
                updateColumn("担当", staffName); // Uses helper to find '担当' or 'スタッフ名'
                updateColumn("受注ステータス", statusValue);
                updateColumn("最終更新日時", timestamp ? new Date(timestamp) : undefined);
                if (latitude !== undefined && longitude !== undefined) {
                    updateColumn("最終位置情報（緯度,経度）", `${latitude}, ${longitude}`);
                }
                updateColumn("チップ配置作業予定", scheduledTime ? new Date(scheduledTime) : (scheduledTime === "" ? "" : undefined));
                updateColumn("チップ配置作業完了予定", scheduledEndTime ? new Date(scheduledEndTime) : (scheduledEndTime === "" ? "" : undefined));

                if (actionType && actionTimestamp) {
                    const dateValue = new Date(actionTimestamp);
                    const actionColMap = {
                        'Start Travel': "移動開始",
                        'Arrive': "現場到着",
                        'Begin Task': "作業開始",
                        'Finish Task': "作業完了",
                        // "Clock In" is handled above specifically for First Order logic,
                        // but if we had an ID passed explicitly for Clock In, we might want to update it here too?
                        // But usually Clock In doesn't have ID.
                    };
                    if (actionColMap[actionType]) {
                        updateColumn(actionColMap[actionType], dateValue);
                    }
                }
                return ContentService.createTextOutput(JSON.stringify({ status: "success", message: `受注ID: ${orderId} を更新しました。`, })).setMimeType(ContentService.MimeType.JSON);
            }

        } else {
            // No Row Found (and not found via search)
            // If Clock In, we want to update LOCATION regardless?
            // "出勤ボタン" logic: "もし...出動予定のない場合はタイムスタンプの入力はせず、位置情報の更新だけを行う"

            if (actionType === 'Clock In') {
                console.log("Clock In: No order found. Attempting location update only.");
                // Where do we stick the location?
                // If no order row, we can't stick it in an order row.
                // Maybe update "Staff Master"?

                // Let's try to find Staff in Staff Master
                const staffSheet = orderSpreadsheet.getSheetByName(STAFF_SHEET_NAME); // Assuming same spreadsheet or use STAFF_SPREADSHEET_ID
                if (staffSheet) { // Note: STAFF_SPREADSHEET_ID defined at top
                    // Actually open the specific staff spreadsheet
                    // The code at top defines STAFF_SPREADSHEET_ID separate from ORDER_SPREADSHEET_ID?
                    // Yes: const STAFF_SPREADSHEET_ID = ...

                    let staffSpreadsheet = null;
                    try {
                        staffSpreadsheet = SpreadsheetApp.openById(STAFF_SPREADSHEET_ID);
                    } catch (e) {
                        console.log("Could not open Staff Spreadsheet separate from Order Spreadsheet.");
                    }

                    if (staffSpreadsheet) {
                        const sSheet = staffSpreadsheet.getSheetByName(STAFF_SHEET_NAME);
                        if (sSheet) {
                            const sData = sSheet.getDataRange().getValues();
                            const sHeaders = sData[0];

                            // Support '氏名' or 'スタッフ名'
                            let sNameCol = sHeaders.indexOf("氏名");
                            if (sNameCol === -1) sNameCol = sHeaders.indexOf("スタッフ名");

                            const sLocCol = sHeaders.indexOf("現在地"); // Assuming '現在地' exists? Or '位置情報'?

                            // If headers don't match, we can't update.
                            // But let's assume if it fails, we just log.

                            if (sNameCol !== -1) {
                                let sRowNum = -1;
                                for (let j = 1; j < sData.length; j++) {
                                    if (String(sData[j][sNameCol]).trim() === staffName.trim()) {
                                        sRowNum = j + 1;
                                        break;
                                    }
                                }

                                if (sRowNum !== -1) {
                                    if (latitude !== undefined && longitude !== undefined) {
                                        // Check if column exists
                                        let targetCol = sHeaders.indexOf("現在地");
                                        if (targetCol === -1) targetCol = sHeaders.indexOf("Location");

                                        if (targetCol !== -1) {
                                            sSheet.getRange(sRowNum, targetCol + 1).setValue(`${latitude}, ${longitude}`);
                                            // Update timestamp too?
                                            let tsCol = sHeaders.indexOf("最終更新日時");
                                            if (tsCol !== -1) {
                                                sSheet.getRange(sRowNum, tsCol + 1).setValue(timestamp ? new Date(timestamp) : new Date());
                                            }

                                            return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "本日の予定はありませんが、スタッフマスタの位置情報を更新しました。" })).setMimeType(ContentService.MimeType.JSON);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // If we couldn't update anything
                return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "本日の予定がなく、位置情報の更新先も見つかりませんでしたが、処理は完了しました。" })).setMimeType(ContentService.MimeType.JSON);
            }

            throw new Error(`指定された受注IDまたは当日の予定が見つかりませんでした。`);
        }

    } catch (error) {
        console.error("Error in updateSheetWithOrderInfo:", error.message, error.stack);
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.message })).setMimeType(ContentService.MimeType.JSON);
    }
}

function sendIcsEmail(params) {
    const { staffName, staffEmail, title, description, startTime, endTime, location, isUpdate } = params;
    try {
        if (!staffEmail) throw new Error("宛先メールアドレスが指定されていません。");

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(staffEmail)) {
            return ContentService.createTextOutput(JSON.stringify({ status: "error", message: `担当者 (${staffName}) のメールアドレス形式が正しくありません。` }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        const startDate = new Date(startTime);
        const endDate = new Date(endTime);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new Error("開始・終了日時が不正です。ISO文字列などパース可能な形式で送ってください。");
        }
        if (endDate <= startDate) {
            throw new Error("終了日時は開始日時より後である必要があります。");
        }

        const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
        const formatToIcsDate = (date) =>
            date.getUTCFullYear() +
            ('0' + (date.getUTCMonth() + 1)).slice(-2) +
            ('0' + date.getUTCDate()).slice(-2) + 'T' +
            ('0' + date.getUTCHours()).slice(-2) +
            ('0' + date.getUTCMinutes()).slice(-2) +
            ('0' + date.getUTCSeconds()).slice(-2) + 'Z';

        const now = new Date();
        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//WorkWise//EN',
            'METHOD:REQUEST',
            'BEGIN:VEVENT',
            'UID:' + Utilities.getUuid(),
            'DTSTAMP:' + formatToIcsDate(now),
            'DTSTART:' + formatToIcsDate(startDate),
            'DTEND:' + formatToIcsDate(endDate),
            'SUMMARY:' + esc(title),
            'DESCRIPTION:' + esc(description),
            'LOCATION:' + esc(location),
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        const subject = isUpdate ? "【予定変更】" + title : "【新規予定】" + title;
        const body = isUpdate
            ? "割り当てられた予定が変更されました。添付のiCalendarファイルを開いてカレンダーを更新してください。"
            : "新しい予定が割り当てられました。添付のiCalendarファイルを開いてカレンダーに追加してください。";

        const options = {
            attachments: [{ fileName: "invite.ics", content: icsContent, mimeType: "text/calendar; charset=UTF-8; method=REQUEST" }]
        };

        MailApp.sendEmail(staffEmail, subject, body, options);
        return ContentService.createTextOutput(JSON.stringify({ status: "success", message: `担当者 ${staffName} に予定のメールを送信しました。` }))
            .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: `メール送信中にエラーが発生しました: ${error.message}` }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}
