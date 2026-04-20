#!/usr/bin/env node
/**
 * スプレッドシート（GAS）から全受注データ・汎用タスクを抽出し、Firestoreへ移行するスクリプト
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

// --- Configuration ---
const PROJECT_ID = 'workwise-general-v2-kp';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxtBAAbHfVaAA0GS48QOsVlzlCupeGHPNGlO5rLOsS4IHM49nNrJRnj7Pd6f0bPpOaK/exec';

// --- Initialize Firebase Admin ---
const __dirname = decodeURIComponent(new URL('.', import.meta.url).pathname);
const serviceAccountPath = join(__dirname, '..', 'service-account.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

const app = initializeApp({
  projectId: PROJECT_ID,
  credential: cert(serviceAccount),
});

const db = getFirestore(app);

async function fetchFromGAS(date, range) {
  const url = `${GAS_URL}?date=${date}&range=${range}`;
  console.log(`📡 GAS からデータを取得中 (基準日: ${date}, 範囲: ${range}日)...`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    redirect: 'follow',
  });
  
  if (!response.ok) {
    throw new Error(`GAS request failed: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

async function migrate() {
  console.log('🚀 全データ移行プロセスを開始します...');

  // 1. スタッフマスターのキャッシュ（名前からIDを引きくため）
  console.log('👥 スタッフマスターをキャッシュ中...');
  const staffSnapshot = await db.collection('users').where('_type', '==', 'staff').get();
  const staffMap = new Map(); // name -> id
  staffSnapshot.forEach(doc => {
    const data = doc.data();
    staffMap.set(data.name, doc.id);
  });
  console.log(`   ${staffMap.size} 名のスタッフをキャッシュしました。`);

  // 2. GASからデータを取得
  // 3650日前から3650日後まで（約10年分）を指定して事実上全てのデータを取得
  const today = new Date().toISOString().split('T')[0];
  const data = await fetchFromGAS(today, 3650);
  
  if (data.status !== 'success') {
    throw new Error(`GAS API エラー: ${data.message}`);
  }

  const allRecords = data.orders || [];
  console.log(`📦 合計 ${allRecords.length} 件のレコードを処理します。`);

  let successCount = 0;
  let errorCount = 0;
  let maxDisplayId = 0;

  // バッチ処理（500件ずつ）
  const BATCH_SIZE = 450;
  for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = allRecords.slice(i, i + BATCH_SIZE);

    chunk.forEach(record => {
      try {
        const _type = record._type || 'order';
        const docId = record.SystemID || record.id || record.ID || `migrated_${Math.random().toString(36).substr(2, 9)}`;
        const docRef = db.collection('orders').doc(String(docId));

        // データのマッピング
        const mappedData = {
          id: String(docId),
          _type: _type,
          systemId: record.SystemID || record.id || '',
          displayId: record['受注 No'] || record['受注ID'] || record['受注 ID'] || '',
          customerCode: record['顧客コード'] || record['ユーザーコード'] || '',
          customerName: record['店舗名'] || record['お取引先名'] || record['店舗'] || '',
          address: record['住所'] || '',
          taskDetails: record['作業内容'] || record['業務内容'] || '',
          serviceType: record['作業'] || '',
          status: record['受注ステータス'] || record['入庫状況'] || record.status || '未割当',
          scheduledDate: record['作業予定日'] || record['予定日'] || '',
          scheduledTime: record['予定時間'] || record['チップ配置作業予定'] || record.scheduledTime || '',
          scheduledEndTime: record['チップ配置作業完了予定'] || record.scheduledEndTime || '',
          staffName: record['担当'] || record['スタッフ名'] || '',
          staffId: staffMap.get(record['担当'] || record['スタッフ名']) || '',
          equipmentStatus: record['機材有無'] || '',
          tireNumber: record['タイヤ品番'] || '',
          tireSize: record['タイヤサイズ'] || '',
          carName: record['車名'] || '',
          regNo: record['登録ナンバー\n(下４桁)'] || record['登録ナンバー'] || '',
          comment: record['任意コメント\n(ﾘﾏｰｸ2　10ｹﾀ)'] || record['緊急連絡'] || record['任意コメント'] || '',
          specialNotes: record['特記事項'] || '',
          arrivalStatus: record['入庫状況'] || '',
          productName: record['品名'] || '',
          quantity: record['本数'] || '',
          sensor: record['空気圧センサー\nパッキン交換'] || record['空気圧センサー'] || record['センサー'] || '',
          arrangement: record['タイヤ手配状況'] || record['手配'] || '',
          disposal: record['廃タイヤ処分'] || record['廃タイヤ'] || '',
          picName: record['ご担当者様'] || record['担当者名'] || '',
          orderNo: record['受注 No'] || record['受注ID'] || record['注文番号'] || '',
          contact: record['連絡者名'] || record['連絡先'] || record['連絡者'] || '',
          submitter: record['フォーム入力者'] || '',
          isEmergency: record['緊急フラグ'] === 'true' || record['緊急フラグ'] === true,
          adminReply: record['管理者返信'] || '',
          isConfirmed: !!record['既読確認'] || !!record['既読'],
          confirmedAt: record['既読確認'] || record['既読'] || '',
          
          actualStartTime: record['作業開始'] || record['実績開始'] || '',
          actualEndTime: record['作業完了'] || record['実績完了'] || '',
          startTravelTime: record['移動開始'] || '',
          arrivalTimestamp: record['現場到着'] || '',
          
          updatedAt: new Date().toISOString(),
          _migratedAt: new Date().toISOString(),
          raw: record
        };

        // 数値IDの最大値を追跡
        const numericId = parseInt(mappedData.displayId);
        if (!isNaN(numericId) && numericId > maxDisplayId) {
          maxDisplayId = numericId;
        }

        batch.set(docRef, mappedData, { merge: true });
        successCount++;
      } catch (err) {
        console.error(`❌ レコード処理エラー:`, err);
        errorCount++;
      }
    });

    await batch.commit();
    console.log(`   バッチ完了: ${i + chunk.length} / ${allRecords.length}`);
  }

  // 3. カウンターの更新
  if (maxDisplayId > 0) {
    console.log(`🔢 受注IDの最大値 ${maxDisplayId} をカウンターに設定します。`);
    await db.collection('counters').doc('orders').set({ lastId: maxDisplayId }, { merge: true });
  }

  console.log(`\n✨ 移行完了！`);
  console.log(`   成功: ${successCount} 件`);
  console.log(`   失敗: ${errorCount} 件`);
  console.log(`   最新受注ID: ${maxDisplayId}`);
}

migrate().catch(err => {
  console.error('🔥 致命的なエラー:', err);
  process.exit(1);
});
