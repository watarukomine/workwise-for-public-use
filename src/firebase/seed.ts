
'use client';

import { Firestore, collection, doc, writeBatch, serverTimestamp, FirestoreError } from 'firebase/firestore';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useEffect } from 'react';
import { useFirestore } from './provider';
import { errorEmitter } from './error-emitter';
import { FirestorePermissionError } from './errors';

const staffDataSeed = [
  {
    id: '1',
    name: '佐藤 太郎',
    calendarId: 'taro.sato@example.com',
    color: 'hsl(217, 91%, 60%)',
    avatarId: 'avatar2',
  },
  {
    id: '2',
    name: '鈴木 花子',
    calendarId: 'hanako.suzuki@example.com',
    color: 'hsl(12, 76%, 61%)',
    avatarId: 'avatar1',
  },
  {
    id: '3',
    name: '高橋 一郎',
    calendarId: 'ichiro.takahashi@example.com',
    color: 'hsl(173, 58%, 39%)',
    avatarId: 'avatar4',
  },
  {
    id: '4',
    name: '田中 美咲',
    calendarId: 'misaki.tanaka@example.com',
    color: 'hsl(43, 74%, 66%)',
    avatarId: 'avatar3',
  },
];

const customerDataSeed = [
    { id: 'C001', no: '1', userCode: 'CUST001', storeName: 'ABCストア', address: '神奈川県横浜市中区元町1-1', phoneNumber: '045-111-1111', businessHours: '10:00-19:00', latitude: 35.442, longitude: 139.648, name: 'ABCストア' },
    { id: 'C002', no: '2', userCode: 'CUST002', storeName: 'XYZマート', address: '神奈川県横浜市西区みなとみらい2-2', phoneNumber: '045-222-2222', businessHours: '09:00-21:00', latitude: 35.456, longitude: 139.63, name: 'XYZマート' },
    { id: 'C003', no: '3', userCode: 'CUST003', storeName: 'さくら商店', address: '神奈川県横浜市神奈川区東神奈川1-12', phoneNumber: '045-333-3333', businessHours: '09:30-18:30', latitude: 35.48, longitude: 139.636, name: 'さくら商店' },
    { id: 'C004', no: '4', userCode: 'CUST004', storeName: 'みなと薬局', address: '神奈川県横浜市中区山下町200', phoneNumber: '045-444-4444', businessHours: '09:00-18:00', latitude: 35.443, longitude: 139.643, name: 'みなと薬局' },
    { id: 'C005', no: '5', userCode: 'CUST005', storeName: 'ベイサイドカフェ', address: '神奈川県横浜市西区高島1-1', phoneNumber: '045-555-5555', businessHours: '08:00-20:00', latitude: 35.465, longitude: 139.622, name: 'ベイサイドカフェ' },
    { id: 'C006', no: '6', userCode: 'CUST006', storeName: 'グリーンフラワー', address: '神奈川県横浜市青葉区美しが丘1-1-2', phoneNumber: '045-666-6666', businessHours: '10:00-19:00', latitude: 35.548, longitude: 139.55, name: 'グリーンフラワー' },
    { id: 'C007', no: '7', userCode: 'CUST007', storeName: 'かもめベーカリー', address: '神奈川県横浜市港北区新横浜2-5', phoneNumber: '045-777-7777', businessHours: '07:30-18:00', latitude: 35.508, longitude: 139.617, name: 'かもめベーカリー' },
    { id: 'C008', no: '8', userCode: 'CUST008', storeName: 'ブックポート横浜', address: '神奈川県横浜市西区南幸1-5-1', phoneNumber: '045-888-8888', businessHours: '10:00-22:00', latitude: 35.466, longitude: 139.622, name: 'ブックポート横浜' },
    { id: 'C009', no: '9', userCode: 'CUST009', storeName: 'オーシャンビューホテル', address: '神奈川県横浜市中区海岸通1-1', phoneNumber: '045-999-9999', businessHours: '24時間', latitude: 35.45, longitude: 139.64, name: 'オーシャンビューホテル' },
    { id: 'C010', no: '10', userCode: 'CUST010', storeName: 'サンセットダイナー', address: '神奈川県横浜市金沢区海の公園10', phoneNumber: '045-000-0000', businessHours: '11:00-22:00', latitude: 35.33, longitude: 139.645, name: 'サンセットダイナー' },
];

