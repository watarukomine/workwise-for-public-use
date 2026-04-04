
'use client';

import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  User
} from 'firebase/auth';
import { initializeFirebase } from '@/firebase';
import { StaffService } from '@/services/staff-service';
import type { Staff, WithId } from './types';

const USER_SESSION_KEY = 'workwise-user-profile';

/**
 * Signs in a user using Firebase Authentication.
 * @param email The user's email.
 * @param password The user's password.
 * @returns A promise that resolves with the user's profile from Firestore if successful.
 */
export const signInWithEmail = async (email: string, password: string): Promise<WithId<Staff>> => {
  console.log(`Attempting to sign in via Firebase Auth for email: ${email}`);
  const { auth } = initializeFirebase();
  
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Fetch additional profile info from Firestore
    const staffMember = await StaffService.getStaffByEmail(user.email!);

    if (!staffMember) {
      throw new Error('認証は成功しましたが、スタッフ情報が見つかりません。管理者に問い合わせてください。');
    }

    // On successful login, save profile to session storage
    sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(staffMember));

    console.log('Firebase Auth sign in successful for:', staffMember.name);
    return staffMember;

  } catch (error: any) {
    console.error('Firebase Auth sign-in error:', error);
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      throw new Error('メールアドレスまたはパスワードが正しくありません。');
    }
    throw error;
  }
};

/**
 * Signs up a new user using Firebase Authentication and initializes their Firestore record.
 */
export const signUpWithEmail = async (email: string, password: string, name: string): Promise<void> => {
  const { auth } = initializeFirebase();
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const newStaff: any = {
        uid: user.uid,
        name,
        email,
        // We no longer store passwords in Firestore for security
        role: 'staff',
        createdAt: new Date().toISOString()
    };

    // Use email or UID as key, here we stay consistent with previous code using email as key if desired, 
    // but UID is better. Let's keep email as key for compatibility with existing queries if necessary.
    await StaffService.saveStaff(email, newStaff);
    
    // Also save to session storage so user is "logged in" immediately
    sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(newStaff));
    
    console.log('User signed up successfully with Firebase Auth:', email);

  } catch (error: any) {
    console.error('Sign up error:', error);
    throw error;
  }
};

/**
 * Sends a password reset email using Firebase Authentication.
 */
export const sendPasswordReset = async (email: string): Promise<void> => {
  const { auth } = initializeFirebase();
  try {
    await sendPasswordResetEmail(auth, email);
    console.log('Password reset email sent to:', email);
  } catch (error: any) {
    console.error('Password reset error:', error);
    if (error.code === 'auth/user-not-found') {
      throw new Error('このメールアドレスは登録されていません。');
    }
    throw error;
  }
};

/**
 * Signs out the current user.
 */
export const signOut = async (): Promise<void> => {
  console.log('Signing out user.');
  const { auth } = initializeFirebase();
  try {
    await firebaseSignOut(auth);
    sessionStorage.removeItem(USER_SESSION_KEY);
  } catch (error) {
    console.error('Sign out error:', error);
  }
};

/**
 * Gets the currently "signed-in" user from session storage.
 * @returns The user's profile object or null.
 */
export const getCurrentUser = (): WithId<Staff> | null => {
  try {
    const userJson = sessionStorage.getItem(USER_SESSION_KEY);
    if (!userJson) return null;
    return JSON.parse(userJson);
  } catch (error) {
    console.error('Could not retrieve user from session storage:', error);
    return null;
  }
};
