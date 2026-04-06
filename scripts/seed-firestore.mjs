#!/usr/bin/env node
/**
 * スプレッドシートのデータをFirestoreにシード（投入）するスクリプト
 * 
 * 使い方:
 *   node scripts/seed-firestore.mjs
 * 
 * 前提条件:
 *   - Firebase Admin SDK がインストール済み (npm install firebase-admin)
 *   - 環境変数 GOOGLE_APPLICATION_CREDENTIALS にサービスアカウントキーのパスを設定
 *     または、gcloud CLI でログイン済み
 */

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// --- Configuration ---
const PROJECT_ID = 'workwise-general-v2-kp';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxtBAAbHfVaAA0GS48QOsVlzlCupeGHPNGlO5rLOsS4IHM49nNrJRnj7Pd6f0bPpOaK/exec';

// Collections to seed
const COLLECTIONS = {
  staff: { action: 'getStaffList', firestoreCollection: 'users' },
  customers: { action: 'getCustomerList', firestoreCollection: 'customers' },
  orders: { action: 'getOrderData', firestoreCollection: 'orders' },
};

// --- Initialize Firebase Admin ---
let app;
try {
  app = initializeApp({
    projectId: PROJECT_ID,
    credential: applicationDefault(),
  });
} catch (e) {
  console.error('Firebase Admin initialization failed. Make sure you have valid credentials.');
  console.error('Run: gcloud auth application-default login');
  console.error('Or set GOOGLE_APPLICATION_CREDENTIALS env var to a service account key file.');
  process.exit(1);
}

const db = getFirestore(app);

