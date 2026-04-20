#!/usr/bin/env node

/**
 * users コレクションのデータクリーニングスクリプト
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

// --- Initialization ---
const __dirname = decodeURIComponent(new URL('.', import.meta.url).pathname);
const serviceAccountPath = join(__dirname, '..', 'service-account.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function cleanup() {
  console.log('🚀 users コレクションのクリーニングを開始します...');

  const usersSnap = await db.collection('users').get();
  console.log(`📡 合計 ${usersSnap.size} 件のドキュメントをチェック中...`);

  let deleteCount = 0;
  let keepCount = 0;
  const batch = db.batch();

  usersSnap.forEach(doc => {
    const data = doc.data();
    const id = doc.id;

    // 削除対象の条件
    const isOrderPollution = data._type === 'order';
    const isTaskPollution = data._type === 'task';
    const isNamelessPollution = !data.name && !data.email && !data._type;

    // 保護対象（削除しない）の条件
    const isGenuineStaff = data._type === 'staff';
    const isAdmin = data.role && String(data.role).toLowerCase().includes('admin');
    const isKnownAdmin = id === 'watarukomine@gmail.com' || id === 'kanagawa.toyota.parts@gmail.com';

    if ((isOrderPollution || isTaskPollution || isNamelessPollution) && !isGenuineStaff && !isAdmin && !isKnownAdmin) {
      batch.delete(doc.ref);
      deleteCount++;
    } else {
      keepCount++;
    }
  });

  if (deleteCount > 0) {
    console.log(`🗑️ ${deleteCount} 件の不要なデータを削除します...`);
    await batch.commit();
    console.log('✅ 削除が完了しました。');
  } else {
    console.log('✨ 削除対象は見つかりませんでした。');
  }

  console.log('-----------------------------------');
  console.log(`保持したスタッフ数: ${keepCount}`);
  console.log(`削除したゴミデータ数: ${deleteCount}`);
  console.log('-----------------------------------');
}

cleanup().catch(err => console.error('❌ クリーニング中にエラーが発生しました:', err));
