'use client';

import { 
  signInAnonymously,
  signOut as firebaseSignOut,
  type Auth,
} from 'firebase/auth';
import { initializeFirebase } from '@/firebase';

// This function should be called within a component or another client-side function.
const getAuthInstance = (): Auth => {
  // Directly initialize and get auth instance to ensure it's always available.
  const { auth } = initializeFirebase();
  return auth;
};

export const signIn = async () => {
  const auth = getAuthInstance();
  try {
    console.log("Attempting to sign in anonymously...");
    const result = await signInAnonymously(auth);
    console.log("Anonymous sign-in successful:", result.user.uid);
  } catch (error: any) {
    console.error('Error signing in anonymously: ', error);
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
