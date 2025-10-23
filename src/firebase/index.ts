'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (getApps().length > 0) {
    return getSdks(getApp());
  }
  
  // App Hosting provides environment variables for Firebase config.
  // This is the recommended way to initialize Firebase on App Hosting.
  // It's important to call initializeApp() without arguments if possible.
  try {
    const app = initializeApp();
    console.log("Firebase initialized automatically via App Hosting env vars.");
    return getSdks(app);
  } catch (e) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "Automatic Firebase initialization failed, falling back to firebaseConfig. " +
        "This might indicate a problem with your App Hosting setup.", e
      );
    } else {
      console.log("Using local firebaseConfig for development.");
    }
    // Fallback for local development or if auto-init fails
    const app = initializeApp(firebaseConfig);
    return getSdks(app);
  }
}

export function getSdks(firebaseApp: FirebaseApp) {
  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);

  return {
    firebaseApp,
    auth,
    firestore,
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
