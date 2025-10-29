
const SHEET_NAME = "シート1"; // *重要* ここを実際のシート名に書き換えてください

function doPost(e) {
  try {
    // パラメータが送られてきているかチェック
    if (!e || !e.parameter) {
      throw new Error("リクエストからパラメータを取得できませんでした。");
    }

    const orderId = e.parameter.orderId;
    // staffNameは空の場合があるので、存在チェックはorderIdのみ
    const staffName = e.parameter.staffName; 

    if (!orderId) {
      throw new Error("必須データ (orderId) がアプリから送信されていません。");
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error(`シート「${SHEET_NAME}」が見つかりません。`);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // 受注IDと担当者カラムのインデックスを見つける
    const orderIdColIndex = headers.indexOf("受注ID");
    const staffNameColIndex = headers.indexOf("担当");

    if (orderIdColIndex === -1) {
      throw new Error("スプレッドシートに「受注ID」列が見つかりません。");
    }
    if (staffNameColIndex === -1) {
      throw new Error("スプレッドシートに「担当」列が見つかりません。");
    }

    // マッチする受注IDの行を探す
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][orderIdColIndex]) === String(orderId)) {
        // 担当者名を更新
        sheet.getRange(i + 1, staffNameColIndex + 1).setValue(staffName);
        
        const result = {
          status: "success",
          message: `受注ID: ${orderId} の担当者を「${staffName || '未割当'}」に更新しました。`
        };
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      }
    }

    throw new Error(`指定された受注ID: ${orderId} がシートに見つかりませんでした。`);

  } catch (error) {
    Logger.log("Error in doPost: " + error.message);
    const errorResult = {
      status: "error",
      message: "GAS doPost Error: " + error.message,
      error: true
    };
    // エラーの場合もJSON形式で返す
    return ContentService.createTextOutput(JSON.stringify(errorResult)).setMimeType(ContentService.MimeType.JSON);
  }
}
