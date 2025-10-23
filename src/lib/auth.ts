'use client';

import { 
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  type Auth,
} from 'firebase/auth';
import { initializeFirebase } from '@/firebase';

const provider = new GoogleAuthProvider();

// This function should be called within a component or another client-side function.
const getAuthInstance = (): Auth => {
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
    if (error && error.code === 'auth/popup-closed-by-user') {
        console.log("Sign-in popup closed by user.");
        return;
    }
    // Specific check for 'auth/operation-not-allowed'
    if (error.code === 'auth/operation-not-allowed') {
        console.error("Google Sign-In is not enabled in the Firebase console. Please enable it in the 'Authentication' > 'Sign-in method' tab.");
        // We can throw a more specific error for the UI to catch
        throw new Error("GoogleログインがFirebaseプロジェクトで有効になっていません。");
    }
    console.error('Error signing in with Google: ', error);
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
