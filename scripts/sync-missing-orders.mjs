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

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzbHRT6aSOzWl5XMO6znnEtOVFqsYpnuCKm3xolZWzyZGBxUo7qQm6dshn1P0kOpK5F/exec';

async function syncMissing() {
  const snapshot = await db.collection('orders').doc('20260728_20519_hzc').get();
  if (!snapshot.exists) {
    console.log('Target document not found');
    return;
  }

  const data = snapshot.data();
  console.log('Found order data:', data.systemId || snapshot.id, data.customerName || data.storeName);

  const payload = {
    action: 'createOrder',
    gasUrl: GAS_URL,
    systemId: data.systemId || snapshot.id,
    orderId: data.systemId || snapshot.id,
    displayId: data.displayId || '',
    userCode: data.customerCode || data.userCode || '',
    customerCode: data.customerCode || data.userCode || '',
    storeName: data.customerName || data.storeName || '',
    customerName: data.customerName || data.storeName || '',
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

  console.log('Sending to GAS API...');
  const response = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  console.log('GAS API Response:', response.status, text);
}

syncMissing().catch(console.error);
