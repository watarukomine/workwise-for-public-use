import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

const serviceAccountPath = join(process.cwd(), 'service-account.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

async function check() {
  const snapshot = await db.collection('orders').get();
  console.log(`Total documents in 'orders': ${snapshot.size}`);
  
  const todayOrders = [];
  snapshot.forEach(doc => {
    const d = doc.data();
    if (d._type === 'order' && d.scheduledDate && (d.scheduledDate.includes('2026-07-28') || d.scheduledDate.includes('2026/07/28'))) {
      todayOrders.push({ id: doc.id, ...d });
    }
  });

  console.log(`Today's orders count: ${todayOrders.length}`);
  todayOrders.forEach(o => {
    console.log(`- ID: ${o.id}, DisplayID: ${o.displayId}, Store: ${o.customerName || o.storeName}, Date: ${o.scheduledDate}, Time: ${o.scheduledTime}`);
  });
}

check().catch(console.error);
