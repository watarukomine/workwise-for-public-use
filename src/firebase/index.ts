
'use client';

// This file's functionality is largely disabled for the simplified mock auth flow.
// It is kept to avoid breaking imports across the application.
// The core logic now resides in `src/lib/auth.ts` and contexts.

export function initializeFirebase() {
  // This function no longer initializes Firebase.
  // Returns mock objects to satisfy downstream dependencies.
  console.log("Firebase initialization is mocked.");
  return {
    firebaseApp: {},
    auth: {},
    firestore: {},
  };
}

export const getSdks = (app: any) => ({
  firebaseApp: app,
  auth: {},
  firestore: {},
});

// Exporting mock/dummy versions of functions and hooks
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './errors';
export * from './error-emitter';

// Mock non-blocking updates if they are imported elsewhere
export const setDocumentNonBlocking = () => console.warn('setDocumentNonBlocking is mocked.');
export const addDocumentNonBlocking = () => console.warn('addDocumentNonBlocking is mocked.');
export const updateDocumentNonBlocking = () => console.warn('updateDocumentNonBlocking is mocked.');
export const deleteDocumentNonBlocking = () => console.warn('deleteDocumentNonBlocking is mocked.');

// Mock non-blocking login if they are imported elsewhere
export const initiateAnonymousSignIn = () => console.warn('initiateAnonymousSignIn is mocked.');
export const initiateEmailSignUp = () => console.warn('initiateEmailSignUp is mocked.');
export const initiateEmailSignIn = () => console.warn('initiateEmailSignIn is mocked.');
