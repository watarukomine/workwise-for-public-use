
'use client';

import { 
  GoogleAuthProvider,
  signInWithPopup,
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
  const provider = new GoogleAuthProvider();
  try {
    console.log("Attempting to sign in with Google...");
    const result = await signInWithPopup(auth, provider);
    console.log("Google sign-in successful:", result.user.uid);
  } catch (error: any) {
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