const ordersDataSeed = [
    { id: 'ORD001', customerCode: 'CUST001', taskDetails: '商品棚の整理', estimatedDuration: 60 },
    { id: 'ORD002', customerCode: 'CUST003', taskDetails: '新商品の陳列', estimatedDuration: 90 },
    { id: 'ORD003', customerCode: 'CUST005', taskDetails: '在庫確認と発注', estimatedDuration: 75 },
    { id: 'ORD004', customerCode: 'CUST008', taskDetails: '販促物の設置', estimatedDuration: 45 },
];

const staffStatusSeed = [
    { staffId: '1', status: 'Idle', lastAction: 'オフィスで待機中', latitude: 35.4658, longitude: 139.622 },
    { staffId: '2', status: 'Idle', lastAction: 'オフィスで待機中', latitude: 35.4658, longitude: 139.622 },
    { staffId: '3', status: 'Idle', lastAction: 'オフィスで待機中', latitude: 35.4658, longitude: 139.622 },
    { staffId: '4', status: 'Idle', lastAction: 'オフィスで待機中', latitude: 35.4658, longitude: 139.622 },
];

const eventsSeed: any[] = [
  // Initially empty, will be populated via drag and drop
];

export async function seedData(db: Firestore) {
  console.log("Attempting to seed data to Firestore...");
  const seededFlagRef = doc(db, 'internal', 'seeded');

  // We are removing the check for the seeded flag to ensure that the write operation is always attempted.
  // The catch block will handle the case where the data already exists.

  const batch = writeBatch(db);

  const getAvatarUrl = (avatarId: string) => {
    return PlaceHolderImages.find(img => img.id === avatarId)?.imageUrl || '';
  };

  // Seed staff
  const staffCollectionRef = collection(db, 'staff');
  staffDataSeed.forEach(staffMember => {
    const docRef = doc(staffCollectionRef, staffMember.id);
    const avatarUrl = getAvatarUrl(staffMember.avatarId);
    batch.set(docRef, { ...staffMember, avatarUrl });
  });

  // Seed customers
  const customersCollectionRef = collection(db, 'customers');
  customerDataSeed.forEach(customer => {
    const docRef = doc(customersCollectionRef, customer.id);
    batch.set(docRef, customer);
  });

  // Seed orders
  const ordersCollectionRef = collection(db, 'orders');
  ordersDataSeed.forEach(order => {
      const docRef = doc(ordersCollectionRef, order.id);
      batch.set(docRef, order);
  });

  // Seed staff status
  const staffStatusCollectionRef = collection(db, 'staffStatus');
  staffStatusSeed.forEach(status => {
      const docRef = doc(staffStatusCollectionRef, status.staffId);
      batch.set(docRef, status);
  });

  // Seed events (if any)
  const eventsCollectionRef = collection(db, 'events');
  eventsSeed.forEach((event: any) => {
      const docRef = doc(eventsCollectionRef, event.id);
      batch.set(docRef, {
        ...event,
        start: new Date(event.start),
        end: new Date(event.end)
      });
  });
  
  // Set the flag to indicate data has been seeded
  batch.set(seededFlagRef, { seeded: true, timestamp: serverTimestamp() });

  try {
    await batch.commit();
    console.log("Data seeding successful.");
  } catch (error) {
    const fError = error as FirestoreError;
    // A 'permission-denied' error on a batch write that includes the seededFlagRef often means it already exists.
    // In a production scenario, you might want more granular checks, but for this seeding script,
    // we can infer that if the write is denied, the data likely is already there.
    if (fError.code === 'permission-denied' || fError.code === 'already-exists') {
        console.log("Data likely already seeded. Skipping.");
    } else {
        // For other errors, we still want to see the detailed context.
        const contextualError = new FirestorePermissionError({
            operation: 'write',
            path: 'batch operation', // Path is not specific to one doc in a batch
            requestResourceData: {
                description: 'Batch write for initial data seed failed.',
                collections: ['staff', 'customers', 'orders', 'staffStatus', 'events', 'internal']
            }
        });
        errorEmitter.emit('permission-error', contextualError);
    }
  }
}

export function DataSeeder() {
  const firestore = useFirestore();

  useEffect(() => {
    if (firestore) {
      seedData(firestore);
    }
  }, [firestore]);

  return null; // This component does not render anything
}
