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
import { fetchStaffDataFromGAS } from '@/contexts/selected-staff-context';

// This ensures Firebase is initialized before we use getAuth()
const { auth } = initializeFirebase();

/**
 * Signs in a user with email and password. If the user does not exist in Firebase Auth,
 * it attempts to find them in the GAS-provided staff list and automatically creates an account.
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
  } catch (error: any) {
    // Recent Firebase versions use 'auth/invalid-credential' for both wrong password and user not found.
    // Therefore, we attempt to provision a new user in this case.
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
      console.log('User not found or invalid credential. Attempting to provision from spreadsheet...');
      try {
        const allStaff = await fetchStaffDataFromGAS();
        const staffMember = allStaff.find(s => s.email === email && s.password === password);

        if (staffMember) {
          console.log(`Found matching staff in spreadsheet: ${staffMember.name}. Creating Firebase user.`);
          // User exists in spreadsheet, create them in Firebase
          return await signUpWithEmail(email, password, staffMember.name);
        } else {
          // If not in spreadsheet either, then it's a true invalid credential case.
           throw new Error('メールアドレスまたはパスワードが正しくありません。');
        }
      } catch (provisionError: any) {
        console.error('Error during user provisioning from spreadsheet:', provisionError);
        throw new Error(`アカウントの自動作成に失敗しました: ${provisionError.message}`);
      }
    }
    
    console.error('Firebase sign in error:', error);
    // Re-throw other errors so the UI layer can handle them
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
        if (name && userCredential.user) {
          await updateProfile(userCredential.user, { displayName: name });
        }

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
