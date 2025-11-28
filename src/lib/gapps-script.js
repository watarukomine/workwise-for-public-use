
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
    
    if (params.operation === 'sendEmail') {
      return sendIcsEmail(params);
    } else if (params.eventTitle) { // Update sheet from app
      return updateSheetWithOrderInfo(params);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "必要なパラメータ (eventTitle または operation) がありません" })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    console.error("Error in doPost:", error.message, error.stack);
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "エラーが発生しました: " + error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 受注IDでシートを検索し、指定された情報で更新する
 */
function updateSheetWithOrderInfo(params) {
  const { 
      eventTitle, staffName, statusValue, timestamp, latitude, longitude, actionType, 
      actionTimestamp, scheduledTime
  } = params;

  try {
    console.log("Updating sheet with:", JSON.stringify(params));
    
    const match = eventTitle.match(/\(ID:\s*([\w-]+)\)/);
    if (!match || !match[1] || match[1].toUpperCase() === 'N/A') {
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "汎用タスクまたはIDなしタスクのためシート更新はスキップされました。" })).setMimeType(ContentService.MimeType.JSON);
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
        
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: `受注ID: ${orderId} を更新しました。`, })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    console.error("Error in updateSheetWithOrderInfo:", error.message, error.stack);
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function sendIcsEmail(params) {
  const { staffName, title, description, startTime, endTime, location } = params;

  try {
    if (!staffName) throw new Error("スタッフ名が指定されていません。");

    const staffSpreadsheet = SpreadsheetApp.openById(STAFF_SPREADSHEET_ID);
    const staffSheet = staffSpreadsheet.getSheetByName(STAFF_SHEET_NAME);
    if (!staffSheet) throw new Error(`シート「${STAFF_SHEET_NAME}」が見つかりません。`);

    const staffData = staffSheet.getDataRange().getValues();
    const headers = staffData[0];
    const nameCol = headers.indexOf("スタッフ名");
    const emailCol = headers.indexOf("メールアドレス");

    if (nameCol === -1 || emailCol === -1) throw new Error("スタッフマスタに「スタッフ名」または「メールアドレス」の列が見つかりません。");

    let recipientEmail;
    for (let i = 1; i < staffData.length; i++) {
      if (staffData[i][nameCol] === staffName) {
        recipientEmail = staffData[i][emailCol];
        break;
      }
    }

    if (!recipientEmail) {
      // Return success even if email not found to not block UI, but log it.
      console.warn(`Email for staff "${staffName}" not found. Skipping email.`);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "担当者のメールアドレスが見つからなかったため、メールは送信されませんでした。" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      console.warn(`Invalid email format for ${staffName}: ${recipientEmail}. Skipping email.`);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: `担当者 (${staffName}) のメールアドレス形式が正しくありません。` })).setMimeType(ContentService.MimeType.JSON);
    }

    const formatToIcsDate = (date) => {
      return date.getUTCFullYear() + 
             ('0' + (date.getUTCMonth() + 1)).slice(-2) + 
             ('0' + date.getUTCDate()).slice(-2) + 'T' + 
             ('0' + date.getUTCHours()).slice(-2) + 
             ('0' + date.getUTCMinutes()).slice(-2) + 
             ('0' + date.getUTCSeconds()).slice(-2) + 'Z';
    };

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const now = new Date();
    
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//WorkWise//EN',
      'BEGIN:VEVENT',
      'UID:' + Utilities.getUuid(),
      'DTSTAMP:' + formatToIcsDate(now),
      'DTSTART:' + formatToIcsDate(startDate),
      'DTEND:' + formatToIcsDate(endDate),
      'SUMMARY:' + title,
      'DESCRIPTION:' + (description || ''),
      'LOCATION:' + (location || ''),
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const subject = "新規予定のお知らせ: " + title;
    const body = "新しい予定が割り当てられました。添付のiCalendarファイルを開いてカレンダーに追加してください。";
    const options = {
      attachments: [{
        fileName: "invite.ics",
        content: icsContent,
        mimeType: "text/calendar"
      }]
    };

    MailApp.sendEmail(recipientEmail, subject, body, options);
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: `担当者 ${staffName} に予定のメールを送信しました。` })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error("Error in sendIcsEmail:", error.message, error.stack);
    // Even if email fails, we don't want to block the UI flow, so we return a modified success response.
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: `シートは更新されましたが、メール送信中にエラーが発生しました: ${error.message}` })).setMimeType(ContentService.MimeType.JSON);
  }
}
