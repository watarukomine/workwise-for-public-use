'use client';

import { 
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  type Auth
} from 'firebase/auth';
import { initializeFirebase } from '@/firebase'; // Import the central getter

// Initialize Firebase and get the auth instance.
// This is done once and the instance is reused.
const { auth: singletonAuth } = initializeFirebase();

const provider = new GoogleAuthProvider();

export const getAuthInstance = (): Auth => singletonAuth;

export const signIn = async (auth: Auth = singletonAuth) => {
  try {
    // Use the provided or singleton auth instance
    await signInWithPopup(auth, provider);
  } catch (error: any) {
    // Don't log an error if the user cancels the popup
    if (error && error.code === 'auth/cancelled-popup-request') {
      return;
    }
    console.error('Error signing in with Google: ', error);
  }
};

export const signOut = async () => {
  try {
    // Use the singleton auth instance directly
    await firebaseSignOut(singletonAuth);
  } catch (error) {
    console.error('Error signing out: ', error);
  }
};
