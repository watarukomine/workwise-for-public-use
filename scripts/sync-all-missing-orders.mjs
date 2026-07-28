import { google } from 'googleapis';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

const SPREADSHEET_ID = '17P4aHYXFdPUtWCrZY4G_LY_zcUYP9ClHNRVcMvj6c6s';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzbHRT6aSOzWl5XMO6znnEtOVFqsYpnuCKm3xolZWzyZGBxUo7qQm6dshn1P0kOpK5F/exec';

const serviceAccountPath = join(process.cwd(), 'service-account.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheetsLayer = google.sheets({ version: 'v4', auth });

async function syncAllMissing() {
  console.log('🔍 スプレッドシートから既存の SystemID 一覧を取得中...');
  
  let targetSheetName = '受注管理';
  try {
    const meta = await sheetsLayer.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheets = meta.data.sheets || [];
    const matched = sheets.find(s => s.properties.title.trim() === '受注管理');
    if (matched) targetSheetName = matched.properties.title;
  } catch (e) {
    console.warn('Metadata fetch warning:', e.message);
  }

  const res = await sheetsLayer.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${targetSheetName}'!B2:B5000`,
  });

  const existingSystemIds = new Set();
  if (res.data.values) {
    res.data.values.forEach(row => {
      if (row[0] && String(row[0]).trim() !== '') {
        existingSystemIds.add(String(row[0]).trim());
      }
    });
  }
  console.log(`📊 スプレッドシート上に既に存在する受注件数: ${existingSystemIds.size} 件`);

  console.log('📡 Firestore から全 orders を取得中...');
  const snapshot = await db.collection('orders').get();

  const missingOrders = [];
  snapshot.forEach(doc => {
    const d = doc.data();
    const sysId = d.systemId || doc.id;
    if (d._type === 'order' && sysId && !existingSystemIds.has(sysId)) {
      missingOrders.push({ docId: doc.id, ...d });
    }
  });

  console.log(`💡 スプレッドシートに未反映の受注データ: ${missingOrders.length} 件`);

  if (missingOrders.length === 0) {
    console.log('✨ すべての過去受注データは既にスプレッドシートに同期されています！');
    return;
  }

  console.log('🚀 未反映の受注データを GAS 経由でスプレッドシートへ平行追加中...');
  let successCount = 0;

  const sendOrder = async (data) => {
    const sysId = data.systemId || data.docId;
    const payload = {
      action: 'createOrder',
      gasUrl: GAS_URL,
      systemId: sysId,
      orderId: sysId,
      displayId: data.displayId || '',
      userCode: data.customerCode || data.userCode || '',
      customerCode: data.customerCode || data.userCode || '',
      storeName: data.customerName || data.storeName || '',
      customerName: data.customerName || data.storeName || '',
      mainStore: data.mainStore || '',
      workType: data.workType || data.serviceType || '',
      scheduledDate: data.scheduledDate || '',
      scheduledTime: data.scheduledTime || '',
      picName: data.picName || '',
      orderNo: data.orderNo || data.orderNoRemark || '',
      comment: data.comment || '',
      carName: data.carName || '',
      regNo: data.regNo || '',
      status: data.status || '未割当',
      tireNumber: data.tireNumber || '',
      tireSize: data.tireSize || '',
      productName: data.productName || '',
      quantity: String(data.quantity || ''),
      sensor: data.sensor || '',
      arrangement: data.arrangement || '',
      disposal: data.disposal || '',
      contact: data.contact || '',
      specialNotes: data.specialNotes || '',
      submitter: data.submitter || '',
    };

    try {
      const resp = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await resp.json();
      if (result.status === 'success' || !result.error) {
        successCount++;
        console.log(`  ✅ 同期成功: ${sysId} (${payload.storeName})`);
      } else {
        console.warn(`  ⚠️ 同期失敗: ${sysId}`, result.message);
      }
    } catch (e) {
      console.error(`  ❌ 送信エラー: ${sysId}`, e.message);
    }
  };

  // Process in batches of 5
  for (let i = 0; i < missingOrders.length; i += 5) {
    const chunk = missingOrders.slice(i, i + 5);
    await Promise.all(chunk.map(sendOrder));
  }

  console.log(`\n🎉 全未反映データ (${successCount}/${missingOrders.length} 件) の同期処理が完了しました！`);
}

syncAllMissing().catch(console.error);