// --- Helper Functions ---
async function fetchFromGAS(action) {
  const url = `${GAS_URL}?action=${action}`;
  console.log(`\n📡 GAS からデータを取得中: ${action}...`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    redirect: 'follow',
  });
  
  if (!response.ok) {
    throw new Error(`GAS request failed: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`GAS error: ${data.error}`);
  }
  
  // GAS returns data in various formats, try to extract the array
  let records = [];
  
  // Prioritize action-based keys to avoid accidental pollution
  if (action === 'getStaffList' && Array.isArray(data.staffList)) {
    records = data.staffList;
  } else if (action === 'getCustomerList' && Array.isArray(data.customerList)) {
    records = data.customerList;
  } else if (action === 'getOrderData' && Array.isArray(data.orders)) {
    records = data.orders;
  } else if (Array.isArray(data)) {
    records = data;
  } else if (data.data && Array.isArray(data.data)) {
    records = data.data;
  } else if (data.result && Array.isArray(data.result)) {
    records = data.result;
  } else {
    // Try to find any array in the response
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) {
        // Safety check: if we are looking for staff but find something that looks like orders, skip it
        if (action === 'getStaffList' && key.toLowerCase().includes('order')) continue;
        
        records = data[key];
        console.log(`  → データキー "${key}" から ${records.length} 件を検出`);
        break;
      }
    }
  }
  
  console.log(`  ✅ ${records.length} 件のレコードを取得`);
  return records;
}

function generateDocId(record, collectionType) {
  if (collectionType === 'staff') {
    return record.id || record.staffId || record['スタッフID'] || null;
  }
  if (collectionType === 'customers') {
    const code = record['ユーザーコード'] || record.userCode || record.id;
    return code ? String(code) : null;
  }
  if (collectionType === 'orders') {
    const sysId = record.SystemID || record.systemId || record['受注 ID'] || record['受注ID'] || record.id;
    return sysId ? String(sysId) : null;
  }
  return null;
}

function cleanRecord(record) {
  // Remove undefined values and convert dates
  const cleaned = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    if (value === null) continue;
    // Keep empty strings to preserve column structure
    cleaned[key] = value;
  }
  return cleaned;
}

// Cache existing admins for protection
const existingAdmins = new Set();

async function cacheAdmins() {
  console.log('🛡️ 既存の管理者（Admin）リストを保護用に取得中...');
  const adminSnapshot = await db.collection('users').where('role', '==', 'admin').get();
  adminSnapshot.docs.forEach(doc => {
    existingAdmins.add(doc.id);
    const email = doc.data().email;
    if (email) existingAdmins.add(email.toLowerCase());
  });
  console.log(`  ✅ ${adminSnapshot.size} 名の管理者を保護対象として認識しました。`);
}

async function seedCollection(collectionType) {
  const config = COLLECTIONS[collectionType];
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 コレクション: ${config.firestoreCollection}`);
  console.log(`${'='.repeat(60)}`);
  
  // Initialize admin cache if seeding staff (users)
  if (collectionType === 'staff' && existingAdmins.size === 0) {
    await cacheAdmins();
  }

  let records;
  try {
    records = await fetchFromGAS(config.action);
  } catch (e) {
    console.error(`  ❌ GAS取得エラー: ${e.message}`);
    return { success: 0, failed: 0, skipped: 0 };
  }
  
  if (records.length === 0) {
    console.log('  ⚠️ データがありません。スキップします。');
    return { success: 0, failed: 0, skipped: 0 };
  }
  
  // Show sample record structure
  console.log(`\n  📋 サンプルレコードのフィールド:`);
  const sampleKeys = Object.keys(records[0]);
  console.log(`  ${sampleKeys.join(', ')}`);
  
  let success = 0;
  let failed = 0;
  let skipped = 0;
  
  // Use batched writes for efficiency (max 500 per batch)
  const BATCH_SIZE = 450;
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const slice = records.slice(i, i + BATCH_SIZE);
    
    for (const record of slice) {
      const docId = generateDocId(record, collectionType);
      
      if (!docId) {
        // Auto-generate ID
        const docRef = db.collection(config.firestoreCollection).doc();
        const cleaned = cleanRecord(record);
        cleaned._importedAt = new Date().toISOString();
        cleaned._source = 'spreadsheet-seed';
        batch.set(docRef, cleaned, { merge: true });
        success++;
        continue;
      }
      
      try {
        const docRef = db.collection(config.firestoreCollection).doc(docId);
        const cleaned = cleanRecord(record);
        
        // --- Add Protection and Metadata ---
        if (collectionType === 'staff') {
            cleaned._type = 'staff';
            
            // Protect existing admins from accidental downgrade
            if (existingAdmins.has(docId) || (cleaned.email && existingAdmins.has(cleaned.email.toLowerCase()))) {
                console.log(`  🛡️ ${docId}: 管理者権限を維持します。`);
                cleaned.role = 'admin';
            }
        } else if (collectionType === 'customers') {
            cleaned._type = 'customer';
        } else if (collectionType === 'orders') {
            cleaned._type = 'order';
        }
        
        cleaned._importedAt = new Date().toISOString();
        cleaned._source = 'spreadsheet-seed';
        batch.set(docRef, cleaned, { merge: true });
        success++;
      } catch (e) {
        console.error(`  ❌ ${docId}: ${e.message}`);
        failed++;
      }
    }
    
    try {
      await batch.commit();
      console.log(`  ✍️ バッチ ${Math.floor(i / BATCH_SIZE) + 1}: ${slice.length} 件を書き込み`);
    } catch (e) {
      console.error(`  ❌ バッチ書き込みエラー: ${e.message}`);
      failed += slice.length;
      success -= slice.length;
    }
  }
  
  console.log(`\n  📊 結果: ✅ ${success} 件成功, ❌ ${failed} 件失敗, ⏭ ${skipped} 件スキップ`);
  return { success, failed, skipped };
}

// --- Main ---
async function main() {
  const target = process.argv[2]; // e.g. 'staff', 'customers', 'orders'
  
  console.log('🚀 スプレッドシート → Firestore データシードを開始します');
  console.log(`📌 プロジェクト: ${PROJECT_ID}`);
  console.log(`📡 GAS URL: ${GAS_URL.substring(0, 60)}...`);
  
  const results = {};
  const collectionsToSeed = target ? [target] : Object.keys(COLLECTIONS);
  
  for (const collectionType of collectionsToSeed) {
    if (!COLLECTIONS[collectionType]) {
      console.error(`  ❌ 不明なターゲット: ${collectionType}`);
      continue;
    }
    results[collectionType] = await seedCollection(collectionType);
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 最終結果サマリー');
  console.log(`${'='.repeat(60)}`);
  for (const [type, result] of Object.entries(results)) {
    console.log(`  ${type}: ✅ ${result.success} 成功 | ❌ ${result.failed} 失敗`);
  }
  console.log('\n✨ シード処理が完了しました！');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
