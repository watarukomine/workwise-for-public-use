// ↓↓↓↓【要設定】↓↓↓↓
// 「受注管理」シートがあるスプレッドシートのIDを貼り付けてください
const ORDER_SPREADSHEET_ID = "17P4aHYXFdPUtWCrZY4G_LY_zcUYP9ClHNRVcMvj6c6s";
const ORDER_SHEET_NAME = "受注管理";
// 「スタッフマスタ」シートがあるスプレッドシートのIDを貼り付けてください
const STAFF_SPREADSHEET_ID = "18vztZhnAqDmQtlCNMERncTsCSe_hfMQ7TvcF-5S6IIo";
const STAFF_SHEET_NAME = "スタッフマスタ";
const ACTION_LOG_SHEET_NAME = "行動予定"; // 汎用タスク（休憩・移動等）の保存先

// Firebase Realtime Database URL (シグナル用)
const FIREBASE_DB_URL = "https://workwisebu2-31559534-cd9ee-default-rtdb.firebaseio.com";
// ↓↓↓↓【設定はここまで】↓↓↓↓
/**
 * GET リクエストを処理し、スプレッドシートのデータを JSON で返します
 * 受注データと行動予定データを統合して返します
 */
function doGet(e) {
    try {
        const orderDataResult = [];
        let staffDataResult = [];

        // 1. 受注データの取得
        try {
            const orderSpreadsheet = SpreadsheetApp.openById(ORDER_SPREADSHEET_ID);
            const orderSheet = orderSpreadsheet.getSheetByName(ORDER_SHEET_NAME);
            if (orderSheet) {
                const orderData = getSheetData(orderSheet);
                orderData.forEach(row => {
                    row._type = 'order'; // 識別子
                    orderDataResult.push(row);
                });
            }
        } catch (err) {
            console.error("Order Sheet Read Error:", err);
        }

        // 2. 行動予定データの取得
        try {
            const staffSpreadsheet = SpreadsheetApp.openById(STAFF_SPREADSHEET_ID);
            let actionSheet = staffSpreadsheet.getSheetByName(ACTION_LOG_SHEET_NAME);
            if (actionSheet) {
                const actionData = getSheetData(actionSheet);
                actionData.forEach(row => {
                    row._type = 'task'; // 識別子
                    row.id = row['ID'];
                    row.staffName = row['スタッフ名'];
                    row.taskDetails = row['業務内容'];
                    row.description = row['詳細'];
                    row.scheduledTime = row['開始日時'];
                    row.scheduledEndTime = row['終了日時'];
                    row.status = '未割当';
                    orderDataResult.push(row);
                });
            }
        } catch (err) {
            console.error("Action Log Sheet Read Error:", err);
        }

        // 3. スタッフマスタの取得 (高速化のための統合)
        try {
            const staffSpreadsheet = SpreadsheetApp.openById(STAFF_SPREADSHEET_ID);
            const staffSheet = staffSpreadsheet.getSheetByName(STAFF_SHEET_NAME);
            if (staffSheet) {
                staffDataResult = getSheetData(staffSheet);
            }
        } catch (err) {
            console.error("Staff Sheet Read Error:", err);
        }

        // 統合されたレスポンスを返す
        const response = {
            status: "success",
            orders: orderDataResult,
            staff: staffDataResult,
            // 互換性維持のための data フィールド（旧バージョン対応）
            data: orderDataResult
        };

        return ContentService.createTextOutput(JSON.stringify(response))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        console.error("GAS doGet Error:", error.message, error.stack);
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: `GAS doGet Error: ${error.message}` }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}
// シートデータをオブジェクト配列として取得するヘルパー
function getSheetData(sheet) {
    const dataRange = sheet.getDataRange();
    const displayValues = dataRange.getDisplayValues(); // String representation (formatted)
    const rawValues = dataRange.getValues(); // Raw objects (Date, number, boolean)

    if (displayValues.length < 1) return [];

    const headers = displayValues.shift();
    rawValues.shift(); // Remove buffer for headers from raw array matches

    const sheetId = sheet.getSheetId();
    const spreadsheetId = sheet.getParent().getId();

    return displayValues.map((row, rowIndex) => {
        const obj = {};
        const rawRow = rawValues[rowIndex];

        headers.forEach((header, index) => {
            const displayValue = row[index];
            const rawValue = rawRow[index];

            // CRITICAL FIX: If raw value is a Date object, use it (toISOString) to preserve full date info,
            // even if the sheet formatting hides the date (e.g. "HH:mm").
            if (rawValue && rawValue instanceof Date && !isNaN(rawValue.getTime())) {
                obj[header] = rawValue.toISOString();
            } else {
                obj[header] = displayValue;
            }
        });
        // Order_URL (編集用リンク)
        obj["Order_URL"] = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}&range=A${rowIndex + 2}`;

        // SystemIDがない古いデータへの互換性対応
        // SystemIDが空なら、便宜的にRowIDを使う（ただしソート危険性は残るが、アプリが落ちないようにする）
        if (!obj['SystemID']) {
            // 下位互換用：SystemID列が無い、または空の場合は
            // 既存ロジック(createOrderでSystemIDを埋めるまではここに来ないかもですが)
        }
        return obj;
    });
}
/**
 * POST リクエストを処理し、スプレッドシートを更新します
 */
function doPost(e) {
    try {
        let params;
        if (e.postData && e.postData.type === "application/json") {
            try {
                params = JSON.parse(e.postData.contents);
            } catch (parseError) {
                return errorResponse("JSONデータの解析に失敗しました: " + parseError.message);
            }
        } else {
            return errorResponse("リクエストにJSONデータがありません");
        }
        // アクション分岐
        if (params.operation === 'sendEmail') {
            return sendIcsEmail(params);
        } else if (params.action === 'createTask') { // 新規: 汎用タスク作成
            return createTask(params);
        } else if (params.action === 'updateOrderSchedule') { // 新規: 受注の日時更新
            return updateOrderSchedule(params);
        } else if (params.eventTitle || params.systemId || params.orderId) { // 既存更新
            return updateSheetWithOrderInfo(params);
        } else if (params.action === 'createOrder') { // 新規注文
            return createOrder(params);
        } else {
            return errorResponse("必要なパラメータ (eventTitle, action, または operation) がありません");
        }
    } catch (error) {
        return errorResponse("エラーが発生しました: " + error.message);
    }
}
function errorResponse(msg) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: msg })).setMimeType(ContentService.MimeType.JSON);
}
function successResponse(msg, data) {
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: msg, ...data })).setMimeType(ContentService.MimeType.JSON);
}
/**
 * 汎用タスク（行動記録）を新規作成する機能
 * スタッフマスタ側の「行動予定」シートに追記します
 */
function createTask(params) {
    const { staffName, taskName, description, startTime, endTime } = params;
    try {
        const ss = SpreadsheetApp.openById(STAFF_SPREADSHEET_ID);
        let sheet = ss.getSheetByName(ACTION_LOG_SHEET_NAME);
        // シートが無ければ作成
        if (!sheet) {
            sheet = ss.insertSheet(ACTION_LOG_SHEET_NAME);
            // ヘッダー行作成
            sheet.appendRow(['ID', 'スタッフ名', '業務内容', '詳細', '開始日時', '終了日時', '作成日時']);
        }
        // ID生成
        const id = 'task-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000);
        const now = new Date();
        // 行追加
        sheet.appendRow([
            id,
            staffName,
            taskName,
            description || '',
            startTime ? new Date(startTime) : '',
            endTime ? new Date(endTime) : '',
            now
        ]);
        // 信号を送信
        SpreadsheetApp.flush();
        // 信号を送信
        sendFirebaseSignal();
        return successResponse("タスクを作成しました", { eventId: id });
    } catch (e) {
        console.error("createTask Error:", e);
        return errorResponse("タスク作成エラー: " + e.message);
    }
}
/**
 * 注文（受注）を新規作成する機能
 * 受注管理シートに追記します
 */
function createOrder(params) {
    try {
        const spreadsheet = SpreadsheetApp.openById(ORDER_SPREADSHEET_ID);
        const sheet = spreadsheet.getSheetByName(ORDER_SHEET_NAME);
        if (!sheet) throw new Error(`シート「${ORDER_SHEET_NAME}」が見つかりません。`);
        const headers = sheet.getDataRange().getValues()[0];
        // SystemID列があるかチェック
        let sysIdColIndex = -1;
        headers.forEach((h, i) => {
            if (String(h).trim() === "SystemID") sysIdColIndex = i;
        });
        if (sysIdColIndex === -1) {
            // SystemID列がなければ自動追加（危険回避のため、追加後にメッセージを返すのもありだが、ここでは追加して続行）
            // ただし、列挿入はユーザーに行わせるほうが安全（上記手順1に従ってもらう）
            // throw new Error("「SystemID」列が見つかりません。シートに追加してください。");
        }
        // 新しいSystemIDの生成: ScheduledDate_UserCode_Random3
        // 作成日ではなく「作業予定日」をIDのプレフィックスにする

        let targetDate = new Date();
        if (params.scheduledDate) {
            const scheduled = new Date(params.scheduledDate);
            if (!isNaN(scheduled.getTime())) {
                targetDate = scheduled;
            }
        }

        const yyyy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
        const dd = String(targetDate.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}${mm}${dd}`;

        const userCode = params.userCode || 'guest';
        const randomStr = Utilities.getUuid().split('-')[0].substring(0, 3);
        const newSystemId = `${dateStr}_${userCode}_${randomStr}`;
        // ---------------------------------------------------------
        // 2. Prepare Data (Static Order ID Calculation)
        // ---------------------------------------------------------
        // 数式の =ROW()-1 ではなく、現在の最大値を取得して +1 した値を固定値としてセットする
        // これにより行の並び替えを行ってもIDが変わらなくなる

        let maxId = 0;
        const idColIndex = headers.indexOf("受注ID");
        if (idColIndex !== -1) {
            const colLetter = String.fromCharCode(65 + idColIndex);
            // ID列の既存値をすべて取得 (ヘッダー除く 2行目以降)
            const existingIds = sheet.getRange(`${colLetter}2:${colLetter}`).getValues();
            for (let i = 0; i < existingIds.length; i++) {
                const val = existingIds[i][0];
                const numVal = Number(val);
                // 数値として有効で、現在の最大値より大きければ記録
                if (!isNaN(numVal) && numVal > maxId) {
                    maxId = numVal;
                }
            }
        }

        const nextId = maxId + 1;
        const numericId = nextId; // レスポンス用
        // データの書き込み先行を決定 (最終行+1)
        const targetRow = sheet.getLastRow() + 1;
        const newRow = [];
        headers.forEach(header => {
            const h = String(header).trim();
            if (h === "受注ID") {
                newRow.push(nextId); // 固定数値！
            } else if (h === "SystemID") {
                newRow.push(newSystemId); // 【重要】絶対不変のID
            } else if (h === "顧客コード" || h === "ユーザーコード") {
                newRow.push(params.userCode || "");
            } else if (h === "お取引先名" || h === "店舗" || h === "店舗名") {
                newRow.push(params.storeName || "");
            } else if (h === "主管店舗") {
                newRow.push(params.mainStore || "");
            } else if (h === "作業内容" || h === "作業") {
                newRow.push(params.workType || "");
            } else if (h === "作業予定日") {
                newRow.push(params.scheduledDate || "");
            } else if (h === "予定時間") {
                newRow.push(params.scheduledTime || "");
            } else if (h === "ご担当者様" || h === "担当者名") {
                newRow.push(params.picName || "");
            } else if (h === "担当") {
                newRow.push(""); // 弊社担当者はフォームからは空欄にする
            } else if (h === "注文番号" || h.includes("受注No")) {
                newRow.push(params.orderNo || "");
            } else if (h.includes("任意コメント")) {
                newRow.push(params.comment || "");
            } else if (h === "緊急連絡") {
                newRow.push(""); // フォームからは緊急連絡は空欄
            } else if (h === "緊急フラグ") {
                newRow.push(false); // 初期値はfalse
            } else if (h === "管理者返信") {
                newRow.push(""); // 初期値は空
            } else if (h === "車名") {
                newRow.push(params.carName || "");
            } else if (h.includes("登録ナンバー")) {
                newRow.push(params.regNo || "");
            } else if (h === "受注ステータス" || h === "入庫状況") {
                newRow.push(params.status || "入庫待ち");
            } else if (h === "タイヤ品番") {
                newRow.push(params.tireNumber || "");
            } else if (h === "タイヤサイズ") {
                newRow.push(params.tireSize || "");
            } else if (h === "品名") {
                newRow.push(params.productName || "");
            } else if (h === "本数") {
                newRow.push(params.quantity || "");
            } else if (h.includes("センサー")) {
                newRow.push(params.sensor || "");
            } else if (h === "タイヤ手配状況" || h === "手配") {
                newRow.push(params.arrangement || "");
            } else if (h === "廃タイヤ処分" || h === "廃タイヤ") {
                newRow.push(params.disposal || "");
            } else if (h === "連絡者名" || h === "連絡者") {
                newRow.push(params.contact || "");
            } else if (h === "特記事項") {
                newRow.push(params.specialNotes || "");
            } else if (h === "フォーム入力者") {
                newRow.push(params.submitter || "");
            } else if (h === "最終更新日時" || h === "受信日時") {
                newRow.push(new Date());
            } else {
                newRow.push("");
            }
        });
        // 書き込み
        sheet.getRange(targetRow, 1, 1, newRow.length).setValues([newRow]);
        // 信号を送信
        sendFirebaseSignal();
        // SystemIDを返す (Frontendはこれを使って管理する)
        return successResponse("注文を登録しました。", { orderId: newSystemId, displayId: targetRow - 1 });
    } catch (error) {
        console.error("createOrder Error:", error);
        return errorResponse("注文登録エラー: " + error.message);
    }
}
/**
 * SystemID (または旧ID) でシートを検索し更新する
 */
