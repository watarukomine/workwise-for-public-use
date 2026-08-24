import { google } from 'googleapis';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

const SPREADSHEET_ID = '17P4aHYXFdPUtWCrZY4G_LY_zcUYP9ClHNRVcMvj6c6s';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyxFXMdbcTfvrA0cZ_V1av92eDy7LHRuNU9dY1sJzb0jquEs4QhGRTnxSaFRCH9uYik/exec';

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
  
  const res = await sheetsLayer.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'受注管理'!A1:Z5000`,
  });

  const rows = res.data.values || [];
  const existingSystemIds = new Set();
  
  for (let i = 1; i < rows.length; i++) {
    const sysId = rows[i][1]; // Column B: SystemID
    if (sysId && String(sysId).trim() !== '' && !String(sysId).startsWith('TEST_')) {
      existingSystemIds.add(String(sysId).trim());
    }
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
    console.log('✨ すべての受注データは既にスプレッドシートに同期されています！');
    return;
  }

  // Sort chronologically by scheduledDate
  missingOrders.sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''));

  console.log(`🚀 未反映の受注データ (${missingOrders.length} 件) を GAS 経由でスプレッドシートへ順次バックアップ中...`);
  let successCount = 0;
  let failCount = 0;

  const sendOrder = async (data) => {
    // Note: Do NOT include top-level systemId or orderId or eventTitle in payload
    // because GAS route prioritizes updateSheetWithOrderInfo if those exist.
    const sysId = data.systemId || data.docId;
    const payload = {
      action: 'createOrder',
      gasUrl: GAS_URL,
      userCode: data.customerCode || data.userCode || (data['ユーザーコード'] || ''),
      customerCode: data.customerCode || data.userCode || (data['ユーザーコード'] || ''),
      storeName: data.customerName || data.storeName || (data['店舗名'] || ''),
      customerName: data.customerName || data.storeName || (data['店舗名'] || ''),
      mainStore: data.mainStore || data.mainBranch || (data['主管店舗'] || ''),
      hasEquipment: data.hasEquipment || (data['機材有無'] || ''),
      workType: data.workType || data.serviceType || (data['作業'] || ''),
      scheduledDate: data.scheduledDate || (data['作業予定日'] || ''),
      scheduledTime: data.scheduledTime || (data['予定時間'] || ''),
      picName: data.picName || (data['ご担当者様'] || ''),
      orderNo: data.orderNo || data.orderNoRemark || (data['受注No\r\n(ﾘﾏｰｸ1 8ｹﾀ)'] || data['受注No'] || ''),
      comment: data.comment || (data['任意コメント\n(ﾘﾏｰｸ2　10ｹﾀ)'] || data['任意コメント'] || ''),
      carName: data.carName || (data['車名'] || ''),
      regNo: String(data.regNo || data['登録ナンバー\n(下４桁)'] || data['登録ナンバー'] || ''),
      status: data.status || data.receivingStatus || (data['入庫状況'] || 'お預かり済'),
      tireNumber: data.tireNumber || (data['タイヤ品番'] || ''),
      tireSize: data.tireSize || (data['タイヤサイズ'] || ''),
      productName: data.productName || (data['品名'] || ''),
      workDetails: data.workDetails || data.workContent || (data['作業内容'] || ''),
      quantity: String(data.quantity || data.tireCount || (data['本数'] || '')),
      sensor: data.sensor || (data['空気圧センサー\nパッキン交換'] || data['空気圧センサー'] || ''),
      arrangement: data.arrangement || (data['タイヤ手配状況'] || ''),
      disposal: data.disposal || (data['廃タイヤ処分'] || ''),
      contact: data.contact || data.phone || (data['連絡先'] || ''),
      staffName: data.staffName || (data['作業担当者'] || '')
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
        // If new order was assigned a new ID by GAS, update Firestore if needed
        if (successCount % 20 === 0 || successCount === missingOrders.length) {
          console.log(`  進捗: ${successCount} / ${missingOrders.length} 件 同期完了 (${payload.scheduledDate} ${payload.storeName})`);
        }
      } else {
        failCount++;
        console.warn(`  ⚠️ 同期失敗: ${sysId}`, result.message);
      }
    } catch (e) {
      failCount++;
      console.error(`  ❌ 送信エラー: ${sysId}`, e.message);
    }
  };

  // Concurrency of 3 to ensure GAS stability
  const CONCURRENCY = 3;
  for (let i = 0; i < missingOrders.length; i += CONCURRENCY) {
    const chunk = missingOrders.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(sendOrder));
    await new Promise(res => setTimeout(res, 300));
  }

  console.log(`\n🎉 全未反映データ (${successCount}/${missingOrders.length} 件) のスプレッドシートバックアップが完了しました！ (失敗: ${failCount} 件)`);
}

syncAllMissing().catch(console.error);
