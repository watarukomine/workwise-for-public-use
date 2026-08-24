import { google } from 'googleapis';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

const SPREADSHEET_ID = '17P4aHYXFdPUtWCrZY4G_LY_zcUYP9ClHNRVcMvj6c6s';
const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheetsLayer = google.sheets({ version: 'v4', auth });

async function syncBackup() {
  console.log('🔍 スプレッドシートの既存データを取得中...');
  const res = await sheetsLayer.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '受注管理!A1:Z5000',
  });
  const rows = res.data.values || [];
  console.log(`📊 スプレッドシートの現在の行数: ${rows.length} 行 (ヘッダー含む)`);

  const existingSystemIds = new Set();
  for (let i = 1; i < rows.length; i++) {
    const sysId = rows[i][1]; // Column B: SystemID
    if (sysId && String(sysId).trim() !== '') {
      existingSystemIds.add(String(sysId).trim());
    }
  }
  console.log(`📊 スプレッドシート上のユニークSystemID件数: ${existingSystemIds.size} 件`);

  console.log('📡 Firestore から全 orders を取得中...');
  const snapshot = await db.collection('orders').get();
  
  const missingOrders = [];
  snapshot.forEach(doc => {
    const d = doc.data();
    const sysId = d.systemId || doc.id;
    if (d._type === 'order' && sysId && !existingSystemIds.has(sysId)) {
      missingOrders.push({ id: doc.id, ...d });
    }
  });

  console.log(`💡 スプレッドシートに未反映の受注データ: ${missingOrders.length} 件`);

  if (missingOrders.length === 0) {
    console.log('✨ すべての受注データは既にスプレッドシートに完全にバックアップされています！');
    return;
  }

  // Sort by scheduledDate ascending
  missingOrders.sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''));

  // Prepare rows in exact 26-column format
  let currentMaxDisplayId = rows.length;
  const appendRows = missingOrders.map(d => {
    const displayId = d.displayId || String(++currentMaxDisplayId);
    return [
      displayId,
      d.systemId || d.id,
      d.customerCode || d.userCode || (d['ユーザーコード'] || ''),
      d.customerName || d.storeName || (d['店舗名'] || ''),
      d.mainStore || d.mainBranch || (d['主管店舗'] || ''),
      d.hasEquipment || (d['機材有無'] || ''),
      d.scheduledDate || (d['作業予定日'] || ''),
      d.scheduledTime || (d['予定時間'] || ''),
      d.picName || (d['ご担当者様'] || ''),
      d.cancelledAt || (d['キャンセル日時'] || ''),
      d.cancelledBy || (d['キャンセル連絡者'] || ''),
      d.workType || d.serviceType || (d['作業'] || ''),
      d.orderNo || d.orderNoRemark || (d['受注No\r\n(ﾘﾏｰｸ1 8ｹﾀ)'] || d['受注No'] || ''),
      d.comment || (d['任意コメント\n(ﾘﾏｰｸ2　10ｹﾀ)'] || d['任意コメント'] || ''),
      d.carName || (d['車名'] || ''),
      String(d.regNo || d['登録ナンバー\n(下４桁)'] || d['登録ナンバー'] || ''),
      d.status || d.receivingStatus || (d['入庫状況'] || 'お預かり済'),
      d.tireNumber || (d['タイヤ品番'] || ''),
      d.tireSize || (d['タイヤサイズ'] || ''),
      d.productName || (d['品名'] || ''),
      d.workDetails || d.workContent || d.workType || (d['作業内容'] || ''),
      String(d.quantity || d.tireCount || (d['本数'] || '')),
      d.sensor || (d['空気圧センサー\nパッキン交換'] || d['空気圧センサー'] || ''),
      d.arrangement || (d['タイヤ手配状況'] || ''),
      d.disposal || (d['廃タイヤ処分'] || ''),
      d.contact || d.phone || (d['連絡先'] || '')
    ];
  });

  console.log(`🚀 未反映の受注データ ${appendRows.length} 件をスプレッドシートへ追加書き込み中...`);

  const BATCH_SIZE = 200;
  for (let i = 0; i < appendRows.length; i += BATCH_SIZE) {
    const chunk = appendRows.slice(i, i + BATCH_SIZE);
    await sheetsLayer.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: '受注管理!A2',
      valueInputOption: 'RAW',
      resource: { values: chunk }
    });
    console.log(`   ✅ ${i + chunk.length} / ${appendRows.length} 件 追加完了`);
  }

  console.log(`\n🎉 スプレッドシートへの全件バックアップ同期が完了しました！`);
}

syncBackup().catch(console.error);