function updateSheetWithOrderInfo(params) {
    const { eventTitle, staffName, statusValue, timestamp, latitude, longitude, actionType, actionTimestamp, scheduledTime, scheduledEndTime, scheduledDate, comment, specialNotes, systemId, emergencyFlag, adminReply } = params;
    try {
        let searchId = systemId;
        let searchColumnName = "SystemID";
        // SystemIDが指定されていない場合は、従来のタイトルパースを試みる
        if (!searchId) {
            const match = eventTitle ? eventTitle.match(/\(ID:\s*([\w-]+)\)/) : null;
            searchId = match ? match[1] : null;
        }

        // 【修正点】IDが見つからないが、eventTitleなどが渡っている場合はフォールバック検索のために続行させるフラグなどが必要
        // 本来は searchId が必須だが、汎用タスク(ID無し)の削除のために、searchIdなしでも検索へ進む
        let isFallbackSearch = false;
        if (!searchId) {
            // return errorResponse("更新対象のIDが見つかりません (SystemID または Title内ID)");
            isFallbackSearch = true;
        }

        // 汎用タスク（行動記録シート）の更新判定
        if (searchId && String(searchId).startsWith('task-')) {
            return updateTaskSheet(searchId, params);
        }

        // --- Order Sheet Update ---
        const orderSpreadsheet = SpreadsheetApp.openById(ORDER_SPREADSHEET_ID);
        const sheet = orderSpreadsheet.getSheetByName(ORDER_SHEET_NAME);
        if (!sheet) throw new Error(`シート「${ORDER_SHEET_NAME}」が見つかりません。`);
        const data = sheet.getDataRange().getValues();
        const rawHeaders = data[0];
        const headers = rawHeaders.map(h => String(h).trim().toLowerCase());

        const findColumnIndex = (names) => {
            const candidates = Array.isArray(names) ? names : [names];
            const lowerCandidates = candidates.map(n => String(n).trim().toLowerCase());

            // 1. Exact match (case-insensitive)
            for (let cand of lowerCandidates) {
                const idx = headers.indexOf(cand);
                if (idx !== -1) return idx;
            }

            // 2. Partial match (if header contains candidate or vice versa)
            for (let i = 0; i < headers.length; i++) {
                for (let cand of lowerCandidates) {
                    if (headers[i] && cand && (headers[i].indexOf(cand) !== -1 || cand.indexOf(headers[i]) !== -1)) {
                        console.log("Fuzzy match found: '" + rawHeaders[i] + "' for candidate '" + cand + "'");
                        return i;
                    }
                }
            }
            return -1;
        };

        // 検索変数
        let targetRowNum = -1;
        let sysIdColIndex = -1;

        // 1. SystemID / 受注ID で検索
        if (searchId) {
            sysIdColIndex = findColumnIndex(["SystemID", "システムID", "sid"]);
            if (sysIdColIndex !== -1) {
                for (let i = 1; i < data.length; i++) {
                    const cellVal = String(data[i][sysIdColIndex]).trim();
                    const targetId = String(searchId).trim();
                    if (cellVal === targetId) {
                        targetRowNum = i + 1;
                        break;
                    }
                }
            }
            // SystemIDで見つからなかった場合、かつ searchId が数字っぽい場合は「受注ID」列も探してみる
            if (targetRowNum === -1) {
                const displayIdColIndex = findColumnIndex(["受注ID", "オーダーID", "管理番号", "ID"]);
                if (displayIdColIndex !== -1) {
                    for (let i = 1; i < data.length; i++) {
                        const cellVal = String(data[i][displayIdColIndex]).trim();
                        const targetId = String(searchId).trim();
                        if (cellVal === targetId) {
                            targetRowNum = i + 1;
                            break;
                        }
                    }
                }
            }
        }

        // 2. フォールバック検索: IDで見つからなかった場合、かつ担当者名と時間がある場合 (汎用タスク救済)
        if (targetRowNum === -1 && staffName && scheduledTime) {
            console.log("No matching ID found. Trying content-based search (Staff+Date+Time)...");
            console.log("Target: Staff=" + staffName + ", Time=" + scheduledTime); // Debug Log

            const staffColIdx = findColumnIndex(["担当", "スタッフ名", "弊社担当", "担当者"]);
            const dateColIdx = findColumnIndex(["作業予定日", "予定日", "日付"]);
            const timeColIdx = findColumnIndex(["予定時間", "開始時間", "時間"]);

            if (staffColIdx !== -1 && dateColIdx !== -1) {
                const targetDate = new Date(scheduledTime);
                const targetTimeStr = Utilities.formatDate(targetDate, "Asia/Tokyo", "HH:mm");
                targetDate.setHours(0, 0, 0, 0);

                // Start searching from recent rows backwards? No, standard forward search is fine for now but safer to match exact
                for (let i = 1; i < data.length; i++) {
                    const rowStaff = String(data[i][staffColIdx]);
                    const rowDateVal = data[i][dateColIdx];
                    const rowTimeVal = data[i][timeColIdx]; // String or Date

                    let rowDate = null;
                    if (rowDateVal instanceof Date) rowDate = rowDateVal;
                    else if (rowDateVal && !isNaN(new Date(rowDateVal).getTime())) rowDate = new Date(rowDateVal);

                    // 時間比較用の文字列生成
                    let rowTimeStr = "";
                    if (rowTimeVal instanceof Date) rowTimeStr = Utilities.formatDate(rowTimeVal, "Asia/Tokyo", "HH:mm");
                    else if (rowTimeVal) {
                        const s = String(rowTimeVal);
                        if (s.includes(":")) {
                            const parts = s.split(":");
                            if (parts.length >= 2) {
                                let d = new Date(); d.setHours(parts[0], parts[1]);
                                rowTimeStr = Utilities.formatDate(d, "Asia/Tokyo", "HH:mm");
                            }
                        }
                    }

                    if (rowDate) {
                        rowDate.setHours(0, 0, 0, 0);
                        // 条件一致確認: 担当者(スペース削除)、日付、時間
                        // Normalize names by removing ALL spaces
                        const normalizedRowStaff = rowStaff.replace(/\s+/g, '');
                        const normalizedTargetStaff = staffName.replace(/\s+/g, '');

                        if (normalizedRowStaff === normalizedTargetStaff && rowDate.getTime() === targetDate.getTime()) {
                            // Check Time match strictly first
                            if (rowTimeStr === targetTimeStr) {
                                targetRowNum = i + 1;
                                console.log("Found match by Content (Staff+Date+Time) at Row:", targetRowNum);
                                break;
                            }
                        }
                    }
                }
            }
        }

        if (targetRowNum === -1) {
            // Order Sheetで見つからなかった場合、Action Logシートも探してみる
            console.log("Not found in Order Sheet. Trying Action Log Sheet Fallback...");
            try {
                return updateTaskSheet(null, params); // IDなしで呼び出し
            } catch (e) {
                console.log("Not found in Action Log Sheet either.");
                throw new Error(`ID: ${searchId || '(ID指定なし)'} がどちらのシートにも見つかりませんでした。`);
            }
        }

        const debugLog = [];
        const updateColumn = (colNames, value) => {
            const colIdx = findColumnIndex(colNames);
            if (colIdx !== -1 && value !== undefined) {
                sheet.getRange(targetRowNum, colIdx + 1).setValue(value);
                debugLog.push(`Updated ${rawHeaders[colIdx]} to ${value}`);
            } else if (value !== undefined) {
                debugLog.push(`Column NOT FOUND for candidates: ${JSON.stringify(colNames)}`);
            }
        };
        // Update Fields
        updateColumn(["担当", "スタッフ名", "弊社担当"], staffName);
        updateColumn(["受注ステータス", "ステータス", "判定結果"], statusValue); // キャンセル等を反映

        updateColumn(["最終更新日時", "更新日時", "timestamp"], timestamp ? new Date(timestamp) : undefined);
        if (latitude !== undefined && longitude !== undefined) {
            updateColumn(["最終位置情報（緯度,経度）", "位置情報", "座標"], `${latitude}, ${longitude}`);
        }
        if (scheduledTime) {
            updateColumn(["チップ配置作業予定", "予定時間", "開始時間"], new Date(scheduledTime));
        }
        if (scheduledEndTime) {
            updateColumn(["チップ配置作業完了予定", "終了時間", "完了時間"], new Date(scheduledEndTime));
        }
        if (scheduledDate) updateColumn(["作業予定日", "予定日"], new Date(scheduledDate));
        if (comment !== undefined) {
            // スタッフからの緊急連絡
            updateColumn(["緊急連絡", "任意コメント", "受注コメント", "スタッフ連絡", "連絡事項"], comment);
        }
        if (emergencyFlag !== undefined) updateColumn(["緊急フラグ", "緊急ステータス", "緊急", "フラグ"], emergencyFlag);
        if (adminReply !== undefined) updateColumn(["管理者返信", "返信", "管理者からの返信", "回答", "管理者回答", "コメント", "管理者コメント"], adminReply);
        if (specialNotes !== undefined) updateColumn(["特記事項", "備考", "メモ", "特記"], specialNotes);
        if (actionType && actionTimestamp) {
            const dateValue = new Date(actionTimestamp);
            const actionColMap = {
                'Start Travel': "移動開始",
                'Arrive': "現場到着",
                'Begin Task': "作業開始",
                'Finish Task': "作業完了",
            };
            if (actionColMap[actionType]) {
                updateColumn(actionColMap[actionType], dateValue);
            }
        }

        // キャンセル情報
        if (params.cancelDate) {
            updateColumn("キャンセル日時", new Date(params.cancelDate));
            updateColumn("キャンセル連絡者", params.cancelContact);
        }
        SpreadsheetApp.flush(); // Ensure immediate write
        // 信号を送信
        sendFirebaseSignal();

        // --- パフォーマンス改善: メール送信の統合 ---
        let emailResultMsg = "";
        if (params.shouldSendEmail && params.emailParams) {
            try {
                const res = sendIcsEmailInternal(params.emailParams);
                if (res.status === "success") {
                    emailResultMsg = " (メール送信成功)";
                } else {
                    emailResultMsg = ` (メール送信失敗: ${res.message})`;
                }
            } catch (e) {
                emailResultMsg = ` (メール送信エラー: ${e.message})`;
            }
        }

        return successResponse(`ID: ${searchId || '内容一致'} を更新しました。${emailResultMsg}`, {
            debugInfo: {
                targetRowNum: targetRowNum,
                searchId: searchId,
                foundId: targetRowNum !== -1 && sysIdColIndex !== -1 ? data[targetRowNum - 1][sysIdColIndex] : null,
                updates: debugLog,
                actualHeaders: headers
            }
        });
    } catch (error) {
        console.error("updateSheetWithOrderInfo Error:", error);
        return errorResponse(error.message);
    }
}
// 汎用タスク（行動記録）更新用
function updateTaskSheet(taskId, params) {
    const ss = SpreadsheetApp.openById(STAFF_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ACTION_LOG_SHEET_NAME);
    if (!sheet) throw new Error("行動予定シートが見つかりません");

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf("ID");

    let rowNum = -1;
    // 1. ID検索
    if (taskId) {
        for (let i = 1; i < data.length; i++) {
            if (String(data[i][idCol]) === String(taskId)) {
                rowNum = i + 1;
                break;
            }
        }
    }

    // 2. IDで見つからない場合、Fallback検索 (Staff + Time)
    if (rowNum === -1 && params.staffName && params.scheduledTime) {
        const staffName = params.staffName;
        const scheduledTime = params.scheduledTime;
        console.log("updateTaskSheet: ID mismatch or missing. Trying content search...", staffName, scheduledTime);

        const staffColIdx = headers.indexOf("スタッフ名");
        const startColIdx = headers.indexOf("開始日時");

        if (staffColIdx !== -1 && startColIdx !== -1) {
            const targetDate = new Date(scheduledTime);
            const targetTimeStr = Utilities.formatDate(targetDate, "Asia/Tokyo", "HH:mm");
            targetDate.setHours(0, 0, 0, 0);

            // Normalize target staff name
            const normTargetStaff = staffName.replace(/\s+/g, '');

            for (let i = 1; i < data.length; i++) {
                const rowStaff = String(data[i][staffColIdx]);
                const rowStartVal = data[i][startColIdx];

                let rowDate = null;
                if (rowStartVal instanceof Date) rowDate = rowStartVal;
                else if (rowStartVal && !isNaN(new Date(rowStartVal).getTime())) rowDate = new Date(rowStartVal);

                if (rowDate) {
                    // Check match
                    // 1. Name (normalized)
                    const normRowStaff = rowStaff.replace(/\s+/g, '');
                    // 2. Date & Time
                    const rowTimeStr = Utilities.formatDate(rowDate, "Asia/Tokyo", "HH:mm");
                    rowDate.setHours(0, 0, 0, 0);

                    if (normRowStaff === normTargetStaff && rowDate.getTime() === targetDate.getTime() && rowTimeStr === targetTimeStr) {
                        rowNum = i + 1;
                        console.log("Found task match by Content at Row:", rowNum);
                        break;
                    }
                }
            }
        }
    }

    if (rowNum === -1) throw new Error("タスクIDが見つかりません: " + (taskId || 'ID不明'));

    // キャンセル（削除）処理
    if (params.statusValue === 'キャンセル' || params.actionType === 'cancel') {
        sheet.deleteRow(rowNum);
        SpreadsheetApp.flush(); // 即時反映
        // 信号を送信
        sendFirebaseSignal();
        return successResponse(`タスクID: ${taskId} を削除しました。`, {
            debug: {
                action: 'deleteRow',
                row: rowNum,
                id: taskId,
                paramsStatus: params.statusValue
            }
        });
    }

    // 通常更新
    const mapping = {
        'スタッフ名': params.staffName,
        '業務内容': (params.title || params.taskName) ? (params.title || params.taskName) : (params.eventTitle && !String(params.eventTitle).startsWith('(ID:') ? params.eventTitle : undefined),
        '開始日時': params.scheduledTime ? new Date(params.scheduledTime) : undefined,
        '終了日時': params.scheduledEndTime ? new Date(params.scheduledEndTime) : undefined,
    };

    Object.keys(mapping).forEach(header => {
        const val = mapping[header];
        if (val !== undefined) {
            const col = headers.indexOf(header);
            if (col !== -1) sheet.getRange(rowNum, col + 1).setValue(val);
        }
    });

    // 信号を送信
    sendFirebaseSignal();
    return successResponse(`タスクID: ${taskId} を更新しました。`);
}
/**
 * Firebase Realtime Database にデータ更新の信号を送る
 */
