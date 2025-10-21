'use client';

import { 
  signInAnonymously,
  signOut as firebaseSignOut,
  type Auth
} from 'firebase/auth';
import { initializeFirebase } from '@/firebase'; // Import the central getter

// Initialize Firebase and get the auth instance.
// This is done once and the instance is reused.
const { auth: singletonAuth } = initializeFirebase();

export const getAuthInstance = (): Auth => singletonAuth;

export const signIn = async (auth: Auth = singletonAuth) => {
  try {
    // Use the provided or singleton auth instance
    await signInAnonymously(auth);
  } catch (error) {
    console.error('Error signing in anonymously: ', error);
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
