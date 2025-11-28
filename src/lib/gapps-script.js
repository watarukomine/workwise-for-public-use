// ↓↓↓↓【要設定】↓↓↓↓
// 「受注管理」シートがあるスプレッドシートのIDを貼り付けてください
const ORDER_SPREADSHEET_ID = "17P4aHYXFdPUtWCrZY4G_LY_zcUYP9ClHNRVcMvj6c6s"; 
const ORDER_SHEET_NAME = "受注管理"; 

// 「スタッフマスタ」シートがあるスプレッドシートのIDを貼り付けてください
const STAFF_SPREADSHEET_ID = "1ojkHXVYFyomm-2RMbWq6QrG4NPCit2y6lxXQFsK_J60";
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
        // Check if the cell value is a valid Date object before calling toISOString
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
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: "JSONデータの解析に失敗しました: " + parseError.message
        })).setMimeType(ContentService.MimeType.JSON);
      }
    } else {
      console.error("No JSON data received in request");
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "リクエストにJSONデータがありません"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (params.operation) { // 'create', 'update', 'delete' calendar events
      return handleCalendarEvent(params);
    } else if (params.eventTitle) { // Update sheet from app
      return updateSheetWithOrderInfo(params);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "必要なパラメータ (operation または eventTitle) がありません"
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    console.error("Error in doPost:", error.message, error.stack);
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "エラーが発生しました: " + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 受注IDでシートを検索し、指定された情報で更新する
 */
function updateSheetWithOrderInfo(params) {
  const { 
      eventTitle, staffName, statusValue, timestamp, latitude, longitude, actionType, 
      actionTimestamp, scheduledTime, taskCalendarEventId, travelCalendarEventId
  } = params;

  try {
    console.log("Updating sheet with:", JSON.stringify(params));
    
    const match = eventTitle.match(/\(ID:\s*([\w-]+)\)/);
    if (!match || !match[1] || match[1].toUpperCase() === 'N/A') {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "汎用タスクまたはIDなしタスクのためシート更新はスキップされました。" 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const orderId = match[1];
    console.log("Extracted order ID:", orderId);
    
    const orderSpreadsheet = SpreadsheetApp.openById(ORDER_SPREADSHEET_ID);
    const sheet = orderSpreadsheet.getSheetByName(ORDER_SHEET_NAME);
    if (!sheet) throw new Error(`シート「${ORDER_SHEET_NAME}」がスプレッドシートID '${ORDER_SPREADSHEET_ID}' 内に見つかりません。`);

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const orderIdCol = headers.indexOf("受注ID");
    if (orderIdCol === -1) throw new Error("スプレッドシートに「受注ID」列が見つかりません。");
    
    let rowNum = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][orderIdCol]) === String(orderId)) {
        rowNum = i + 1;
        break;
      }
    }
    if (rowNum === -1) {
      throw new Error(`指定された受注ID: ${orderId} がシートに見つかりませんでした。`);
    }
    
    console.log(`Updating row: ${rowNum}, ID: ${orderId}`);
    
    const updateColumn = (colName, value) => {
      if (value !== undefined) {
        const colIdx = headers.indexOf(colName);
        if (colIdx !== -1) {
          sheet.getRange(rowNum, colIdx + 1).setValue(value);
          console.log(`Updated column '${colName}' with value: ${value}`);
        }
      }
    };

    updateColumn("担当", staffName);
    updateColumn("受注ステータス", statusValue);
    updateColumn("最終更新日時", timestamp ? new Date(timestamp) : undefined);
    if(latitude !== undefined && longitude !== undefined) {
      updateColumn("最終位置情報（緯度,経度）", `${latitude}, ${longitude}`);
    }
    updateColumn("チップ配置作業予定", scheduledTime ? new Date(scheduledTime) : (scheduledTime === "" ? "" : undefined)); 
    updateColumn("taskCalendarEventId", taskCalendarEventId);
    updateColumn("travelCalendarEventId", travelCalendarEventId);

    if (actionType && actionTimestamp) {
        const dateValue = new Date(actionTimestamp);
        const actionColMap = {
            'Start Travel': "移動開始", 
            'Arrive': "現場到着",
            'Begin Task': "作業開始", 
            'Finish Task': "作業終了",
        };
        if(actionColMap[actionType]) {
            updateColumn(actionColMap[actionType], dateValue);
        }
    }

    const staffSpreadsheet = SpreadsheetApp.openById(STAFF_SPREADSHEET_ID);
    const staffDataSheet = staffSpreadsheet.getSheetByName(STAFF_SHEET_NAME);
    const staffCalendarId = findStaffCalendarId(staffDataSheet, staffName || sheet.getRange(rowNum, headers.indexOf("担当") + 1).getValue());
    
    console.log(`Found calendarId: ${staffCalendarId} for staff: ${staffName}`);

    if (scheduledTime && staffCalendarId) {
      const calendar = CalendarApp.getCalendarById(staffCalendarId);
      if(calendar) {
          const taskStart = new Date(scheduledTime);
          const workDuration = sheet.getRange(rowNum, headers.indexOf("作業時間（分）") + 1).getValue() || 60;
          const taskEnd = new Date(taskStart.getTime() + workDuration * 60000);
          const travelStart = new Date(taskStart.getTime() - 30 * 60000);

          const currentTaskEventId = sheet.getRange(rowNum, headers.indexOf("taskCalendarEventId") + 1).getValue();
          const currentTravelEventId = sheet.getRange(rowNum, headers.indexOf("travelCalendarEventId") + 1).getValue();
          
          updateCalendarEvent(calendar, currentTaskEventId, taskStart, taskEnd);
          updateCalendarEvent(calendar, currentTravelEventId, travelStart, taskStart);
      }
    }
        
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: `受注ID: ${orderId} を更新しました。`,
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    console.error("Error in updateSheetWithOrderInfo:", error.message, error.stack);
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function findStaffCalendarId(sheet, staffName) {
    if (!sheet) {
      console.error(`findStaffCalendarId Error: Staff sheet not found or provided.`);
      return null;
    }
    if (!staffName) {
      console.log(`findStaffCalendarId: No staff name provided, cannot find calendar ID.`);
      return null;
    }
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const nameCol = headers.indexOf("スタッフ名");
    const calIdCol = headers.indexOf("calendarId");
    if (nameCol === -1) {
      console.error(`findStaffCalendarId Error: 'スタッフ名' column not found in staff sheet.`);
      return null;
    }
    if (calIdCol === -1) {
      console.error(`findStaffCalendarId Error: 'calendarId' column not found in staff sheet.`);
      return null;
    }

    for(let i=1; i < data.length; i++) {
        if(data[i][nameCol] === staffName) {
            return data[i][calIdCol];
        }
    }
    console.warn(`findStaffCalendarId: Staff '${staffName}' not found in staff sheet.`);
    return null;
}

function updateCalendarEvent(calendar, eventId, startTime, endTime) {
    if (eventId) {
        try {
            const event = calendar.getEventById(eventId);
            if (event) {
                event.setTime(startTime, endTime);
                console.log(`Updated calendar event ${eventId}`);
            }
        } catch(e) { 
            console.error(`Failed to update calendar event ${eventId}: ${e.message}`);
        }
    }
}


/**
 * カレンダーイベントを作成・更新・削除する
 */
function handleCalendarEvent(params) {
  try {
    console.log("handleCalendarEvent called with:", JSON.stringify(params));
    
    const { operation, calendarId, eventId, title, description, startTime, endTime } = params;
    
    if (!operation || !calendarId) {
      throw new Error("必須パラメータ 'operation' または 'calendarId' がありません");
    }
    
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
        if (!eventId) throw new Error("予定の更新には eventId が必要です。");
        const eventToUpdate = calendar.getEventById(eventId);
        if (!eventToUpdate) throw new Error(`イベントID「${eventId}」が見つかりません。`);
        if (title) eventToUpdate.setTitle(title);
        if (startTime && endTime) eventToUpdate.setTime(new Date(startTime), new Date(endTime));
        if (description !== undefined) eventToUpdate.setDescription(description || "");
        result = { status: "success", message: "カレンダーの予定を更新しました。", eventId: eventId };
        break;
        
      case 'delete':
        if (!eventId) throw new Error("予定の削除には eventId が必要です。");
        try {
            const eventToDelete = calendar.getEventById(eventId);
            if (eventToDelete) {
                eventToDelete.deleteEvent();
                result = { status: "success", message: "カレンダーから予定を削除しました。" };
            } else {
                 result = { status: "success", message: "イベントは既に削除されているか、見つかりませんでした。" };
            }
        } catch(e) {
            console.warn(`Could not delete event ${eventId}, it might have been already deleted. Error: ${e.message}`);
            result = { status: "success", message: `イベント削除中に軽微なエラー: ${e.message}` };
        }
        break;
        
      default:
        throw new Error(`不明な操作です: ${operation}`);
    }
    
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error("Error in handleCalendarEvent:", error.message, error.stack);
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}
