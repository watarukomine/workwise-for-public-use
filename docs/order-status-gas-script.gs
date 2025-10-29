
// 【重要】受注情報と担当者が記載されているシート名に書き換えてください
const SHEET_NAME = "【実際のシート名】";

/**
 * WebアプリからのGETリクエストを処理します。
 * 主に、受注情報やスタッフ情報の一覧をアプリに提供するために使用されます。
 */
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error(`シート '${SHEET_NAME}' が見つかりません。`);
    }
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const backgrounds = dataRange.getBackgrounds(); // 背景色を取得
    const headers = values.shift(); // 最初の行をヘッダーとして取得
    backgrounds.shift(); // ヘッダー行の背景色は不要

    // ヘッダーから'color'または'カラー'列のインデックスを探す
    const colorHeaderIndex = headers.findIndex(h => h.toLowerCase() === 'color' || h === 'カラー');


    const data = values.map((row, rowIndex) => {
      const obj = {};
      headers.forEach((header, index) => {
        // 日付オブジェクトはISO文字列に変換
        if (row[index] instanceof Date) {
          obj[header] = row[index].toISOString();
        } else {
          obj[header] = row[index];
        }
      });
      
      // color/カラー列の背景色を取得して、オブジェクトに追加
      if (colorHeaderIndex !== -1) {
        // 既存のcolor値を上書き、または新規追加
        obj[headers[colorHeaderIndex]] = backgrounds[rowIndex][colorHeaderIndex];
      }
      
      return obj;
    });

    return ContentService
      .createTextOutput(JSON.stringify({ data: data }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log(`doGet Error: ${error.message}`);
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: `GAS doGet Error: ${error.message}` }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * WebアプリからのPOSTリクエストを処理します。
 * 担当者割り当ての更新と、Googleカレンダーのイベント操作（作成・更新・削除）を処理します。
 */
function doPost(e) {
  // e.parameterから操作の種類を特定
  const operation = e.parameter.operation;

  try {
    // 操作に応じて処理を分岐
    if (operation === 'create' || operation === 'update' || operation === 'delete') {
      // --- カレンダー操作 ---
      return handleCalendarEvent(e.parameter);
    } else {
      // --- スプレッドシート（担当者）更新 ---
      // operationパラメータがない場合は、従来の担当者更新とみなす
      return handleSheetUpdate(e.parameter);
    }
  } catch (error) {
    Logger.log(`doPost Error: ${error.message} (Operation: ${operation}). Stack: ${error.stack}`);
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: `GAS doPost Error: ${error.message}`, error: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * スプレッドシートの担当者情報を更新する
 */
function handleSheetUpdate(params) {
  const { orderId, staffName } = params;

  if (!orderId) {
    throw new Error("必須データ (orderId) がアプリから送信されていません。");
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error(`シート「${SHEET_NAME}」が見つかりません。`);
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const orderIdColIndex = headers.indexOf("受注ID");
  const staffNameColIndex = headers.indexOf("担当");

  if (orderIdColIndex === -1) throw new Error("スプレッドシートに「受注ID」列が見つかりません。");
  if (staffNameColIndex === -1) throw new Error("スプレッドシートに「担当」列が見つかりません。");

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][orderIdColIndex]) === String(orderId)) {
      sheet.getRange(i + 1, staffNameColIndex + 1).setValue(staffName || null); // staffNameが空ならセルを空にする
      
      const result = {
        status: "success",
        message: `受注ID: ${orderId} の担当者を「${staffName || '未割当'}」に更新しました。`
      };
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }
  }

  throw new Error(`指定された受注ID: ${orderId} がシートに見つかりませんでした。`);
}

/**
 * Googleカレンダーのイベントを操作する
 */
function handleCalendarEvent(params) {
  const { operation, calendarId, eventId, title, description, startTime, endTime } = params;

  if (!calendarId) {
    throw new Error("必須データ (calendarId) が送信されていません。");
  }

  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) {
    throw new Error(`カレンダーID「${calendarId}」が見つからないか、アクセス権がありません。`);
  }

  let result = {};

  switch (operation) {
    case 'create':
      if (!title || !startTime || !endTime) {
        throw new Error("カレンダー予定の作成には title, startTime, endTime が必要です。");
      }
      const newEvent = calendar.createEvent(
        title,
        new Date(startTime),
        new Date(endTime),
        { description: description || '' }
      );
      result = { status: "success", message: "カレンダーに予定を作成しました。", eventId: newEvent.getId() };
      break;

    case 'update':
      if (!eventId || !title || !startTime || !endTime) {
        throw new Error("カレンダー予定の更新には eventId, title, startTime, endTime が必要です。");
      }
      const eventToUpdate = calendar.getEventById(eventId);
      if (!eventToUpdate) throw new Error(`イベントID「${eventId}」が見つかりません。`);
      
      eventToUpdate.setTitle(title);
      eventToUpdate.setTime(new Date(startTime), new Date(endTime));
      if (description) {
        eventToUpdate.setDescription(description);
      }
      result = { status: "success", message: "カレンダーの予定を更新しました。", eventId: eventId };
      break;

    case 'delete':
      if (!eventId) {
        throw new Error("カレンダー予定の削除には eventId が必要です。");
      }
      const eventToDelete = calendar.getEventById(eventId);
      if (eventToDelete) {
        eventToDelete.deleteEvent();
        result = { status: "success", message: "カレンダーから予定を削除しました。" };
      } else {
        // イベントが見つからなくてもエラーとしない
        result = { status: "success", message: "指定されたイベントは既に見つかりませんでした。" };
      }
      break;

    default:
      throw new Error(`不明な操作です: ${operation}`);
  }

  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
