'use client';

import { 
  GoogleAuthProvider, 
  signInWithPopup,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { initializeFirebase } from '@/firebase';

const { auth } = initializeFirebase();

const provider = new GoogleAuthProvider();
// The scope for calendar read-only access is not strictly required for sign-in,
// but can be kept if future calendar integration is planned.
// provider.addScope('https://www.googleapis.com/auth/calendar.readonly');

export const signInWithGoogle = async () => {
  try {
    // signInWithPopup is non-blocking and handles its own promise,
    // but awaiting it ensures we can catch errors here if needed.
    await signInWithPopup(auth, provider);
  } catch (error) {
    // Errors will be logged to the console by Firebase's default handler.
    // Additional custom error handling could be placed here.
    console.error('Error signing in with Google: ', error);
  }
};

export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out: ', error);
  }
};
