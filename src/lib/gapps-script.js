// ↓↓↓↓【要設定】↓↓↓↓
// 「受注管理」シートがあるスプレッドシートのIDを貼り付けてください
const ORDER_SPREADSHEET_ID = "17P4aHYXFdPUtWCrZY4G_LY_zcUYP9ClHNRVcMvj6c6s";
const ORDER_SHEET_NAME = "受注管理";

// 「スタッフマスタ」シートがあるスプレッドシートのIDを貼り付けてください
const STAFF_SPREADSHEET_ID = "18vztZhnAqDmQtlCNMERncTsCSe_hfMQ7TvcF-5S6IIo";
const STAFF_SHEET_NAME = "スタッフマスタ";
const ACTION_LOG_SHEET_NAME = "行動予定"; // 汎用タスク（休憩・移動等）の保存先
// ↓↓↓↓【設定はここまで】↓↓↓↓


/**
 * GET リクエストを処理し、スプレッドシートのデータを JSON で返します
 * 受注データと行動予定データを統合して返します
 */
function doGet(e) {
  try {
    const data = [];

    // 1. 受注データの取得
    try {
      const orderSpreadsheet = SpreadsheetApp.openById(ORDER_SPREADSHEET_ID);
      const orderSheet = orderSpreadsheet.getSheetByName(ORDER_SHEET_NAME);
      if (orderSheet) {
        const orderData = getSheetData(orderSheet);
        orderData.forEach(row => {
          row._type = 'order'; // 識別子
          data.push(row);
        });
      }
    } catch (err) {
      console.error("Order Sheet Read Error:", err);
    }

    // 2. 行動予定データの取得
    try {
      const staffSpreadsheet = SpreadsheetApp.openById(STAFF_SPREADSHEET_ID);
      let actionSheet = staffSpreadsheet.getSheetByName(ACTION_LOG_SHEET_NAME);

      // シートがなければ自動作成（空のリストを返すことになる）
      if (!actionSheet) {
        // ここでは作成せず、次回書き込み時に作成される実装でも良いが
        // 読み込み時に無いならデータも無いはず
      } else {
        const actionData = getSheetData(actionSheet);
        actionData.forEach(row => {
          row._type = 'task'; // 識別子
          // フロントエンドの形式に合わせてフィールドをマッピング
          // 行動予定シート: ID, スタッフ名, 業務内容, 詳細, 開始日時, 終了日時, 作成日時
          row.id = row['ID'];
          row.staffName = row['スタッフ名'];
          row.taskDetails = row['業務内容'];
          row.description = row['詳細'];
          row.scheduledTime = row['開始日時']; // 開始
          row.scheduledEndTime = row['終了日時']; // 終了
          row.status = '未割当'; // 便宜上
          data.push(row);
        });
      }
    } catch (err) {
      console.error("Action Log Sheet Read Error:", err);
    }

    return ContentService.createTextOutput(JSON.stringify({ data: data })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error("GAS doGet Error:", error.message, error.stack);
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: `GAS doGet Error: ${error.message}` })).setMimeType(ContentService.MimeType.JSON);
  }
}

