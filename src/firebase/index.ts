'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

function getSdks(firebaseApp: FirebaseApp) {
  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);

  // NOTE: Emulator connection should only be used in non-production environments.
  // In a real app, you would guard this with `if (process.env.NODE_ENV !== 'production')`
  // For this context, we assume it might be used for local development.
  // connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  // connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  
  return {
    firebaseApp,
    auth,
    firestore,
  };
}

// IMPORTANT: This is the recommended way to initialize Firebase.
// It's idempotent and safe to call multiple times.
export function initializeFirebase() {
  if (getApps().length > 0) {
    const app = getApp();
    return getSdks(app);
  }

  // This is the standard initialization using the config object.
  // It's the most reliable way when App Hosting env vars might not be available or synced.
  const app = initializeApp(firebaseConfig);
  console.log("Firebase initialized with provided config.");
  return getSdks(app);
}

// Re-exporting hooks and providers
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
// Note: non-blocking-login is not used but kept for potential future use.
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
