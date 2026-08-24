import { google } from 'googleapis';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheetsLayer = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = '17P4aHYXFdPUtWCrZY4G_LY_zcUYP9ClHNRVcMvj6c6s';

async function repairSheet() {
  console.log('🔧 受注管理シートの完全修復を開始します...');

  // 1. 全データを取得
  const res = await sheetsLayer.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '受注管理!A1:Z3000',
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const allRows = res.data.values || [];
  console.log(`📊 現在の行数: ${allRows.length} 行`);

  const header = allRows[0];
  const dataRows = allRows.slice(1);

  // 2. task-xxx 行を除去し、純粋な受注データのみを抽出
  const cleanedRows = [];
  let removedTaskCount = 0;

  dataRows.forEach((row, idx) => {
    const sysId = String(row[1] || '').trim();
    const colA = String(row[0] || '').trim();
    if (sysId.startsWith('task-') || colA.startsWith('task-')) {
      removedTaskCount++;
      return; // スキップ（削除）
    }
    if (!sysId && !row[2] && !row[3]) {
      return; // 完全に空の行はスキップ
    }

    // A列、E列、F列はARRAYFORMULA数式で自動計算させるため、行データ内では空文字にする
    // 2行目（インデックス0）だけは後で数式をセットする
    const cleanedRow = [...row];
    // A列(0)を空にする
    cleanedRow[0] = '';
    // E列(4)を空にする
    cleanedRow[4] = '';
    // F列(5)を空にする
    cleanedRow[5] = '';

    // 26列に満たない場合は埋める
    while (cleanedRow.length < 26) {
      cleanedRow.push('');
    }

    cleanedRows.push(cleanedRow);
  });

  console.log(`🧹 混入したタスク行 ${removedTaskCount} 件を削除しました。有効な受注行: ${cleanedRows.length} 行`);

  // 3. 2行目（先頭データ行）の数式を設定
  cleanedRows[0][0] = '=ARRAYFORMULA(IF(B2:B<>"", ROW(B2:B)-1, ""))';
  cleanedRows[0][4] = '=ARRAYFORMULA(IF(C2:C="", "", IFERROR(VLOOKUP(C2:C, \'販売店情報 のコピー\'!B:D, 3, FALSE), "")))';
  cleanedRows[0][5] = '=ARRAYFORMULA(IF(C2:C="", "", IFERROR(VLOOKUP(C2:C, \'販売店情報 のコピー\'!B:I, 8, FALSE), "")))';

  // 4. シートの既存データを完全にクリア
  console.log('🧹 シート全体をクリア中...');
  await sheetsLayer.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: '受注管理!A2:Z5000',
  });

  // 5. 修復データを一括書き込み (USER_ENTERED で数式を展開)
  console.log(`✍️ ${cleanedRows.length} 件のデータを書き込み中...`);
  const BATCH_SIZE = 500;
  for (let i = 0; i < cleanedRows.length; i += BATCH_SIZE) {
    const chunk = cleanedRows.slice(i, i + BATCH_SIZE);
    const startRowNum = i + 2;
    await sheetsLayer.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `受注管理!A${startRowNum}:Z${startRowNum + chunk.length - 1}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: chunk },
    });
    console.log(`   ✅ 行 ${startRowNum} 〜 ${startRowNum + chunk.length - 1} 書き込み完了`);
  }

  console.log('\n🎉 受注管理シートの完全修復が完了しました！');
}

repairSheet().catch(console.error);
