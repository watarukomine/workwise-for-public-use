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

function toYMDFormat(dateInput) {
  if (!dateInput) return "";
  const str = String(dateInput).trim();
  if (!str) return "";

  if (str.includes('T') || str.includes('Z')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      // JST conversion (+9h)
      const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
      const yyyy = jst.getUTCFullYear();
      const mm = String(jst.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(jst.getUTCDate()).padStart(2, '0');
      return `${yyyy}/${mm}/${dd}`;
    }
  }

  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      return `${parts[0]}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`;
    }
  }

  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      return `${parts[0]}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`;
    }
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd}`;
  }

  return str;
}

async function run() {
  console.log('🚀 スプレッドシートの「作業予定日」列フォーマット修正を開始します...');

  // Get sheet name
  const meta = await sheetsLayer.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheets = meta.data.sheets || [];
  const matched = sheets.find(s => s.properties.title.trim() === '受注管理');
  const sheetTitle = matched ? matched.properties.title : '受注管理';

  // Read Column G (作業予定日)
  const range = `'${sheetTitle}'!G2:G5000`;
  const res = await sheetsLayer.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range
  });

  const rows = res.data.values || [];
  console.log(`📊 取得した行数: ${rows.length} 行`);

  const updatedRows = [];
  let fixCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const origVal = rows[i][0] ? String(rows[i][0]) : '';
    const formatted = toYMDFormat(origVal);
    if (formatted !== origVal) {
      fixCount++;
    }
    updatedRows.push([formatted]);
  }

  console.log(`📡 修正が必要な日付セル: ${fixCount} 件`);

  if (fixCount > 0) {
    await sheetsLayer.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetTitle}'!G2:G${1 + updatedRows.length}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: updatedRows }
    });
    console.log('✅ スプレッドシートの作業予定日を一括で YYYY/MM/DD に更新しました！');
  } else {
    console.log('✨ 既にすべて YYYY/MM/DD 形式でした。');
  }
}

run().catch(console.error);
