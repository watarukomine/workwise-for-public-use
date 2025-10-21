'use client';

import { 
  Auth,
  GoogleAuthProvider, 
  signInWithPopup,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { getFirebase } from '@/firebase'; // Import the central getter

const provider = new GoogleAuthProvider();
const { auth } = getFirebase(); // Get the singleton auth instance

export const getAuthInstance = () => auth;

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
