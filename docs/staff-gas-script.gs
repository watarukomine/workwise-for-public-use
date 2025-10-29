// 【重要】スタッフ情報が記載されているシート名に書き換えてください
const SHEET_NAME = "【実際のシート名】";

function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error(`シート '${SHEET_NAME}' が見つかりません。`);
    }
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const backgrounds = dataRange.getBackgrounds(); // セルの背景色を取得

    const headers = values.shift(); // 最初の行をヘッダーとして取得
    backgrounds.shift(); // ヘッダー行の背景色は不要

    // 'color' または 'カラー' 列のインデックスを見つける
    let colorColIndex = headers.indexOf('color');
    if (colorColIndex === -1) {
      colorColIndex = headers.indexOf('カラー');
    }

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
