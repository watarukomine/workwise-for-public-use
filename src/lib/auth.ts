'use client';

import { 
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  type Auth,
  getAuth,
} from 'firebase/auth';
import { initializeFirebase } from '@/firebase';

const provider = new GoogleAuthProvider();

/**
 * Returns a fresh Auth instance.
 * Ensures that the most up-to-date Firebase app instance is used.
 */
export const getAuthInstance = (): Auth => {
  // initializeFirebase handles getting the existing app instance if already initialized.
  const { auth } = initializeFirebase();
  return auth;
};

export const signIn = async () => {
  const auth = getAuthInstance();
  try {
    console.log("Attempting to sign in with Google...");
    const result = await signInWithPopup(auth, provider);
    console.log("Sign-in successful:", result.user.uid);
  } catch (error: any) {
    if (error && error.code === 'auth/cancelled-popup-request') {
      console.log("Sign-in popup cancelled by user.");
      return;
    }
    console.error('Error signing in with Google: ', error);
    // Re-throw the error to be caught by the caller if needed
    throw error;
  }
};

export const signOut = async () => {
  const auth = getAuthInstance();
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out: ', error);
  }
};