function sendFirebaseSignal() {
    try {
        if (!FIREBASE_DB_URL) return;
        const url = FIREBASE_DB_URL + "/signals/orders_updated.json";
        const payload = JSON.stringify({
            timestamp: new Date().getTime()
        });
        const options = {
            method: "put",
            contentType: "application/json",
            payload: payload,
            muteHttpExceptions: true
        };
        UrlFetchApp.fetch(url, options);
    } catch (e) {
        console.error("Firebase Signal Error:", e);
    }
}
function sendIcsEmail(params) {
    const res = sendIcsEmailInternal(params);
    return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
}

/**
 * メールの送信ロジック（内部用）
 * さまざまなアクションから共通で呼び出せるように分離
 */
function sendIcsEmailInternal(params) {
    const { staffName, staffEmail, title, description, startTime, endTime, location, isUpdate, submitter } = params;
    try {
        if (!staffEmail) throw new Error("宛先メールアドレスが指定されていません。");
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(staffEmail)) {
            return { status: "error", message: `担当者 (${staffName}) のメールアドレス形式が正しくありません。` };
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
            'DESCRIPTION:' + esc(submitter ? `${description}\\nフォーム入力者: ${submitter}` : description),
            'LOCATION:' + esc(location),
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');
        const subject = isUpdate ? "【予定変更】" + title : "【新規予定】" + title;
        const body = (isUpdate
            ? "割り当てられた予定が変更されました。\n\n"
            : "新しい予定が割り当てられました。\n\n") +
            "【受注詳細】\n" + description + "\n\n" +
            "添付のiCalendarファイルを開いてカレンダーに追加/更新してください。";
        const htmlBody = body.replace(/\n/g, '<br>');
        const options = {
            name: "WorkWise",
            htmlBody: htmlBody,
            attachments: [{ fileName: "invite.ics", content: icsContent, mimeType: "text/calendar; charset=UTF-8; method=REQUEST" }]
        };
        try {
            MailApp.sendEmail(staffEmail, subject, body, options);
            return { status: "success", message: `担当者 ${staffName} (${staffEmail}) に予定のメールを送信しました。` };
        } catch (mailError) {
            console.error("MailApp Error:", mailError.message);
            return { status: "error", message: `メールの送信権限がないか、アドレスに誤りがあります (${staffEmail}): ${mailError.message}` };
        }
    } catch (error) {
        return { status: "error", message: `処理中にメール送信でエラーが発生しました: ${error.message}` };
    }
}

