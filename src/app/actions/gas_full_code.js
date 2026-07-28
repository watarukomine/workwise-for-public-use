// ↓↓↓↓【要設定】↓↓↓↓
// 「受注管理」シートがあるスプレッドシートのIDを貼り付けてください
const ORDER_SPREADSHEET_ID = "17P4aHYXFdPUtWCrZY4G_LY_zcUYP9ClHNRVcMvj6c6s";
// 【移行期間用】旧スプレッドシート版の受注管理スプレッドシートID
const SECONDARY_ORDER_SPREADSHEET_ID = "";
const ORDER_SHEET_NAME = "受注管理";
// 「スタッフマスタ」シートがあるスプレッドシートのIDを貼り付けてください
const STAFF_SPREADSHEET_ID = "1IP9wxp-VsctyXVn5UI3oRWeik4gMrFA5DFxt-40HGOk";
const STAFF_SHEET_NAME = "スタッフマスタ";

// 「販売店情報」シートがあるスプレッドシートのIDを貼り付けてください
const CUSTOMER_SPREADSHEET_ID = "1IZ2VwJ1AT5NvEkUoU0tL6OJXXI3hfDVQ8_773HZwUJI";
const CUSTOMER_SHEET_NAME = "販売店情報";

const ACTION_LOG_SHEET_NAME = "行動予定"; // 汎用タスク（休憩・移動等）の保存先

function getTargetSpreadsheetIds() {
    // Single source of truth: Write only to the primary order spreadsheet (17P4a...)
    return [ORDER_SPREADSHEET_ID];
}

// Firebase Realtime Database URL (シグナル用)
const FIREBASE_DB_URL = "https://workwise-general-v2-kp-default-rtdb.firebaseio.com";
// ↓↓↓↓【設定はここまで】↓↓↓↓
/**
 * GET リクエストを処理し、スプレッドシートのデータを JSON で返します
 * 受注データと行動予定データを統合して返します
 */
