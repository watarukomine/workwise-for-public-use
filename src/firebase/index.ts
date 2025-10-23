
// This file is part of the disabled Firebase functionality.
// It is kept for potential future re-integration.
'use client';

export const useUser = () => ({ user: null, isLoading: false, error: null });
export const useFirestore = () => null;
export const useAuth = () => null;
export const useFirebase = () => ({});
export const useMemoFirebase = <T>(factory: () => T) => factory();
export const useCollection = () => ({ data: null, isLoading: false, error: null });
export const useDoc = () => ({ data: null, isLoading: false, error: null });

/*
// Original implementation:

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore'

let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

// This function ensures Firebase is initialized only once.
export function initializeFirebase() {
    if (!getApps().length) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        firestore = getFirestore(app);
    } else {
        app = getApp();
        auth = getAuth(app);
        firestore = getFirestore(app);
    }
    return { firebaseApp: app, auth, firestore };
}

export function getSdks(firebaseApp: FirebaseApp) {
  const firestore = getFirestore(firebaseApp);
  const auth = getAuth(firebaseApp);
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
export * from './auth/use-user';
export * from './non-blocking-updates';
export * from './errors';
export * from './error-emitter';

*/
