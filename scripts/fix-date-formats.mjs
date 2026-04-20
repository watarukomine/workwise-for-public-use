#!/usr/bin/env node

/**
 * scheduledDate フォーマット修正スクリプト
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

const __dirname = decodeURIComponent(new URL('.', import.meta.url).pathname);
const serviceAccountPath = join(__dirname, '..', 'service-account.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

function addHours(date, h) {
  date.setTime(date.getTime() + (h*60*60*1000));
  return date;
}

async function run() {
  console.log('🚀 scheduledDate のフォーマット修正を開始します...');
  const snapshot = await db.collection('orders').get();
  
  const updates = [];
  snapshot.forEach(doc => {
    let sd = doc.data().scheduledDate;
    if (sd && (sd.includes('Z') || sd.includes('T'))) {
      const d = new Date(sd);
      // JST (UTC+9)
      const jst = addHours(d, 9);
      const yyyy = jst.getUTCFullYear();
      const mm = String(jst.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(jst.getUTCDate()).padStart(2, '0');
      const slashFormat = `${yyyy}/${mm}/${dd}`;
      
      updates.push({ ref: doc.ref, data: { scheduledDate: slashFormat } });
    } else if (!sd && doc.data().開始日時) {
      // 古いタスク等で scheduledDate が無いケース（念の為補完）
      const d = new Date(doc.data().開始日時);
      const jst = addHours(d, 9);
      const slashFormat = `${jst.getUTCFullYear()}/${String(jst.getUTCMonth()+1).padStart(2,'0')}/${String(jst.getUTCDate()).padStart(2,'0')}`;
      updates.push({ ref: doc.ref, data: { scheduledDate: slashFormat } });
    }
  });
  
  console.log(`📡 修正が必要なレコード: ${updates.length} 件`);
  
  if (updates.length > 0) {
    const BATCH_SIZE = 490;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = updates.slice(i, i + BATCH_SIZE);
      chunk.forEach(u => batch.update(u.ref, u.data));
      await batch.commit();
      console.log(`   - ${i + chunk.length} / ${updates.length} 件を修正完了...`);
    }
    console.log('✅ すべてのフォーマット修正が完了しました！');
  } else {
    console.log('✨ 修正が必要なレコードはありませんでした。');
  }
}

run().catch(console.error);
