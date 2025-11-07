// ↓↓↓↓【要設定】↓↓↓↓
// 「受注管理」シートがあるスプレッドシートのIDを貼り付けてください
const ORDER_SPREADSHEET_ID = "1Q3i81tz-j8GahLBRtdMJfnUjsx_VmM8fN7gn--j85JU"; 
const ORDER_SHEET_NAME = "受注管理"; 

// 「スタッフマスタ」シートがあるスプレッドシートのIDを貼り付けてください
const STAFF_SPREADSHEET_ID = "1ojkHXVYFyomm-2RMbWq6QrG4NPCit2y6lxXQFsK_J60";
const STAFF_SHEET_NAME = "Sheet1"; // 実際のシート名に合わせて変更してください
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
    
    if (params.operation === 'sendEmail') {
      return handleSendEmail(params);
    } else if (params.operation) { // 'create', 'update', 'delete' calendar events
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

function handleSendEmail(params) {
  try {
    const { to, subject, body, icsData } = params;
    if (!to || !subject || !body) {
      throw new Error("メールの送信には to, subject, body が必要です。");
    }
    
    const options = {
      name: 'カレンダーの予定',
      attachments: []
    };
    if (icsData) {
      options.attachments.push({
        fileName: "invite.ics",
        mimeType: "text/calendar",
        content: icsData
      });
    }

    MailApp.sendEmail(to, subject, body, options);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: `メールを ${to} に送信しました。`
    })).setMimeType(ContentService.MimeType.JSON);

  } catch(e) {
    console.error("Error in handleSendEmail:", e.message, e.stack);
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: `メール送信エラー: ${e.message}`
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
    
    const spreadsheet = SpreadsheetApp.openById(ORDER_SPREADSHEET_ID);
    if (!spreadsheet) throw new Error(`スプレッドシート（ID: ${ORDER_SPREADSHEET_ID}）が開けません。存在しないか、権限がありません。`);

    const sheet = spreadsheet.getSheetByName(ORDER_SHEET_NAME);
    if (!sheet) throw new Error(`シート「${ORDER_SHEET_NAME}」が見つかりません。`);

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
            'Complete Task': "作業完了"
        };
        if(actionColMap[actionType]) {
            updateColumn(actionColMap[actionType], dateValue);
        }
    }

    const staffSpreadsheet = SpreadsheetApp.openById(STAFF_SPREADSHEET_ID);
    const staffDataSheet = staffSpreadsheet.getSheetByName(STAFF_SHEET_NAME);
    if (!staffDataSheet) throw new Error(`シート「${STAFF_SHEET_NAME}」がスプレッドシートID '${STAFF_SPREADSHEET_ID}' 内に見つかりません。`);

    const staffData = staffDataSheet.getDataRange().getValues();
    const staffHeaders = staffData[0];
    const staffNameCol = staffHeaders.indexOf("スタッフ名");
    const calendarIdCol = staffHeaders.indexOf("calendarId");
    const currentStaffName = staffName || sheet.getRange(rowNum, headers.indexOf("担当") + 1).getValue();
    
    let staffCalendarId;
    if (currentStaffName) {
        for(let i=1; i < staffData.length; i++) {
            if(staffData[i][staffNameCol] === currentStaffName) {
                staffCalendarId = staffData[i][calendarIdCol];
                break;
            }
        }
    }
    
    console.log(`Found calendarId: ${staffCalendarId} for staff: ${currentStaffName}`);

    if (scheduledTime && staffCalendarId) {
      console.log(`Updating linked calendar events on calendar ${staffCalendarId}`);
      const calendar = CalendarApp.getCalendarById(staffCalendarId);
      if(calendar) {
          const taskStart = new Date(scheduledTime);
          const workDuration = sheet.getRange(rowNum, headers.indexOf("作業時間（分）") + 1).getValue() || 60;
          const taskEnd = new Date(taskStart.getTime() + workDuration * 60000);
          const travelStart = new Date(taskStart.getTime() - 30 * 60000);

          const currentTaskEventId = sheet.getRange(rowNum, headers.indexOf("taskCalendarEventId") + 1).getValue();
          const currentTravelEventId = sheet.getRange(rowNum, headers.indexOf("travelCalendarEventId") + 1).getValue();
          
          if(currentTaskEventId) {
            try {
              const event = calendar.getEventById(currentTaskEventId);
              if (event) event.setTime(taskStart, taskEnd);
            } catch(e) { console.error(`Failed to update task event ${currentTaskEventId}: ${e.message}`);}
          }
          if(currentTravelEventId) {
            try {
              const event = calendar.getEventById(currentTravelEventId);
              if(event) event.setTime(travelStart, taskStart);
            } catch(e) { console.error(`Failed to update travel event ${currentTravelEventId}: ${e.message}`);}
          }
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
