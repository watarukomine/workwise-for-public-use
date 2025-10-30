'use client';

import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  updateProfile,
  type UserCredential
} from 'firebase/auth';
import { initializeFirebase } from '@/firebase';

// This ensures Firebase is initialized before we use getAuth()
const { auth } = initializeFirebase();

/**
 * Signs in a user with email and password using Firebase Authentication.
 * @param email The user's email.
 * @param password The user's password.
 * @returns A promise that resolves with the user credential.
 */
export const signInWithEmail = async (email: string, password: string): Promise<UserCredential> => {
  console.log(`Attempting to sign in with Firebase for email: ${email}`);
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('Firebase sign in successful for:', userCredential.user.email);
    return userCredential;
  } catch (error) {
    console.error('Firebase sign in error:', error);
    // Re-throw the error so the UI layer can handle it (e.g., show a specific message)
    throw error;
  }
};

/**
 * Signs up a new user with email, password, and name using Firebase Authentication.
 * Also updates the user's display name.
 * @param email The new user's email.
 * @param password The new user's password.
 * @param name The new user's display name.
 * @returns A promise that resolves with the user credential.
 */
export const signUpWithEmail = async (email: string, password: string, name: string): Promise<UserCredential> => {
    console.log(`Attempting to sign up with Firebase for email: ${email}`);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // After creating the user, update their profile with the name.
        await updateProfile(userCredential.user, { displayName: name });

        console.log('Firebase sign up successful for new user:', userCredential.user.email);
        return userCredential;
    } catch (error) {
        console.error('Firebase sign up error:', error);
        throw error;
    }
};

/**
 * Signs out the current Firebase user.
 * @returns A promise that resolves when sign-out is complete.
 */
export const signOut = async (): Promise<void> => {
    console.log('Signing out Firebase user');
    try {
        await firebaseSignOut(auth);
    } catch (error) {
        console.error('Firebase sign out error:', error);
        throw error;
    }
};

/**
 * Gets the currently signed-in Firebase user.
 * This is a synchronous check and might be null on initial page load.
 * For real-time user state, use the `useUser` hook.
 * @returns The current user object or null.
 */
export const getCurrentUser = () => {
    return auth.currentUser;
};
