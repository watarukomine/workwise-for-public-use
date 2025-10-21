'use client';

import { 
  GoogleAuthProvider, 
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth
} from 'firebase/auth';
import { initializeFirebase } from '@/firebase'; // Import the central getter

const provider = new GoogleAuthProvider();
// Initialize Firebase and get the auth instance.
// This is done once and the instance is reused.
const { auth: singletonAuth } = initializeFirebase();

export const getAuthInstance = (): Auth => singletonAuth;

export const signInWithGoogle = async (auth: Auth = singletonAuth) => {
  try {
    // Use the provided or singleton auth instance
    await signInWithPopup(auth, provider);
  } catch (error) {
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

    