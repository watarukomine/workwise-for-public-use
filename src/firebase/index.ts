'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  // Debug toggle: Use a named app in development to decouple from default instance
  // and ensure our custom Firestore settings (experimentalForceLongPolling) are applied.
  if (process.env.NODE_ENV === 'development') {
    const devAppName = 'WorkWiseDevClient_v3';
    try {
      // If the named app already exists, use it.
      // This app instance should already have Firestore initialized with our custom settings
      // from the very first time it was created.
      const devApp = getApp(devAppName);
      console.log(`[Firebase] Using existing development app: ${devAppName}`);
      return getSdks(devApp);
    } catch (e) {
      // Named app not found, create it.
      // This is the clean slate we need to ensure initializeFirestore works.
      console.log(`[Firebase] Initializing NEW development app: ${devAppName}`);
      const devApp = initializeApp(firebaseConfig, devAppName);
      return getSdks(devApp);
    }
  }

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

    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App
  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  const region = 'asia-northeast1';

  // Initialize Firestore with settings to bypass corporate firewalls
  let firestore;
  try {
    // Attempt to initialize with Long Polling
    firestore = initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
      localCache: memoryLocalCache(),
      // @ts-ignore
      useFetchStreams: false,
    });
    console.log('[Firestore] Successfully initialized with experimentalForceLongPolling: true');
  } catch (e: any) {
    if (e.code === 'failed-precondition') {
      console.log('[Firestore] Already initialized. Using existing instance. (Assuming Long Polling was set on first init)');
    } else {
      console.warn('[Firestore] Initialization warning:', e);
    }
    // If already initialized, get the existing instance
    firestore = getFirestore(firebaseApp);
  }

  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore,
    functions: getFunctions(firebaseApp, region),
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