/**
     * 初回の権限承認を行うためのダミー関数です
     * GASエディタでこの関数を選択して実行（「実行」ボタンをクリック）することで
     * 必要な権限を一度に認可できます。
     */
function doAuth() {
    // スプレッドシートへのアクセスとログ出力のみ行います。
    // スコア（権限）の検知はコード内に MailApp.sendEmail が存在するだけで自動で行われます。
    const ssName = SpreadsheetApp.openById(ORDER_SPREADSHEET_ID).getName();
    Logger.log("認可チェック完了: " + ssName);
}

/**
 * 受注の作業予定日と予定時間を更新する機能
 * フロントエンドから編集された日付・時間をスプレッドシートに反映します
 */
function updateOrderSchedule(params) {
    try {
        const { orderId, scheduledDate, scheduledTime } = params;

        if (!orderId) {
            return errorResponse("受注IDが指定されていません");
        }

        const spreadsheet = SpreadsheetApp.openById(ORDER_SPREADSHEET_ID);
        const sheet = spreadsheet.getSheetByName(ORDER_SHEET_NAME);

        if (!sheet) {
            return errorResponse(`シート「${ORDER_SHEET_NAME}」が見つかりません`);
        }

        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();
        const headers = values[0];

        // Find column indices
        let idColumnIndex = -1;
        let dateColumnIndex = -1;
        let timeColumnIndex = -1;

        headers.forEach((header, index) => {
            const h = String(header).trim();
            // ID列を探す（受注ID、SystemID、ID など）
            if (h === '受注ID' || h === 'SystemID' || h === 'ID') {
                if (idColumnIndex === -1) idColumnIndex = index;
            }
            // 作業予定日列を探す
            if (h === '作業予定日') {
                dateColumnIndex = index;
            }
            // 予定時間列を探す
            if (h === '予定時間' || h === 'チップ配置作業予定') {
                timeColumnIndex = index;
            }
        });

        if (idColumnIndex === -1) {
            return errorResponse("受注ID列が見つかりません");
        }

        // Find the row with matching orderId
        let foundRow = -1;
        for (let i = 1; i < values.length; i++) {
            const currentId = String(values[i][idColumnIndex]).trim();
            const searchId = String(orderId).trim();

            if (currentId === searchId) {
                foundRow = i;
                break;
            }
        }

        if (foundRow === -1) {
            return errorResponse(`受注が見つかりませんでした (ID: ${orderId})`);
        }

        const rowNumber = foundRow + 1; // 1-indexed for sheet
        let updatedFields = [];

        // Update scheduled date (F column)
        if (scheduledDate && dateColumnIndex !== -1) {
            try {
                const parsedDate = new Date(scheduledDate);
                if (!isNaN(parsedDate.getTime())) {
                    sheet.getRange(rowNumber, dateColumnIndex + 1).setValue(parsedDate);
                    updatedFields.push('作業予定日');
                }
            } catch (e) {
                console.error("Date parse error:", e);
            }
        }

        // Update scheduled time (G column)
        if (scheduledTime && timeColumnIndex !== -1) {
            try {
                // Parse HH:mm format and create a Date object for today with that time
                const timeParts = scheduledTime.split(':');
                if (timeParts.length === 2) {
                    const hours = parseInt(timeParts[0], 10);
                    const minutes = parseInt(timeParts[1], 10);

                    // Create a date object with the time (use base date of 1899-12-30 for consistency with Excel time-only format)
                    const baseDate = new Date(1899, 11, 30, hours, minutes, 0);
                    sheet.getRange(rowNumber, timeColumnIndex + 1).setValue(baseDate);
                    updatedFields.push('予定時間');
                } else {
                    // If not in HH:mm format, just store as string
                    sheet.getRange(rowNumber, timeColumnIndex + 1).setValue(scheduledTime);
                    updatedFields.push('予定時間');
                }
            } catch (e) {
                console.error("Time parse error:", e);
                // Fallback: store as string
                sheet.getRange(rowNumber, timeColumnIndex + 1).setValue(scheduledTime);
                updatedFields.push('予定時間');
            }
        }

        if (updatedFields.length === 0) {
            return errorResponse("更新するフィールドがありません");
        }

        return successResponse(`受注の${updatedFields.join('、')}を更新しました`, {
            orderId: orderId,
            updatedFields: updatedFields
        });

    } catch (error) {
        console.error("updateOrderSchedule Error:", error);
        return errorResponse(`受注の更新中にエラーが発生しました: ${error.message}`);
    }
}
