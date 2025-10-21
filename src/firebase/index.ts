'use client';

import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

// Barrel exports
export * from './provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './errors';
export * from './error-emitter';
export { useUser } from './auth/use-user';


// --- Centralized Firebase Initialization ---

let firebaseApp: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

/**
 * Returns the singleton instances of Firebase services.
 * This function ensures that Firebase is initialized only once.
 */
export const getFirebase = () => {
  if (!firebaseApp) {
    if (!getApps().length) {
      firebaseApp = initializeApp(firebaseConfig);
    } else {
      firebaseApp = getApp();
    }
    auth = getAuth(firebaseApp);
    firestore = getFirestore(firebaseApp);
  }
  return { firebaseApp, auth, firestore };
};
