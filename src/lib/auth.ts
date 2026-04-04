
'use client';

import { StaffService } from '@/services/staff-service';
import type { Staff, WithId } from './types';

const USER_SESSION_KEY = 'workwise-user-profile';

/**
 * Signs in a user by checking their credentials against Firestore data.
 * @param email The user's email.
 * @param password The user's password.
 * @returns A promise that resolves with the user's profile if successful.
 */
export const signInWithEmail = async (email: string, password: string): Promise<WithId<Staff>> => {
  console.log(`Attempting to sign in via Firestore for email: ${email}`);
  try {
    const staffMember = await StaffService.getStaffByEmail(email);

    if (!staffMember) {
      throw new Error('指定されたメールアドレスのスタッフが見つかりません。');
    }

    // Passwords should be stored securely, but for now we follow the custom auth logic.
    if (String(staffMember.password) !== String(password)) {
      throw new Error('パスワードが正しくありません。');
    }

    // On successful login, save profile to session storage
    sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(staffMember));

    console.log('Firestore sign in successful for:', staffMember.name);
    return staffMember;

  } catch (error: any) {
    console.error('Firestore sign-in error:', error);
    throw error;
  }
};

/**
 * Signs up a new user in Firestore.
 */
export const signUpWithEmail = async (email: string, password: string, name: string): Promise<void> => {
  try {
    const existing = await StaffService.getStaffByEmail(email);
    if (existing) {
        throw new Error('このメールアドレスは既に登録されています。');
    }

    const newStaff: any = {
        name,
        email,
        password,
        role: 'staff', // Default role
    };

    // Use email as a temporary ID if no separate auth ID is provided
    await StaffService.saveStaff(email, newStaff);
    console.log('User signed up successfully:', email);

  } catch (error: any) {
    console.error('Sign up error:', error);
    throw error;
  }
};

/**
 * Signs out the current user by clearing session storage.
 */
export const signOut = (): void => {
  console.log('Signing out user by clearing session storage.');
  try {
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
