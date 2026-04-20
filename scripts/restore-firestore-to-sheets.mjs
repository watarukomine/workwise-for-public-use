#!/usr/bin/env node

/**
 * Firestore -> スプレッドシート データ復元スクリプト (オリジナル仕様完全準拠版)
 */

import { google } from 'googleapis';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

// --- Spreadsheet IDs ---
const SPREADSHEETS = {
  '受注管理': '1A3rbqD87QenOoHx3EYNpnqBujN5TrT2Xn_3tUTCiqmY',
  '販売店情報': '1IZ2VwJ1AT5NvEkUoU0tL6OJXXI3hfDVQ8_773HZwUJI',
  'スタッフマスタ': '1IP9wxp-VsctyXVn5UI3oRWeik4gMrFA5DFxt-40HGOk',
  '行動予定': '1IP9wxp-VsctyXVn5UI3oRWeik4gMrFA5DFxt-40HGOk' // ※行動予定はスタッフマスタと同じファイルにある前提
};

// --- Initialization ---
const __dirname = decodeURIComponent(new URL('.', import.meta.url).pathname);
const serviceAccountPath = join(__dirname, '..', 'service-account.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheetsLayer = google.sheets({ version: 'v4', auth });

async function restore() {
  console.log('🚀 スプレッドシート版のオリジナル仕様でデータ復元を開始します...');

  try {
    // 1. スタッフマスタ
    await restoreCollection('users', 'スタッフマスタ', d => d._type === 'staff', (d, id) => [
      id, d.name || '', d.email || '', d.role || '', d.department || '', d.controller || '', 
      d.isActive !== false ? 'TRUE' : 'FALSE', d.displayName || '', d.color || '', d.avatarUrl || '', d.description || d['自己紹介'] || ''
    ]);

    // 2. 販売店情報
    await restoreCollection('customers', '販売店情報', () => true, (d, id) => [
      d.userCode || d['ユーザーコード'] || id, d.storeName || d['店舗'] || '', d.address || d['住所'] || '', 
      d.phone || d['電話番号'] || '', d.latitude || '', d.longitude || '', d['営業時間'] || '', d.picName || '', ''
    ]);

    // Firestoreから一括取得し、OrderとTaskに振り分ける
    console.log('📡 orders コレクションを取得し、受注と行動予定を振り分け中...');
    const snapshot = await db.collection('orders').get();
    
    const orderRows = [];
    const taskRows = [];
    
    snapshot.forEach(doc => {
      const d = doc.data();
      const id = doc.id;
      
      if (d._type === 'order') {
        // --- 受注管理（オリジナル仕様のまま） ---
        orderRows.push([
          d.displayId || '', d.systemId || id, d.customerCode || '', d.customerName || '', d.mainStore || '',
          d.scheduledDate || '', d.scheduledTime || '', d.picName || '', d.staffName || '', d.status || '',
          d.tireNumber || '', d.tireSize || '', d.productName || '', d.quantity || '', d.sensor || '',
          d.arrangement || '', d.disposal || '', d.carName || '', d.regNo || '',
          d.contact || '', d.comment || '', d.specialNotes || '', d.isEmergency ? 'TRUE' : 'FALSE',
          d.adminReply || '', d.isConfirmed ? 'TRUE' : 'FALSE', formatTimestamp(d.updatedAt)
        ]);
      } else if (d._type === 'task') {
        // --- 行動予定（汎用タスク。オリジナル仕様） ---
        taskRows.push([
          d.id || id, 
          d.staffName || '', 
          d.taskDetails || d.業務内容 || '', 
          d.description || d.詳細 || '',
          d.scheduledDate ? `${d.scheduledDate} ${d.scheduledTime || '00:00'}` : (d.開始日時 || ''),
          d.scheduledDate ? `${d.scheduledDate} ${d.scheduledEndTime || '00:00'}` : (d.終了日時 || ''),
          formatTimestamp(d.createdAt || d.作成日時)
        ]);
      }
    });

    await writeToSheet('受注管理', orderRows);
    await writeToSheet('行動予定', taskRows);

    console.log('\n✨ 全てのデータ復元が完了しました！');
  } catch (err) {
    console.error('❌ 復元プロセスでエラーが発生しました:', err);
  }
}

async function restoreCollection(colName, sheetName, filterFn, mapperFn) {
  const snapshot = await db.collection(colName).get();
  const rows = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (filterFn(data)) rows.push(mapperFn(data, doc.id));
  });
  await writeToSheet(sheetName, rows);
}

async function writeToSheet(sheetName, rows) {
  const spreadsheetId = SPREADSHEETS[sheetName];
  if (!spreadsheetId) {
    console.warn(`⚠️ スプレッドシートIDが見つかりません: ${sheetName}`);
    return;
  }

  console.log(`   - シート「${sheetName}」に ${rows.length} 件書き込み中...`);
  
  // Clear existing
  await sheetsLayer.spreadsheets.values.clear({ spreadsheetId, range: `${sheetName}!A2:Z5000` });

  if (rows.length === 0) return;

  // Batch Write
  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await sheetsLayer.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A2`,
      valueInputOption: 'RAW',
      resource: { values: chunk }
    });
  }
  console.log(`   ✅ ${sheetName} の復元完了`);
}

function formatTimestamp(ts) {
  if (!ts) return '';
  if (ts.toDate) return ts.toDate().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  return String(ts);
}

restore();
