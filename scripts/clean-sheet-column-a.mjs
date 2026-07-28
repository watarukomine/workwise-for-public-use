import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { join } from 'path';

const SPREADSHEET_ID = '17P4aHYXFdPUtWCrZY4G_LY_zcUYP9ClHNRVcMvj6c6s';

const serviceAccountPath = join(process.cwd(), 'service-account.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheetsLayer = google.sheets({ version: 'v4', auth });

async function run() {
  console.log('🚀 スプレッドシートの A列（受注No）クリーンアップとテスト行削除を開始します...');

  const meta = await sheetsLayer.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheets = meta.data.sheets || [];
  const matched = sheets.find(s => s.properties.title.trim() === '受注管理');
  const sheetTitle = matched ? matched.properties.title : '受注管理';

  // Read A and B columns
  const range = `'${sheetTitle}'!A1:B5000`;
  const res = await sheetsLayer.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range
  });

  const rows = res.data.values || [];
  console.log(`📊 取得した全行数: ${rows.length} 行`);

  // Clear Column A from row 2 downwards
  const emptyAColumn = [];
  for (let i = 1; i < rows.length; i++) {
    emptyAColumn.push(['']);
  }

  await sheetsLayer.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetTitle}'!A2:A${1 + emptyAColumn.length}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: emptyAColumn }
  });

  console.log('✅ A列（受注No）の不要な値をすべて消去（空欄化）しました！');

  // Next: Find rows with test SystemIDs and remove them
  const allDataRes = await sheetsLayer.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetTitle}'!A1:Z5000`
  });
  const allRows = allDataRes.data.values || [];

  const filteredRows = allRows.filter((row, idx) => {
    if (idx === 0) return true; // Keep header
    const sysId = row[1] ? String(row[1]) : '';
    if (sysId.startsWith('test_') || sysId.startsWith('test_action_')) {
      console.log(`🗑️ テスト行を削除します: 行 ${idx + 1} (${sysId})`);
      return false;
    }
    return true;
  });

  if (filteredRows.length < allRows.length) {
    // Clear whole sheet and rewrite
    await sheetsLayer.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetTitle}'!A1:Z5000`
    });

    await sheetsLayer.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetTitle}'!A1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: filteredRows }
    });
    console.log(`✅ テスト行 ${allRows.length - filteredRows.length} 件をクリア・整理しました！`);
  }
}

run().catch(console.error);
