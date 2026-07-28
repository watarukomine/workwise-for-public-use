
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
export const signInWithEmail = async (identifier: string, password: string): Promise<WithId<Staff>> => {
  const cleanInput = identifier.trim();
  const { auth, firestore } = initializeFirebase();
  const { doc, getDoc, collection, query, where, getDocs } = await import('firebase/firestore');

  let targetEmail = cleanInput.toLowerCase();

  // If input is NOT an email (e.g. "STAFF001" or "DEMO1"), resolve email from Firestore 'users'
  if (!cleanInput.includes('@')) {
    console.log(`[Auth] Identifier '${cleanInput}' is not an email. Resolving staff ID from Firestore...`);
    
    // 1. Try exact doc ID match
    let userSnap = await getDoc(doc(firestore, 'users', cleanInput));
    if (!userSnap.exists()) {
      // 2. Try uppercase doc ID match
      userSnap = await getDoc(doc(firestore, 'users', cleanInput.toUpperCase()));
    }
    
    if (userSnap.exists() && userSnap.data()?.email) {
      targetEmail = String(userSnap.data()!.email).trim().toLowerCase();
      console.log(`[Auth] Resolved staff ID '${cleanInput}' to email: ${targetEmail}`);
    } else {
      // 3. Try querying userCode field
      const q = query(collection(firestore, 'users'), where('userCode', '==', cleanInput));
      const querySnap = await getDocs(q);
      if (!querySnap.empty && querySnap.docs[0].data()?.email) {
        targetEmail = String(querySnap.docs[0].data()!.email).trim().toLowerCase();
        console.log(`[Auth] Resolved userCode '${cleanInput}' to email: ${targetEmail}`);
      }
    }
  }

  console.log(`[Auth] Attempting sign-in for: ${targetEmail}`);

  try {
    const userCredential = await signInWithEmailAndPassword(auth, targetEmail, password);
    const user = userCredential.user;

    console.log(`[Auth] Firebase Auth success, fetching profile for: ${user.email}`);
    const staffMember = await StaffService.getStaffByEmail(user.email!);

    if (!staffMember) {
      console.error(`[Auth] Profile NOT found in Firestore 'users' collection for email: ${user.email}`);
      throw new Error('認証は成功しましたが、システム内にスタッフ情報が見つかりません。管理者にアカウントの有効化を依頼してください。');
    }

    sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(staffMember));
    console.log(`[Auth] Login complete for: ${staffMember.name} (${staffMember.role})`);
    return staffMember;

  } catch (error: any) {
    console.error('[Auth] Sign-in error:', error);
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-email') {
      throw new Error('ID/メールアドレス または パスワードが正しくありません。');
    }
    if (error.message.includes('スタッフ情報が見つかりません')) {
      throw error;
    }
    throw new Error(error.message || 'ログイン中に予期せぬエラーが発生しました。');
  }
};

/**
 * Signs up a new user using Firebase Authentication and initializes their Firestore record.
 */
export const signUpWithEmail = async (email: string, password: string, name: string): Promise<void> => {
  const normalizedEmail = email.trim().toLowerCase();
  const { auth } = initializeFirebase();
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    const user = userCredential.user;

    const newStaff: any = {
        uid: user.uid,
        name,
        email: normalizedEmail,
        _type: 'staff',
        role: 'staff',
        createdAt: new Date().toISOString()
    };

    // Use UID as key for better practice and consistency
    await StaffService.saveStaff(user.uid, newStaff);
    
    // Also save to session storage so user is "logged in" immediately
    const staffWithId = { ...newStaff, id: user.uid };
    sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(staffWithId));
    
    console.log('[Auth] User signed up successfully:', normalizedEmail);

  } catch (error: any) {
    console.error('[Auth] Sign up error:', error);
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
