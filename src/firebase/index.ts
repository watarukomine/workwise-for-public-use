'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const addSampleAdminUser = async (firestore: ReturnType<typeof getFirestore>) => {
    const adminId = 'admin-user-01';
    const adminDocRef = doc(firestore, 'staff', adminId);

    try {
        const docSnap = await getDoc(adminDocRef);
        if (!docSnap.exists()) {
            console.log('Creating sample admin user...');
            await setDoc(adminDocRef, {
                id: adminId,
                name: '管理者ユーザー',
                email: 'admin@example.com',
                photoURL: `https://picsum.photos/seed/${adminId}/100/100`,
                role: 'admin',
                color: 'hsl(262, 83%, 58%)',
                createdAt: serverTimestamp(),
            });
            console.log('Sample admin user created.');
        }
    } catch (error) {
        console.error("Error creating sample admin user:", error);
    }
};


// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (!getApps().length) {
    // Important! initializeApp() is called without any arguments because Firebase App Hosting
    // integrates with the initializeApp() function to provide the environment variables needed to
    // populate the FirebaseOptions in production. It is critical that we attempt to call initializeApp()
    // without arguments.
    let firebaseApp;
    try {
      // Attempt to initialize via Firebase App Hosting environment variables
      firebaseApp = initializeApp();
    } catch (e) {
      // Only warn in production because it's normal to use the firebaseConfig to initialize
      // during development
      if (process.env.NODE_ENV === "production") {
        console.warn('Automatic initialization failed. Falling back to firebase config object.', e);
      }
      firebaseApp = initializeApp(firebaseConfig);
    }
    
    const sdks = getSdks(firebaseApp);
    // Add sample data only in non-production environments
    if (process.env.NODE_ENV !== 'production') {
        addSampleAdminUser(sdks.firestore);
    }
    return sdks;
  }

  // If already initialized, return the SDKs with the already initialized App
  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';