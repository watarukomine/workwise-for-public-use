// 【重要】スタッフ情報が記載されているシート名に書き換えてください
const SHEET_NAME = "スタッフマスタ";

/**
 * HTTP GETリクエストを処理します。
 * 設定されたシートから全データを読み込み、JSON形式で返します。
 * ★★★ セルの背景色を読み取る機能を追加 ★★★
 */
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error(`シート '${SHEET_NAME}' が見つかりません。`);
    }
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const backgrounds = dataRange.getBackgrounds(); // セルの背景色を取得

    if (values.length < 1) {
      return ContentService.createTextOutput(JSON.stringify({ data: [] })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const headers = values.shift(); // 最初の行をヘッダーとして取得
    backgrounds.shift(); // ヘッダー行の背景色は不要なので取り除く

    // 'color' または 'カラー' 列のインデックスを見つける
    let colorColIndex = headers.indexOf('color');
    if (colorColIndex === -1) {
      colorColIndex = headers.indexOf('カラー');
    }

    const data = values.map((row, rowIndex) => {
      const obj = {};
      headers.forEach((header, index) => {
        if (row[index] instanceof Date) {
          obj[header] = row[index].toISOString();
        } else {
          obj[header] = row[index];
        }
      });

      // color列の背景色をHEX形式で取得して、colorプロパティとして追加
      if (colorColIndex !== -1) {
        obj['color'] = backgrounds[rowIndex][colorColIndex];
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
 * このスクリプトではPOSTリクエストは使用しません。
 * 担当者の割り当ては受注管理用のGASが処理します。
 */
function doPost(e) {
  return ContentService
      .createTextOutput(JSON.stringify({ "status": "info", "message": "このスクリプトではPOSTリクエストは処理されません。" }))
      .setMimeType(ContentService.MimeType.JSON);
}