function doGet(e) {
    try {
        const orderDataResult = [];
        let staffDataResult = [];
        let customerDataResult = [];

        // パラメータの取得
        const targetDateStr = e.parameter.date; // "YYYY-MM-DD"
        const rangeDays = parseInt(e.parameter.range || "3"); // 前後何日分か（デフォルト3）
        const ordersOnly = e.parameter.ordersOnly === "true";

        let startDate = null;
        let endDate = null;

        if (targetDateStr) {
            const baseDate = new Date(targetDateStr);
            if (!isNaN(baseDate.getTime())) {
                startDate = new Date(baseDate);
                startDate.setDate(startDate.getDate() - rangeDays);
                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(baseDate);
                endDate.setDate(endDate.getDate() + rangeDays);
                endDate.setHours(23, 59, 59, 999);
            }
        } else {
            // パラメータがない場合は「今日」を中心に前後3日分に制限（初期ロード高速化）
            const baseDate = new Date();
            startDate = new Date(baseDate);
            startDate.setDate(startDate.getDate() - rangeDays);
            startDate.setHours(0, 0, 0, 0);

            endDate = new Date(baseDate);
            endDate.setDate(endDate.getDate() + rangeDays);
            endDate.setHours(23, 59, 59, 999);
        }

        console.log(`Filtering data from ${startDate ? startDate.toISOString() : 'N/A'} to ${endDate ? endDate.toISOString() : 'N/A'}`);

        // 1. 受注データの取得 (日付フィルター適用)
        try {
            const orderSpreadsheet = SpreadsheetApp.openById(ORDER_SPREADSHEET_ID);
            const orderSheet = orderSpreadsheet.getSheetByName(ORDER_SHEET_NAME);
            if (orderSheet) {
                const orderData = getSheetData(orderSheet, 3000, "作業予定日", startDate, endDate);
                orderData.forEach(row => {
                    row._type = 'order'; // 識別子
                    orderDataResult.push(row);
                });
            }
        } catch (err) {
            console.error("Order Sheet Read Error:", err);
        }

        // 2. 行動予定データの取得 (日付フィルター適用)
        try {
            const staffSpreadsheet = SpreadsheetApp.openById(STAFF_SPREADSHEET_ID);
            let actionSheet = staffSpreadsheet.getSheetByName(ACTION_LOG_SHEET_NAME);
            if (actionSheet) {
                const actionData = getSheetData(actionSheet, 1000, "開始日時", startDate, endDate);
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

        if (!ordersOnly) {
            // 3. スタッフマスタの取得 (マスタは全件取得)
            try {
                const staffSpreadsheet = SpreadsheetApp.openById(STAFF_SPREADSHEET_ID);
                const staffSheet = staffSpreadsheet.getSheetByName(STAFF_SHEET_NAME);
                if (staffSheet) {
                    staffDataResult = getSheetData(staffSheet);
                }
            } catch (err) {
                console.error("Staff Sheet Read Error:", err);
            }

            // 4. 販売店情報の取得 (マスタは全件取得)
            try {
                const customerSpreadsheet = SpreadsheetApp.openById(CUSTOMER_SPREADSHEET_ID);
                const customerSheet = customerSpreadsheet.getSheetByName(CUSTOMER_SHEET_NAME);
                if (customerSheet) {
                    customerDataResult = getSheetData(customerSheet);
                }
            } catch (err) {
                console.error("Customer Sheet Read Error:", err);
            }
        }

        // 統合されたレスポンスを返す
        const response = {
            status: "success",
            orders: orderDataResult,
            staff: staffDataResult,
            customers: customerDataResult,
            dateRange: {
                start: startDate ? startDate.toISOString() : null,
                end: endDate ? endDate.toISOString() : null
            },
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
function getSheetData(sheet, maxRows = 2000, filterColumnName = null, startDate = null, endDate = null) {
    const totalRows = sheet.getLastRow();
    if (totalRows <= 1) return [];

    let startRow = 1;
    let numRows = totalRows;

    // ヘッダーは常に1行目から取得
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const filterColIdx = filterColumnName ? headers.map(h => String(h).trim()).indexOf(filterColumnName) : -1;

    // 読み込み行数を制限（最新のデータを優先）
    if (maxRows && totalRows > maxRows + 1) {
        startRow = totalRows - maxRows + 1;
        numRows = maxRows;
    }

    const startIdx = startRow > 1 ? startRow : 2;
    const actualNumRows = startRow > 1 ? numRows : numRows - 1;

    // データ範囲を取得
    const dataRange = sheet.getRange(startIdx, 1, actualNumRows, headers.length);
    const displayValues = dataRange.getDisplayValues();
    const rawValues = dataRange.getValues();
    
    // 背景色の取得は「カラー」等の指定列がある場合のみに限定して大幅に高速化（3分掛かっていたものを数秒に短縮）
    const colorColIndices = [];
    headers.forEach((h, idx) => {
        const headerName = String(h).trim().toLowerCase();
        if (headerName === 'color' || headerName === 'カラー') {
            colorColIndices.push(idx);
        }
    });

    const columnBackgrounds = {};
    colorColIndices.forEach(colIdx => {
        // GASのgetRangeは列指定が1から始まるため colIdx + 1
        const bgRange = sheet.getRange(startIdx, colIdx + 1, actualNumRows, 1);
        columnBackgrounds[colIdx] = bgRange.getBackgrounds();
    });

    const sheetId = sheet.getSheetId();
    const spreadsheetId = sheet.getParent().getId();

    const result = [];
    displayValues.forEach((row, rowIndex) => {
        const rawRow = rawValues[rowIndex];
        
        // 日付フィルタリング
        if (filterColIdx !== -1 && startDate && endDate) {
            const dateVal = rawRow[filterColIdx];
            let rowDate = null;
            if (dateVal instanceof Date) {
                rowDate = dateVal;
            } else if (dateVal) {
                rowDate = new Date(dateVal);
            }

            if (rowDate && !isNaN(rowDate.getTime())) {
                // 範囲外ならスキップ
                if (rowDate < startDate || rowDate > endDate) {
                    return;
                }
            } else {
              // 日付が入っていないデータは、マスタデータ等の可能性や未設定受注なので含める
              // ただし受注管理や行動予定の場合は日付必須なので、日付がないものは古い/未設定として弾くことも検討
            }
        }

        const obj = {};
        const actualRowIndex = startIdx + rowIndex;

        headers.forEach((header, index) => {
            const h = String(header).trim();
            if (!h) return;
            const displayValue = row[index];
            const rawValue = rawRow[index];

            if (h.toLowerCase() === 'color' || h === 'カラー') {
                const bgRowArray = columnBackgrounds[index];
                const bgValue = bgRowArray ? bgRowArray[rowIndex][0] : null;
                if (bgValue && bgValue !== '#ffffff') {
                    obj[h] = bgValue;
                    return;
                }
            }

            if (rawValue && rawValue instanceof Date && !isNaN(rawValue.getTime())) {
                if (rawValue.getFullYear() < 1970) {
                    obj[h] = displayValue;
                } else {
                    obj[h] = rawValue.toISOString();
                }
            } else {
                obj[h] = displayValue;
            }
        });

        obj["Order_URL"] = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}&range=A${actualRowIndex}`;
        result.push(obj);
    });

    return result;
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
        } else if (params.action === 'createOrder') { // 新規注文
            return createOrder(params);
        } else if (params.action === 'updateOrderSchedule') { // 新規: 受注の日時更新
            return updateOrderSchedule(params);
        } else if (params.action === 'confirmRead') { // 既読確認
            return confirmReadOrder(params);
        } else if (params.action === 'updateStaff') { // スタッフマスタ更新
            return updateMasterSheet(STAFF_SPREADSHEET_ID, STAFF_SHEET_NAME, "ID", params.id, params);
        } else if (params.action === 'updateCustomer') { // 販売店情報更新
            return updateMasterSheet(CUSTOMER_SPREADSHEET_ID, CUSTOMER_SHEET_NAME, "顧客コード", params.id, params);
        } else if (params.action === 'cleanupSheetBlankRows') {
            return cleanupSheetBlankRows();
        } else if (params.eventTitle || params.systemId || params.orderId) { // 既存更新
            return updateSheetWithOrderInfo(params);
        } else {
            return errorResponse("必要なパラメータ (eventTitle, action, または operation) がありません");
        }
    } catch (error) {
        return errorResponse("エラーが発生しました: " + error.message);
    }
}

/**
 * スプレッドシートを開いたときにカスタムメニューを追加します
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('WorkWise メニュー')
        .addItem('古い受注行を非表示にする（2日前以前）', 'hideOldOrderRows')
        .addItem('すべての行を再表示する', 'unhideAllRows')
        .addToUi();
}

/**
 * 「作業予定日」が2日前以前（今日から見て2日前より過去）の行を非表示にします
 */
function hideOldOrderRows() {
    const spreadsheet = SpreadsheetApp.openById(ORDER_SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(ORDER_SHEET_NAME);
    if (!sheet) {
        SpreadsheetApp.getUi().alert("エラー", `シート「${ORDER_SHEET_NAME}」が見つかりません。`, SpreadsheetApp.getUi().ButtonSet.OK);
        return;
    }

    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    if (values.length <= 1) {
        SpreadsheetApp.getUi().alert("情報", "データがありません。", SpreadsheetApp.getUi().ButtonSet.OK);
        return;
    }

    const headers = values[0];
    const dateColIndex = headers.indexOf('作業予定日');

    if (dateColIndex === -1) {
        SpreadsheetApp.getUi().alert("エラー", "「作業予定日」の列が見つかりません。", SpreadsheetApp.getUi().ButtonSet.OK);
        return;
    }

    // 基準日（今日から2日前）の計算
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thresholdDate = new Date(today);
    thresholdDate.setDate(thresholdDate.getDate() - 2);

    let hideCount = 0;

    // 2行目からループしてチェック
    for (let i = 1; i < values.length; i++) {
        const rowNum = i + 1;
        const dateVal = values[i][dateColIndex];

        // 指定の行がすでにユーザーによって非表示にされているかチェック
        // ※ 毎回チェックすると遅くなる可能性があるので、API呼び出し回数を抑える配慮もできるが
        // 今回は数千行レベルを想定してそのまま実行

        if (dateVal) {
            let rowDate = null;
            if (dateVal instanceof Date) {
                rowDate = dateVal;
            } else if (typeof dateVal === 'string' || typeof dateVal === 'number') {
                const parsed = new Date(dateVal);
                if (!isNaN(parsed.getTime())) {
                    rowDate = parsed;
                }
            }

            if (rowDate) {
                rowDate.setHours(0, 0, 0, 0);
                // 2日前「以前」の行を非表示にする
                if (rowDate.getTime() <= thresholdDate.getTime()) {
                    if (!sheet.isRowHiddenByUser(rowNum)) {
                        sheet.hideRows(rowNum);
                        hideCount++;
                    }
                }
            }
        }
    }

    SpreadsheetApp.getUi().alert("完了", `${hideCount}行の古い受注データを非表示にしました。`, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * すべての非表示行を再表示します
 */
function unhideAllRows() {
    const spreadsheet = SpreadsheetApp.openById(ORDER_SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(ORDER_SHEET_NAME);
    if (!sheet) {
        SpreadsheetApp.getUi().alert("エラー", `シート「${ORDER_SHEET_NAME}」が見つかりません。`, SpreadsheetApp.getUi().ButtonSet.OK);
        return;
    }

    const maxRows = sheet.getMaxRows();
    if (maxRows > 1) {
        sheet.showRows(2, maxRows - 1); // 2行目から最後まで再表示（1行目のヘッダーは除外）
        SpreadsheetApp.getUi().alert("完了", "すべての行を再表示しました。", SpreadsheetApp.getUi().ButtonSet.OK);
    } else {
        SpreadsheetApp.getUi().alert("情報", "データがありません。", SpreadsheetApp.getUi().ButtonSet.OK);
    }
}
function errorResponse(msg) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: msg })).setMimeType(ContentService.MimeType.JSON);
}
function successResponse(msg, data) {
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: msg, ...data })).setMimeType(ContentService.MimeType.JSON);
}
/**
 * 受注シートの「既読確認」列を更新する
 * スタッフが「確認済」ボタンを押したときに呼ばれる
 */
function confirmReadOrder(params) {
    const { systemId, staffName, timestamp } = params;
    if (!systemId) return errorResponse("systemId が指定されていません");
    if (!staffName) return errorResponse("staffName が指定されていません");

    // 汎用タスク（task-〜）の場合は、行動記録シートに「既読」列を作っていないため、
    // ここで成功を返して無視する（そうしないと受注シートを探してエラーになってしまう）
    if (String(systemId).replace(/-/g, '').startsWith('task')) {
        return successResponse("汎用タスクのため既読処理をスキップしました", { confirmed: true });
    }

    try {
        const orderSpreadsheet = SpreadsheetApp.openById(ORDER_SPREADSHEET_ID);
        const sheet = orderSpreadsheet.getSheetByName(ORDER_SHEET_NAME);
        if (!sheet) throw new Error(`シート「${ORDER_SHEET_NAME}」が見つかりません。`);

        const data = sheet.getDataRange().getValues();
        const headers = data[0].map(h => String(h).trim().toLowerCase());

        // 「既読確認」または「既読」列を探す
        let confirmedColIndex = headers.indexOf('既読確認');
        if (confirmedColIndex === -1) confirmedColIndex = headers.indexOf('既読');
        
        if (confirmedColIndex === -1) {
            return errorResponse("「既読確認」または「既読」列が見つかりません。スプレッドシートにいずれかの列名を追加してください。");
        }

        // SystemID 列を探す
        const sysIdColIndex = headers.reduce((found, h, i) => {
            if (found !== -1) return found;
            if (h === 'systemid' || h === 'システムid' || h === 'sid') return i;
            return -1;
        }, -1);
        if (sysIdColIndex === -1) return errorResponse("SystemID 列が見つかりません");

        // 対象行を検索
        let targetRowNum = -1;
        for (let i = 1; i < data.length; i++) {
            const cellVal = String(data[i][sysIdColIndex]).trim();
            const cleanCell = cellVal.replace(/-/g, '');
            const cleanTarget = String(systemId).trim().replace(/-/g, '');
            if (cellVal === String(systemId).trim() || (cleanCell && cleanTarget && (cleanCell === cleanTarget || cleanCell.includes(cleanTarget) || cleanTarget.includes(cleanCell)))) {
                targetRowNum = i + 1;
                break;
            }
        }
        if (targetRowNum === -1) return errorResponse(`受注 ID: ${systemId} が見つかりませんでした`);

        // 既読確認列に「スタッフ名 日時」を書き込む
        const now = timestamp ? new Date(timestamp) : new Date();
        const jstStr = Utilities.formatDate(now, "Asia/Tokyo", "yyyy/MM/dd HH:mm");
        const confirmValue = `${staffName} ${jstStr}`;
        sheet.getRange(targetRowNum, confirmedColIndex + 1).setValue(confirmValue);
        SpreadsheetApp.flush();
        sendFirebaseSignal('update');

        return successResponse(`既読確認を記録しました: ${confirmValue}`, { confirmed: true });
    } catch (e) {
        console.error("confirmReadOrder Error:", e);
        return errorResponse("既読確認の記録に失敗しました: " + e.message);
    }
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
        sendFirebaseSignal('update');
        return successResponse("タスクを作成しました", { eventId: id });
    } catch (e) {
        console.error("createTask Error:", e);
        return errorResponse("タスク作成エラー: " + e.message);
    }
}
/**
 * 注文（受注）を新規作成する機能
 * 受注管理シート（二重バックアップ対応）に追記します
 */
function createOrder(params) {
    let primaryResult = null;
    const targetIds = getTargetSpreadsheetIds();
    for (let idx = 0; idx < targetIds.length; idx++) {
        const ssId = targetIds[idx];
        try {
            const res = createOrderSingleSheet(ssId, params);
            if (idx === 0) primaryResult = res;
        } catch (e) {
            console.error("createOrder error for ss " + ssId, e);
            if (idx === 0) return errorResponse("注文登録エラー: " + e.message);
        }
    }
    return primaryResult || errorResponse("注文登録エラー");
}

function createOrderSingleSheet(targetSsId, params) {
    try {
        const spreadsheet = SpreadsheetApp.openById(targetSsId);
        const sheet = spreadsheet.getSheetByName(ORDER_SHEET_NAME);
        if (!sheet) throw new Error(`シート「${ORDER_SHEET_NAME}」が見つかりません。`);
        const headers = sheet.getDataRange().getValues()[0];
        
        let sysIdColIndex = -1;
        headers.forEach((h, i) => {
            if (String(h).trim() === "SystemID") sysIdColIndex = i;
        });

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
        const newSystemId = params.systemId || `${dateStr}_${userCode}_${randomStr}`;

        let nextId = 0;
        if (params.displayId && !isNaN(Number(params.displayId))) {
            nextId = Number(params.displayId);
        } else {
            let maxId = 0;
            const existingIds = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
            for (let i = 0; i < existingIds.length; i++) {
                const val = existingIds[i][0];
                const numVal = Number(val);
                if (!isNaN(numVal) && numVal > maxId) {
                    maxId = numVal;
                }
            }
            nextId = maxId > 0 ? maxId + 1 : 1951;
        }

        // Find actual last populated row based on non-empty values in first 10 columns instead of sheet.getLastRow()
        // which may return blank formatted rows (e.g. row 2900).
        let actualLastRow = 1;
        const lastRowCandidate = Math.max(sheet.getLastRow(), 1);
        const checkCols = Math.min(sheet.getLastColumn() || 1, 10);
        const colValues = sheet.getRange(1, 1, lastRowCandidate, checkCols).getValues();
        for (let r = colValues.length - 1; r >= 0; r--) {
            const hasValue = colValues[r].some(val => String(val).trim() !== "");
            if (hasValue) {
                actualLastRow = r + 1;
                break;
            }
        }
        const targetRow = actualLastRow + 1;
        const newRow = [];
        headers.forEach(header => {
            const h = String(header).trim();
            if (h === "受注ID" || h === "受注 No" || h === "受注 N o" || h === "受注行番号" || h === "通し番号" || h.startsWith("受注")) {
                newRow.push(nextId || (targetRow - 1));
            } else if (h === "SystemID") {
                newRow.push(newSystemId);
            } else if (h === "顧客コード" || h === "ユーザーコード") {
                newRow.push(params.userCode || params.customerCode || "");
            } else if (h === "お取引先名" || h === "店舗" || h === "店舗名") {
                newRow.push(params.storeName || params.customerName || "");
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
                newRow.push("");
            } else if (h === "注文番号" || h.includes("受注No")) {
                newRow.push(params.orderNo || "");
            } else if (h.includes("任意コメント")) {
                newRow.push(params.comment || "");
            } else if (h === "緊急連絡") {
                newRow.push("");
            } else if (h === "緊急フラグ") {
                newRow.push(false);
            } else if (h === "管理者返信") {
                newRow.push("");
            } else if (h === "車名") {
                newRow.push(params.carName || "");
            } else if (h.includes("登録ナンバー")) {
                newRow.push(params.regNo || "");
            } else if (h === "受注ステータス" || h === "入庫状況") {
                newRow.push(params.status || "未割当");
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
        sheet.getRange(targetRow, 1, 1, newRow.length).setValues([newRow]);
        sendFirebaseSignal('update');
        return successResponse("注文を登録しました。", { orderId: newSystemId, displayId: targetRow - 1 });
    } catch (error) {
        console.error("createOrderSingleSheet Error:", error);
        throw error;
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
        // ハイフンが抜けて送られて来るケース（LINE経由など）を考慮し、ハイフンを抜いて判定する
        if (searchId && String(searchId).replace(/-/g, '').startsWith('task')) {
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

        // 2. フォールバック検索: IDで見つからなかった場合
        if (targetRowNum === -1 && scheduledTime) {
            console.log("No matching ID found. Trying content-based search...");

            const staffColIdx = findColumnIndex(["担当", "スタッフ名", "弊社担当", "担当者"]);
            const dateColIdx = findColumnIndex(["作業予定日", "予定日", "日付"]);
            const timeColIdx = findColumnIndex(["予定時間", "開始時間", "時間"]);
            const storeColIdx = findColumnIndex(["店舗名", "お取引先名", "店舗", "取引先"]);

            if (dateColIdx !== -1) {
                const targetDate = new Date(scheduledTime);
                const targetTimeStr = Utilities.formatDate(targetDate, "Asia/Tokyo", "HH:mm");
                targetDate.setHours(0, 0, 0, 0);

                for (let i = 1; i < data.length; i++) {
                    const rowDateVal = data[i][dateColIdx];
                    const rowTimeVal = data[i][timeColIdx];
                    const rowStaff = staffColIdx !== -1 ? String(data[i][staffColIdx]) : "";
                    const rowStore = storeColIdx !== -1 ? String(data[i][storeColIdx]) : "";

                    let rowDate = null;
                    if (rowDateVal instanceof Date) rowDate = rowDateVal;
                    else if (rowDateVal && !isNaN(new Date(rowDateVal).getTime())) rowDate = new Date(rowDateVal);

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
                        if (rowDate.getTime() === targetDate.getTime() && rowTimeStr === targetTimeStr) {
                            // Match by Staff (if provided and exists) OR Match by Store Name
                            const normRowStaff = rowStaff.replace(/\s+/g, '');
                            const normTargetStaff = (staffName || "").replace(/\s+/g, '');
                            const normRowStore = rowStore.replace(/\s+/g, '');
                            // Store name can be passed via eventTitle or other params, but here we check against raw sheet

                            // 2A. If staff matches (for existing assigned orders)
                            if (staffName && normRowStaff === normTargetStaff) {
                                targetRowNum = i + 1;
                                break;
                            }
                            // 2B. If it's unassigned in sheet and we are assigning it (or it's the same unassigned row)
                            // We don't have the target store name explicitly here easily, but we can check if it's the ONLY row-time match
                            // For now, let's assume if it's unassigned and matches time/date, it's a strong candidate.
                            if (rowStaff.trim() === "") {
                                targetRowNum = i + 1;
                                console.log("Found unassigned match at Row:", targetRowNum);
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

        // Helper to safely parse dates coming from React client. React sends ISO strings or YYYY-MM-DD or HH:mm.
        // Google Sheets sometimes misinterprets standard JS Date objects created from time-only or date-only strings as 1899/1970.
        // We ensure a safe format is saved.
        const baseDateString = params.scheduledDate || params["作業予定日"] || null;

        const parseSafeDate = (dateString, isTimeOnly = false) => {
            if (!dateString) return "";
            try {
                let resultDate = null;

                // If it's just a time string HH:mm, combine it with the scheduled date or today
                if (isTimeOnly) {
                    if (typeof dateString === 'string' && (dateString.match(/^\d{1,2}:\d{2}$/) || dateString.match(/^\d{1,2}:\d{2}:\d{2}$/))) {
                        const parts = dateString.split(':');
                        const h = parseInt(parts[0], 10) || 0;
                        const m = parseInt(parts[1], 10) || 0;
                        const s = parts[2] ? parseInt(parts[2], 10) : 0;

                        // Try combining with the master scheduled date
                        if (baseDateString) {
                            const d = new Date(baseDateString);
                            // CRITICAL FIX: Ensure the BASE date itself isn't a 1970 bug
                            if (!isNaN(d.getTime()) && d.getFullYear() > 1970) {
                                d.setHours(h, m, s, 0);
                                resultDate = d;
                            }
                        }

                        // Fallback to today if still no valid resultDate
                        if (!resultDate) {
                            const dToday = new Date();
                            dToday.setHours(h, m, s, 0);
                            resultDate = dToday;
                        }
                    }
                }

                // If not handled by isTimeOnly, parse as standard date string
                if (!resultDate) {
                    // For Full ISO strings
                    if (typeof dateString === 'string' && dateString.includes('T')) {
                        const d = new Date(dateString);
                        if (!isNaN(d.getTime())) resultDate = d;
                    } else if (typeof dateString === 'string' && dateString.includes('-') && dateString.length === 10) {
                        // For Date only: YYYY-MM-DD
                        const d = new Date(dateString);
                        if (!isNaN(d.getTime())) resultDate = d;
                    } else {
                        const d = new Date(dateString);
                        if (!isNaN(d.getTime())) resultDate = d;
                    }
                }

                // FINAL GUARD: Apply 1970 check to whatever we found
                if (resultDate && !isNaN(resultDate.getTime())) {
                    if (resultDate.getFullYear() <= 1970) return "";
                    return resultDate;
                }

                return dateString; // Return original string if we can't make a valid Date
            } catch (e) {
                return dateString;
            }
        };

        updateColumn(["最終更新日時", "更新日時", "timestamp"], timestamp ? parseSafeDate(timestamp) : undefined);
        if (latitude !== undefined && longitude !== undefined) {
            updateColumn(["最終位置情報（緯度,経度）", "位置情報", "座標"], `${latitude}, ${longitude}`);
        }
        if (scheduledTime) {
            updateColumn(["チップ配置作業予定", "予定時間"], parseSafeDate(scheduledTime, true));
        }
        if (scheduledEndTime) {
            updateColumn(["チップ配置作業完了予定", "終了時間", "完了時間"], parseSafeDate(scheduledEndTime, true));
        }
        if (scheduledDate) updateColumn(["作業予定日", "予定日"], parseSafeDate(scheduledDate));
        if (comment !== undefined) {
            // スタッフからの緊急連絡
            updateColumn(["緊急連絡", "任意コメント", "受注コメント", "スタッフ連絡", "連絡事項"], comment);
        }
        if (emergencyFlag !== undefined) updateColumn(["緊急フラグ", "緊急ステータス", "緊急", "フラグ"], emergencyFlag);
        if (adminReply !== undefined) updateColumn(["管理者返信", "返信", "管理者からの返信", "回答", "管理者回答", "コメント", "管理者コメント"], adminReply);
        if (specialNotes !== undefined) updateColumn(["特記事項", "備考", "メモ", "特記"], specialNotes);

        // 新規追加: 詳細情報の全更新
        if (params.storeName !== undefined) updateColumn(["お取引先名", "店舗", "店舗名", "名称", "店舗名称", "Customer", "お名前"], params.storeName);
        if (params.equipmentStatus !== undefined) updateColumn(["機材有無"], params.equipmentStatus);
        if (params.carName !== undefined) updateColumn(["車名", "車両", "車種"], params.carName);
        if (params.regNo !== undefined) updateColumn(["登録ナンバー(下４桁)", "登録ナンバー", "ナンバー", "車番", "登録番号"], params.regNo);
        if (params.arrivalStatus !== undefined) updateColumn(["入庫状況"], params.arrivalStatus);
        if (params.tireNumber !== undefined) updateColumn(["タイヤ品番", "品番"], params.tireNumber);
        if (params.tireSize !== undefined) updateColumn(["タイヤサイズ", "サイズ", "Size", "タイヤ名/サイズ"], params.tireSize);
        if (params.productName !== undefined) updateColumn(["品名", "商品名"], params.productName);
        if (params.taskDetails !== undefined) updateColumn(["作業内容", "業務内容", "taskDetails", "Description", "作業", "作業内容・商品詳細", "内容"], params.taskDetails);
        if (params.quantity !== undefined) updateColumn(["本数", "honsu", "数量", "Qty", "Quantity", "本", "タイヤ本数"], params.quantity);
        if (params.sensor !== undefined) updateColumn(["空気圧センサーパッキン交換", "センサー"], params.sensor);
        if (params.tireStatus !== undefined) updateColumn(["タイヤ手配状況", "手配"], params.tireStatus);
        if (params.disposal !== undefined) updateColumn(["廃タイヤ処分", "廃タイヤ"], params.disposal);

        // 新規追加: 訪問履歴時間の保存・変更
        if (params.startTravelTime !== undefined) updateColumn(["移動開始"], params.startTravelTime ? parseSafeDate(params.startTravelTime, true) : "");
        if (params.arrivalTimestamp !== undefined) updateColumn(["現場到着"], params.arrivalTimestamp ? parseSafeDate(params.arrivalTimestamp, true) : "");
        if (params.actualStartTime !== undefined) updateColumn(["作業開始", "実績開始"], params.actualStartTime ? parseSafeDate(params.actualStartTime, true) : "");
        if (params.actualEndTime !== undefined) updateColumn(["作業完了", "実績完了", "実績終了"], params.actualEndTime ? parseSafeDate(params.actualEndTime, true) : "");
        if (params.actualDuration !== undefined) updateColumn(["作業時間（分）", "所要時間"], params.actualDuration);
        if (actionType && actionTimestamp) {
            const dateValue = parseSafeDate(actionTimestamp, true);
            const actionColMap = {
                'Start Travel': ["移動開始", "移動開始時間", "移動時間"],
                'Arrive': ["現場到着", "到着時間", "現場到着時間"],
                'Begin Task': ["作業開始", "実績開始", "開始時間"],
                'Finish Task': ["作業完了", "実績完了", "実績終了", "終了時間"],
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
        sendFirebaseSignal(emergencyFlag ? 'emergency' : 'update');

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
            // ハイフンを取り除いて比較（LINEなどのアプリ側でURLのハイフンが削られるケースへの対策）
            if (String(data[i][idCol]).replace(/-/g, '') === String(taskId).replace(/-/g, '')) {
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
        sendFirebaseSignal('update');
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
    
    // 緊急フラグ等の更新があれば緊急シグナルも送信
    if (params.emergencyFlag === true || (params.comment && typeof params.comment === "string" && params.comment.trim() !== "")) {
        sendFirebaseEmergencySignal();
    }
    
    return successResponse(`タスクID: ${taskId} を更新しました。`);
}
/**
 * Firebase Realtime Database にデータ更新の信号を送る
 * @param {string} type 'update' | 'emergency'
 */
function sendFirebaseSignal(type = 'update') {
    try {
        if (!FIREBASE_DB_URL) return;
        const timestamp = new Date().getTime();
        
        // 通常の更新信号
        const urlUpdate = FIREBASE_DB_URL + "/signals/orders_updated.json";
        UrlFetchApp.fetch(urlUpdate, {
            method: "put",
            contentType: "application/json",
            payload: JSON.stringify({ timestamp: timestamp }),
            muteHttpExceptions: true
        });

        // 緊急連絡専用の信号（トリガー用）
        if (type === 'emergency') {
            const urlEmergency = FIREBASE_DB_URL + "/signals/emergency_active.json";
            UrlFetchApp.fetch(urlEmergency, {
                method: "put",
                contentType: "application/json",
                payload: JSON.stringify({ timestamp: timestamp }),
                muteHttpExceptions: true
            });
        }
    } catch (e) {
        console.error("Firebase Signal Error:", e);
    }
}

/**
 * Firebase Realtime Database に緊急通知の信号を送る（後方互換トリガー用）
 */
function sendFirebaseEmergencySignal() {
    sendFirebaseSignal('emergency');
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
        const descriptionText = (description || "").trim() || "(受注詳細データが見つかりませんでした。画面から再送をお試しください)";
        const bodyContent = [
            (isUpdate ? "割り当てられた予定が変更されました。" : "新しい予定が割り当てられました。"),
            "",
            "【受注詳細】",
            descriptionText,
            "",
            "添付のiCalendarファイルを開いてカレンダーに追加/更新してください。",
            "",
            "---",
            "送信日時: " + now.toLocaleString("ja-JP")
        ];
        const body = bodyContent.join("\n");
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

        // 信号を送信
        sendFirebaseSignal('update');

        return successResponse(`受注の${updatedFields.join('、')}を更新しました`, {
            orderId: orderId,
            updatedFields: updatedFields
        });

    } catch (error) {
        console.error("updateOrderSchedule Error:", error);
        return errorResponse(`受注の更新中にエラーが発生しました: ${error.message}`);
    }
}

/**
 * スタッフマスタや販売店情報などのマスタシートを更新する汎用関数
 */
function updateMasterSheet(spreadsheetId, sheetName, idColumnName, idValue, data) {
    try {
        const ss = SpreadsheetApp.openById(spreadsheetId);
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) throw new Error(`シート「${sheetName}」が見つかりません`);

        const values = sheet.getDataRange().getValues();
        const headers = values[0];
        
        // ID列を探す
        const idColIdx = headers.map(h => String(h).trim()).indexOf(idColumnName);
        if (idColIdx === -1) throw new Error(`ID列「${idColumnName}」が見つかりません`);

        // 対象行を探す
        let targetRowNum = -1;
        for (let i = 1; i < values.length; i++) {
            if (String(values[i][idColIdx]).trim() === String(idValue).trim()) {
                targetRowNum = i + 1;
                break;
            }
        }

        // 見つからなければ新規追加
        if (targetRowNum === -1) {
            const newRow = headers.map(h => {
                const header = String(h).trim();
                if (header === idColumnName) return idValue;
                return data[header] !== undefined ? data[header] : "";
            });
            sheet.appendRow(newRow);
            return successResponse(`マスタに新規追加しました: ${idValue}`);
        }

        // 既存行を更新（データに含まれる項目のみ）
        headers.forEach((h, idx) => {
            const header = String(h).trim();
            if (header === idColumnName) return; // IDは更新しない
            
            // データ内に該当するキーがあれば上書き
            if (data[header] !== undefined) {
                sheet.getRange(targetRowNum, idx + 1).setValue(data[header]);
            }
        });

        SpreadsheetApp.flush();
        sendFirebaseSignal('update');
        return successResponse(`マスタを更新しました: ${idValue}`);

    } catch (e) {
        console.error("updateMasterSheet Error:", e);
        return errorResponse("マスタ更新エラー: " + e.message);
    }
}

/**
 * 手動でスプレッドシートが編集された際のトリガー
 */
function onEdit(e) {
    if (!e || !e.range) return;
    try {
        const sheet = e.range.getSheet();
        const sheetName = sheet.getName();
        
        if (sheetName === ORDER_SHEET_NAME || sheetName === ACTION_LOG_SHEET_NAME) {
            const row = e.range.getRow();
            const col = e.range.getColumn();
            
            // ヘッダー行の編集は無視
            if (row === 1) return;
            
            const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
            const editedHeader = headers[col - 1] ? String(headers[col - 1]).trim() : "";
            
            // 緊急関連の列が編集されたか判定
            const isEmergencyCol = ["緊急フラグ", "緊急ステータス", "緊急", "フラグ", "緊急連絡", "任意コメント", "受注コメント", "スタッフ連絡", "連絡事項"].includes(editedHeader);
            
            if (isEmergencyCol) {
                // セルの値が何かチェック
                const val = String(e.value || "");
                if (val === "TRUE" || val === "true" || val.trim() !== "") {
                    sendFirebaseSignal('emergency');
                    return;
                }
            }
            
            // それ以外は通常のダッシュボード更新シグナル
            sendFirebaseSignal('update');
        }
    } catch (err) {
        console.error("onEdit error:", err);
    }
}

/**
 * クリーンアップ関数: スプレッドシート内の途中の空行・余計な空白行(14103行目まで)をすべて整理・削除し、
 * データ(本日分含む)を1行目(ヘッダー)から1955行目まで一切の隙間なく詰めて綺麗に配置する。
 */
function cleanupSheetBlankRows() {
    try {
        const spreadsheet = SpreadsheetApp.openById(ORDER_SPREADSHEET_ID);
        const sheet = spreadsheet.getSheetByName(ORDER_SHEET_NAME);
        if (!sheet) return errorResponse("シートが見つかりません。");

        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();

        if (values.length <= 1) {
            return successResponse("データ行がありません。");
        }

        const validRows = [];
        // ヘッダー行を保存
        validRows.push(values[0]);

        // データ行（何らかのセルに値がある行のみ残す）
        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            const hasData = row.some(cell => String(cell).trim() !== "");
            if (hasData) {
                validRows.push(row);
            }
        }

        // シートの内容を完全にクリア
        sheet.clearContents();

        // 詰めたデータを1行目から一括書き込み
        const numRows = validRows.length;
        const numCols = validRows[0].length;
        sheet.getRange(1, 1, numRows, numCols).setValues(validRows);

        // 余分な空行がシートに存在する場合は一括削除
        const maxRows = sheet.getMaxRows();
        if (maxRows > numRows) {
            sheet.deleteRows(numRows + 1, maxRows - numRows);
        }

        sendFirebaseSignal('update');
        return successResponse(`スプレッドシートの空行を整理完了。全${numRows - 1}件の受注データを1952行目〜直後に綺麗に詰めました。`);
    } catch (e) {
        console.error("cleanupSheetBlankRows error:", e);
        return errorResponse("クリーンアップ中にエラーが発生しました: " + e.message);
    }
}
