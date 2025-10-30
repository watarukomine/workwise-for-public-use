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
    // 1. First, try to sign in normally.
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('Firebase sign in successful for:', userCredential.user.email);
    return userCredential;

  } catch (error: any) {
    // 2. If login fails with 'invalid-credential', it could be a wrong password OR a non-existent user.
    if (error.code === 'auth/invalid-credential') {
      console.log('Invalid credential. Checking spreadsheet for user and password match...');
      
      try {
        // 3. Fetch the source of truth: the staff list from the spreadsheet.
        const allStaff = await fetchStaffDataFromGAS();
        const staffMember = allStaff.find(s => s.email === email);

        // 4. If no staff member with that email exists in the sheet, it's a true invalid credential case.
        if (!staffMember) {
          console.log('No staff member found in spreadsheet with that email.');
          throw new Error('メールアドレスまたはパスワードが正しくありません。');
        }

        // 5. If the staff member exists but the password does not match the sheet, it's a wrong password.
        if (staffMember.password !== password) {
          console.log('Password does not match spreadsheet record.');
          throw new Error('メールアドレスまたはパスワードが正しくありません。');
        }

        // 6. If we reach here, the user is a valid staff member with the correct password according to the sheet.
        // This means they either don't exist in Firebase yet, or their Firebase password is out of sync.
        // Let's try to create the user.
        console.log(`Valid staff member found in sheet: ${staffMember.name}. Attempting to create Firebase account...`);
        try {
          // 7. Attempt to sign up the user. This will create them if they don't exist.
          return await signUpWithEmail(email, password, staffMember.name);

        } catch (signUpError: any) {
          // 8. If sign-up fails because the email is already in use, it confirms the user exists in Firebase
          // but the password from the initial login attempt was wrong. This is the scenario you pointed out!
          if (signUpError.code === 'auth/email-already-in-use') {
            console.log('User exists in Firebase, but password was incorrect. The source of truth (spreadsheet) and Firebase are out of sync.');
            // We throw the original, user-friendly error. The developer can see from the logs what the real issue is.
            throw new Error('メールアドレスまたはパスワードが正しくありません。');
          }
          // If it was a different sign-up error (e.g., weak password), throw that.
          throw signUpError;
        }

      } catch (provisionError: any) {
        console.error('Error during user check/provision from spreadsheet:', provisionError.message);
        // Re-throw the specific, user-facing error message.
        throw provisionError;
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
