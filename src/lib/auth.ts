
'use client';

import { fetchStaffDataFromGAS } from '@/contexts/selected-staff-context';
import type { Staff, WithId } from './types';

const USER_SESSION_KEY = 'workwise-user-profile';

/**
 * Signs in a user by checking their credentials against the staff data from GAS.
 * @param email The user's email.
 * @param password The user's password.
 * @returns A promise that resolves with the user's profile if successful.
 */
export const signInWithEmail = async (email: string, password: string): Promise<WithId<Staff>> => {
  console.log(`Attempting to sign in via spreadsheet for email: ${email}`);
  try {
    const { staffList, error } = await fetchStaffDataFromGAS();
    if (error || !staffList) {
      throw new Error(error || 'Could not fetch staff data.');
    }

    const staffMember = staffList.find(s => s.email === email);

    if (!staffMember) {
      throw new Error('指定されたメールアドレスのスタッフが見つかりません。');
    }

    // Passwords in the sheet might be numbers, so we compare them as strings.
    if (String(staffMember.password) !== String(password)) {
      throw new Error('パスワードが正しくありません。');
    }

    // On successful login, save profile to session storage
    sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(staffMember));

    console.log('Spreadsheet sign in successful for:', staffMember.name);
    return staffMember;

  } catch (error: any) {
    console.error('Spreadsheet sign-in error:', error);
    throw error; // Re-throw the error to be caught by the calling function
  }
};

/**
 * Mock function for sign up. In a spreadsheet-only world, this doesn't create a new user,
 * but we can pretend it does for UI consistency.
 * @param email The new user's email.
 * @param password The new user's password.
 * @param name The new user's display name.
 * @returns A promise that rejects as this is not a real operation.
 */
export const signUpWithEmail = async (email: string, password: string, name: string): Promise<void> => {
  console.warn('Sign up is not supported in spreadsheet-only authentication mode.');
  throw new Error('新規登録は現在サポートされていません。管理者に連絡してスプレッドシートにアカウントを追加してもらってください。');
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
    // This should rarely fail, but we'll log it if it does.
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
