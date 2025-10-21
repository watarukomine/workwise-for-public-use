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
const { auth } = initializeFirebase();

export const getAuthInstance = (): Auth => auth;

export const signInWithGoogle = async () => {
  try {
    // Use the singleton auth instance directly
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Error signing in with Google: ', error);
  }
};

export const signOut = async () => {
  try {
    // Use the singleton auth instance directly
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out: ', error);
  }
};
