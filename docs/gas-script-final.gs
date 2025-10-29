// 【重要】受注情報と担当者が記載されているシート名に書き換えてください
const SHEET_NAME = "受注一覧"; 

/**
 * WebアプリからのGETリクエストを処理します。
 */
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error(`シート '${SHEET_NAME}' が見つかりません。`);
    
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
        obj[header] = (row[index] instanceof Date) ? row[index].toISOString() : row[index];
      });
      obj["Order_URL"] = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}&range=A${rowIndex + 2}`;
      return obj;
    });

    return ContentService.createTextOutput(JSON.stringify({ data: data })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: `GAS doGet Error: ${error.message}` })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * WebアプリからのPOSTリクエストを処理します。
 * ★★★ フォーム形式とJSON形式の両方に対応できるように修正 ★★★
 */
function doPost(e) {
  let params;
  try {
    // まずJSONとしてパースを試みる
    params = JSON.parse(e.postData.contents);
  } catch (jsonError) {
    // JSONでなければ、フォーム形式 (e.parameter) として扱う
    params = e.parameter;
  }

  const operation = params.operation;

  try {
    if (operation === 'create' || operation === 'update' || operation === 'delete') {
      return handleCalendarEvent(params);
    } else {
      return handleSheetUpdate(params);
    }
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: `GAS doPost Error: ${error.message}`, error: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- これ以降のヘルパー関数は変更なし ---

function handleSheetUpdate(params) {
  const { orderId, staffName } = params;
  if (!orderId) throw new Error("必須データ (orderId) がアプリから送信されていません。");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`シート「${SHEET_NAME}」が見つかりません。`);

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const orderIdColIndex = headers.indexOf("受注ID");
  const staffNameColIndex = headers.indexOf("担当");

  if (orderIdColIndex === -1) throw new Error("スプレッドシートに「受注ID」列が見つかりません。");
  if (staffNameColIndex === -1) throw new Error("スプレッドシートに「担当」列が見つかりません。");

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][orderIdColIndex]) === String(orderId)) {
      const valueToSet = (staffName && staffName !== 'undefined' && staffName !== 'null') ? staffName : "";
      sheet.getRange(i + 1, staffNameColIndex + 1).setValue(valueToSet);
      
      const result = { status: "success", message: `受注ID: ${orderId} の担当者を「${valueToSet || '未割当'}」に更新しました。`};
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }
  }
  throw new Error(`指定された受注ID: ${orderId} がシートに見つかりませんでした。`);
}

function handleCalendarEvent(params) {
  const { operation, calendarId, eventId, title, description, startTime, endTime } = params;
  if (!calendarId) throw new Error("必須データ (calendarId) が送信されていません。");
  
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) throw new Error(`カレンダーID「${calendarId}」が見つからないか、アクセス権がありません。`);

  let result = {};
  switch (operation) {
    case 'create':
      if (!title || !startTime || !endTime) throw new Error("予定の作成には title, startTime, endTime が必要です。");
      const newEvent = calendar.createEvent(title, new Date(startTime), new Date(endTime), { description: description || '' });
      result = { status: "success", message: "カレンダーに予定を作成しました。", eventId: newEvent.getId() };
      break;
    case 'update':
      if (!eventId || !title || !startTime || !endTime) throw new Error("予定の更新には eventId, title, startTime, endTime が必要です。");
      const eventToUpdate = calendar.getEventById(eventId);
      if (!eventToUpdate) throw new Error(`イベントID「${eventId}」が見つかりません。`);
      eventToUpdate.setTitle(title);
      eventToUpdate.setTime(new Date(startTime), new Date(endTime));
      if (description) eventToUpdate.setDescription(description);
      result = { status: "success", message: "カレンダーの予定を更新しました。", eventId: eventId };
      break;
    case 'delete':
      if (!eventId) throw new Error("予定の削除には eventId が必要です。");
      const eventToDelete = calendar.getEventById(eventId);
      if (eventToDelete) eventToDelete.deleteEvent();
      result = { status: "success", message: "カレンダーから予定を削除しました。" };
      break;
    default:
      throw new Error(`不明な操作です: ${operation}`);
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
