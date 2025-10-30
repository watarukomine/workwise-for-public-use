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
 * This function handles various scenarios including password mismatches between GAS and Firebase.
 * @param email The user's email.
 * @param password The user's password.
 * @returns A promise that resolves with the user credential.
 */
export const signInWithEmail = async (email: string, password: string): Promise<UserCredential> => {
  console.log(`Attempting to sign in with Firebase for email: ${email}`);
  try {
    // 1. First, try to sign in normally. This will succeed if the user exists in Firebase with the correct password.
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('Firebase sign in successful for:', userCredential.user.email);
    return userCredential;

  } catch (error: any) {
    // 2. If login fails, check if it's an "invalid credential" error.
    // This code is returned for both "user not found" and "wrong password".
    if (error.code === 'auth/invalid-credential') {
      console.log('Invalid credential. Checking spreadsheet for user to auto-provision account...');
      
      try {
        // 3. Fetch the source of truth: the staff list from the spreadsheet.
        const allStaff = await fetchStaffDataFromGAS();
        const staffMember = allStaff.find(s => s.email === email);

        // 4. If no staff member with that email exists, or the password doesn't match the sheet, it's a true invalid credential case.
        if (!staffMember || staffMember.password !== password) {
          console.log('No staff member found in spreadsheet with matching email and password.');
          throw new Error('メールアドレスまたはパスワードが正しくありません。');
        }

        // 5. If we reach here, the user is a valid staff member according to the sheet.
        // We can now confidently attempt to create their Firebase account.
        console.log(`Valid staff member found in sheet: ${staffMember.name}. Attempting to create Firebase account...`);
        try {
          return await signUpWithEmail(email, password, staffMember.name);
        } catch (signUpError: any) {
           console.error('An unexpected error occurred during automatic sign-up:', signUpError);
           // This could happen due to network issues or other Firebase problems.
           throw new Error('アカウントの自動作成中にエラーが発生しました。もう一度お試しください。');
        }

      } catch (provisionError: any) {
        // This catches errors from fetchStaffDataFromGAS or the explicit "not found" error.
        console.error('Error during user check/provision from spreadsheet:', provisionError.message);
        throw provisionError; // Re-throw the specific, user-facing error.
      }
    }
    
    // For any other Firebase errors (network issues, etc.), re-throw them.
    console.error('An unexpected Firebase sign-in error occurred:', error);
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