// シートデータをオブジェクト配列として取得するヘルパー
function getSheetData(sheet) {
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  if (values.length < 1) return [];

  const headers = values.shift();
  const sheetId = sheet.getSheetId();
  const spreadsheetId = sheet.getParent().getId();

  return values.map((row, rowIndex) => {
    const obj = {};
    headers.forEach((header, index) => {
      const cellValue = row[index];
      if (cellValue && cellValue instanceof Date && !isNaN(cellValue)) {
        obj[header] = cellValue.toISOString();
      } else {
        obj[header] = cellValue;
      }
    });
    // Order_URL (編集用リンク)
    obj["Order_URL"] = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}&range=A${rowIndex + 2}`;
    return obj;
  });
}

/**
 * POST リクエストを処理し、スプレッドシートを更新します
 */
function doPost(e) {
  try {
    /* ... 既存のJSONパース処理 ... */
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
    } else if (params.eventTitle) { // 既存更新
      return updateSheetWithOrderInfo(params);
    } else if (params.action === 'createOrder') { // 将来用
      // createOrderの実装を入れるならここ
      return errorResponse("createOrder is not implemented yet.");
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
  const { staffName, taskName, description, startTime, endTime, estimatedDuration } = params;

  try {
    const ss = SpreadsheetApp.openById(STAFF_SPREADSHEET_ID);
    let sheet = ss.getSheetByName(ACTION_LOG_SHEET_NAME);

    // シートが無ければ作成
    if (!sheet) {
      sheet = ss.insertSheet(ACTION_LOG_SHEET_NAME);
      // ヘッダー行作成
      sheet.appendRow(['ID', 'スタッフ名', '業務内容', '詳細', '開始日時', '終了日時', '作成日時']);
      // 書式設定等は必要に応じて
    }

    // ID生成 (タイムスタンプ + ランダム)
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

    return successResponse("タスクを作成しました", { eventId: id });

  } catch (e) {
    console.error("createTask Error:", e);
    return errorResponse("タスク作成エラー: " + e.message);
  }
}


/**
 * 受注IDでシートを検索し、指定された情報で更新する
 * (汎用タスクの場合でIDがtask-から始まるものは行動予定シートを更新するように分岐)
 */
function updateSheetWithOrderInfo(params) {
  const { eventTitle, staffName, statusValue, timestamp, latitude, longitude, actionType, actionTimestamp, scheduledTime, scheduledEndTime, scheduledDate, comment } = params;

  try {
    const match = eventTitle.match(/\(ID:\s*([\w-]+)\)/);
    const orderId = match ? match[1] : null;

    if (!orderId) {
      return successResponse("IDが見つからないためスキップしました");
    }

    // ---------------------------------------------
    // Branch: 汎用タスク (task-xxx) は行動予定シートを更新
    // ---------------------------------------------
    if (orderId.startsWith('task-')) {
      return updateTaskSheet(orderId, params);
    }

    // ---------------------------------------------
    // Standard: 受注管理シート更新 (既存ロジック)
    // ---------------------------------------------
    const orderSpreadsheet = SpreadsheetApp.openById(ORDER_SPREADSHEET_ID);
    const sheet = orderSpreadsheet.getSheetByName(ORDER_SHEET_NAME);
    if (!sheet) throw new Error(`シート「${ORDER_SHEET_NAME}」が見つかりません。`);

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const orderIdCol = headers.indexOf("受注ID");
    if (orderIdCol === -1) throw new Error("「受注ID」列が見つかりません。");

    let rowNum = -1;
    // 後ろから検索（最新のものが下にある場合、パフォーマンス的に有利かも？いやデータ量は少ないか）
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][orderIdCol]) === String(orderId)) {
        rowNum = i + 1;
        break;
      }
    }
    if (rowNum === -1) throw new Error(`受注ID: ${orderId} が見つかりませんでした。`);

    const updateColumn = (colName, value) => {
      if (value !== undefined) {
        const colIdx = headers.indexOf(colName);
        if (colIdx !== -1) {
          sheet.getRange(rowNum, colIdx + 1).setValue(value);
        }
      }
    };

    // Update Fields
    updateColumn("担当", staffName);
    updateColumn("受注ステータス", statusValue);
    updateColumn("最終更新日時", timestamp ? new Date(timestamp) : undefined);

    if (latitude !== undefined && longitude !== undefined) {
      updateColumn("最終位置情報（緯度,経度）", `${latitude}, ${longitude}`);
    }

    // 日付・時間の更新
    if (scheduledTime) updateColumn("チップ配置作業予定", new Date(scheduledTime));
    if (scheduledEndTime) updateColumn("チップ配置作業完了予定", new Date(scheduledEndTime));
    if (scheduledDate) updateColumn("作業予定日", new Date(scheduledDate));
    if (comment) updateColumn("任意コメント", comment); // 必要に応じて

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

    return successResponse(`受注ID: ${orderId} を更新しました。`);

  } catch (error) {
    console.error("updateSheetWithOrderInfo Error:", error);
    return errorResponse(error.message);
  }
}

// 汎用タスク更新用
function updateTaskSheet(taskId, params) {
  const ss = SpreadsheetApp.openById(STAFF_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(ACTION_LOG_SHEET_NAME);
  if (!sheet) throw new Error("行動予定シートが見つかりません");

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf("ID");

  let rowNum = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(taskId)) {
      rowNum = i + 1;
      break;
    }
  }
  if (rowNum === -1) throw new Error("タスクIDが見つかりません");

  // 更新対象マッピング
  // 'スタッフ名', '業務内容', '詳細', '開始日時', '終了日時'
  const mapping = {
    'スタッフ名': params.staffName,
    // title/taskNameがない場合はスルー
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

  return successResponse(`タスクID: ${taskId} を更新しました。`);
}

/**
 * iCalメール送信 (変更なし、省略可能だが念のため残す)
 */
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
