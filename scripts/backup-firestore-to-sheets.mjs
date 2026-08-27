import { google } from 'googleapis';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

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

/**
 * Helper to calculate duration in minutes
 */
function calculateWorkDurationMinutes(startTime, arrivalTime, endTime) {
  if (!endTime) return null;
  const startTarget = startTime || arrivalTime;
  if (!startTarget) return null;

  try {
    const parseToDate = (val) => {
      if (!val) return null;
      if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
      if (typeof val === 'object' && val.toDate) {
        return val.toDate();
      }
      if (typeof val === 'object' && typeof val._seconds === 'number') {
        return new Date(val._seconds * 1000);
      }
      const str = String(val).trim();
      if (!str) return null;
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
        const parts = str.split(':').map(Number);
        const d = new Date();
        d.setHours(parts[0], parts[1], parts[2] || 0, 0);
        return d;
      }
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    };

    const sDate = parseToDate(startTarget);
    const eDate = parseToDate(endTime);

    if (!sDate || !eDate) return null;

    const diffMs = eDate.getTime() - sDate.getTime();
    if (diffMs < 0) return 0;
    return Math.round(diffMs / (1000 * 60));
  } catch {
    return null;
  }
}

async function syncBackup() {
  console.log('🔍 スプレッドシートの既存データを取得中 (A1:AZ5000)...');
  const res = await sheetsLayer.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '受注管理!A1:AZ5000',
  });
  const rows = res.data.values || [];
  console.log(`📊 スプレッドシートの現在の行数: ${rows.length} 行 (ヘッダー含む)`);

  const headers = rows[0] || [];
  console.log('📋 スプレッドシート全ヘッダー一覧:');
  headers.forEach((h, idx) => {
    const colLetter = String.fromCharCode(65 + (idx % 26));
    const prefix = idx >= 26 ? String.fromCharCode(65 + Math.floor(idx / 26) - 1) : '';
    console.log(`  [${prefix}${colLetter} (idx:${idx})] "${h}"`);
  });

  let sysIdColIdx = 1; // Column B: SystemID
  let durationColIdx = -1;
  let startTravelColIdx = -1;
  let arrivalColIdx = -1;
  let startWorkColIdx = -1;
  let finishWorkColIdx = -1;

  headers.forEach((h, idx) => {
    const headerStr = String(h).trim();
    if (headerStr === 'SystemID') sysIdColIdx = idx;
    if (headerStr === '所要時間' || headerStr === '作業所要時間' || headerStr === '作業時間（分）' || headerStr === '作業時間(分)') durationColIdx = idx;
    if (headerStr === '移動開始') startTravelColIdx = idx;
    if (headerStr === '現場到着') arrivalColIdx = idx;
    if (headerStr === '作業開始' || headerStr === '実績開始') startWorkColIdx = idx;
    if (headerStr === '作業完了' || headerStr === '実績完了' || headerStr === '実績終了') finishWorkColIdx = idx;
  });

  console.log(`  - SystemID 列インデックス: ${sysIdColIdx}`);
  console.log(`  - 所要時間 列インデックス: ${durationColIdx} (${durationColIdx !== -1 ? headers[durationColIdx] : '未検出'})`);
  console.log(`  - 現場到着 列インデックス: ${arrivalColIdx}`);
  console.log(`  - 作業開始 列インデックス: ${startWorkColIdx}`);
  console.log(`  - 作業完了 列インデックス: ${finishWorkColIdx}`);

  // Create mapping of SystemID to row info
  const systemIdToRowMap = new Map();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const sysId = row[sysIdColIdx] ? String(row[sysIdColIdx]).trim() : '';
    if (sysId) {
      systemIdToRowMap.set(sysId, {
        rowIndex: i + 1,
        existingDuration: durationColIdx !== -1 ? row[durationColIdx] : '',
        arrival: arrivalColIdx !== -1 ? row[arrivalColIdx] : '',
        startWork: startWorkColIdx !== -1 ? row[startWorkColIdx] : '',
        finishWork: finishWorkColIdx !== -1 ? row[finishWorkColIdx] : '',
      });
    }
  }
  console.log(`📊 スプレッドシート上のユニークSystemID件数: ${systemIdToRowMap.size} 件`);

  console.log('📡 Firestore から全 orders を取得中...');
  const snapshot = await db.collection('orders').get();
  console.log(`📊 Firestore 総ドキュメント数: ${snapshot.size} 件`);

  let firestoreUpdatedCount = 0;
  let calculatedDurationCount = 0;
  const sheetDurationUpdates = [];

  const firestoreBatchSize = 400;
  let currentBatch = db.batch();
  let batchOpCount = 0;

  for (const docSnap of snapshot.docs) {
    const d = docSnap.data();
    const docId = docSnap.id;
    const sysId = d.systemId || docId;

    const startWork = d.actualStartTime || d['作業開始'] || d.startWork;
    const arrival = d.arrivalTimestamp || d['現場到着'] || d.arrival;
    const finishWork = d.actualEndTime || d['作業完了'] || d.completeWork;

    const sheetData = systemIdToRowMap.get(sysId);
    const finalStart = startWork || sheetData?.startWork;
    const finalArrival = arrival || sheetData?.arrival;
    const finalFinish = finishWork || sheetData?.finishWork;

    let computedDuration = d.workDuration !== undefined && d.workDuration !== null && d.workDuration !== ''
      ? Number(d.workDuration)
      : calculateWorkDurationMinutes(finalStart, finalArrival, finalFinish);

    if ((computedDuration === null || isNaN(computedDuration)) && sheetData?.existingDuration) {
      const parsedSheet = parseInt(String(sheetData.existingDuration), 10);
      if (!isNaN(parsedSheet) && parsedSheet > 0) {
        computedDuration = parsedSheet;
      }
    }

    if (computedDuration !== null && !isNaN(computedDuration) && computedDuration >= 0) {
      calculatedDurationCount++;

      // 1. Update Firestore if not already set or different
      if (d.workDuration !== computedDuration || d.actualDuration !== computedDuration) {
        currentBatch.update(docSnap.ref, {
          workDuration: computedDuration,
          actualDuration: computedDuration,
        });
        batchOpCount++;
        firestoreUpdatedCount++;

        if (batchOpCount >= firestoreBatchSize) {
          await currentBatch.commit();
          currentBatch = db.batch();
          batchOpCount = 0;
          console.log(`  💾 Firestore バッチ保存中: ${firestoreUpdatedCount} 件完了...`);
        }
      }

      // 2. Prepare Sheet duration update
      if (sheetData && durationColIdx !== -1) {
        const h = Math.floor(computedDuration / 60);
        const m = computedDuration % 60;
        const formattedHmm = `${h}:${String(m).padStart(2, '0')}`;

        const currentVal = sheetData.existingDuration !== undefined && sheetData.existingDuration !== null ? String(sheetData.existingDuration).trim() : '';
        if (currentVal !== formattedHmm && currentVal !== `${formattedHmm}:00`) {
          if (sheetDurationUpdates.length < 5) {
            console.log(`  [差分検出] 行:${sheetData.rowIndex} SystemID:${sysId} 現在シート値:"${currentVal}" -> 新値:"${formattedHmm}"`);
          }
          const colLetter = String.fromCharCode(65 + (durationColIdx % 26));
          const prefix = durationColIdx >= 26 ? String.fromCharCode(65 + Math.floor(durationColIdx / 26) - 1) : '';
          const cell = `${prefix}${colLetter}${sheetData.rowIndex}`;
          sheetDurationUpdates.push({
            range: `受注管理!${cell}`,
            values: [[formattedHmm]],
          });
        }
      }
    }
  }

  if (batchOpCount > 0) {
    await currentBatch.commit();
    console.log(`  💾 Firestore 最終バッチ保存完了: 計 ${firestoreUpdatedCount} 件更新`);
  }

  console.log(`\n📈 集計結果:`);
  console.log(`  - 所要時間を計算できた件数: ${calculatedDurationCount} 件`);
  console.log(`  - Firestore に新しく書き込み/更新した件数: ${firestoreUpdatedCount} 件`);
  console.log(`  - スプレッドシートの所要時間セル更新対象: ${sheetDurationUpdates.length} 件`);

  // Update Spreadsheet in batches
  if (sheetDurationUpdates.length > 0) {
    console.log(`\n🚀 スプレッドシート（AP列：作業所要時間）への一括反映中 (${sheetDurationUpdates.length} 箇所)...`);
    const BATCH_SIZE = 100;
    for (let i = 0; i < sheetDurationUpdates.length; i += BATCH_SIZE) {
      const chunk = sheetDurationUpdates.slice(i, i + BATCH_SIZE);
      await sheetsLayer.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: chunk,
        },
      });
      console.log(`   ✅ ${Math.min(i + BATCH_SIZE, sheetDurationUpdates.length)} / ${sheetDurationUpdates.length} セル 更新完了`);
    }
    console.log(`🎉 スプレッドシートへの所要時間バックアップ更新が完了しました！`);
  } else {
    console.log(`✨ スプレッドシート側の所要時間列は既に最新です！`);
  }
}

syncBackup().catch(console.error);

