
'use client';

// This is a mock authentication service.
// In a real application, this would be replaced with a robust authentication provider like Firebase Auth.

import type { Staff, WithId } from './types';
import { staffData as fallbackStaffData } from './data';

const MOCK_USER_SESSION_KEY = 'mockUserSession';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyOUN7eqN2f3u9aYaU-5rP8UGrcawlan3FAHzHKjm7RuXifKBCjs2kbfTTB09ygvfRd-Q/exec';

// Helper to get user session from localStorage
const getSession = (): WithId<Staff> | null => {
  if (typeof window === 'undefined') return null;
  const session = localStorage.getItem(MOCK_USER_SESSION_KEY);
  return session ? JSON.parse(session) : null;
};

// Helper to set user session in localStorage
const setSession = (user: WithId<Staff> | null) => {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem(MOCK_USER_SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(MOCK_USER_SESSION_KEY);
  }
};

const fetchStaffDataFromGAS = async (): Promise<WithId<Staff>[]> => {
  try {
    const response = await fetch(GAS_URL, { cache: 'no-store' });
    if (!response.ok) {
      console.error('Failed to fetch from GAS, using fallback data.');
      return fallbackStaffData;
    }
    const data = await response.json();
    
    // Handle both direct array and object with 'data' property
    const rawStaffArray = Array.isArray(data) ? data : data.data;

    if (!Array.isArray(rawStaffArray)) {
        console.error("GAS response did not contain a valid data array, using fallback.");
        return fallbackStaffData;
    }

    return rawStaffArray.map((item: any) => ({
      id: String(item['スタッフID']),
      // Ensure role is always lowercase
      role: (item['権限（Staff /Admin）'] || 'staff').toString().toLowerCase() === 'admin' ? 'admin' : 'staff',
      name: item['スタッフ名'],
      email: item['メールアドレス'],
      password: item['パスワード'],
      calendarId: item['カレンダーID'],
      color: item['カラー'],
      avatarUrl: `https://picsum.photos/seed/${item['スタッフID']}/100/100`,
    }));
  } catch (error) {
    console.error('Error fetching staff data from GAS:', error);
    // If any error occurs, return the static fallback data which includes sample accounts
    return fallbackStaffData;
  }
};


export const signInWithEmail = async (email: string, password: string): Promise<WithId<Staff>> => {
  console.log(`Attempting to sign in with email: ${email}`);
  
  const staffList = await fetchStaffDataFromGAS();
  // Find user by email and password, case-insensitive email matching can be useful
  const user = staffList.find(staff => staff.email.toLowerCase() === email.toLowerCase() && staff.password === password);

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (user) {
        // The `role` is now correctly set to lowercase 'admin' or 'staff' by fetchStaffDataFromGAS
        console.log('Sign in successful for:', user.name, 'with role:', user.role);
        setSession(user);
        resolve(user);
      } else {
        console.log('Sign in failed: Invalid credentials');
        reject(new Error('メールアドレスまたはパスワードが正しくありません。'));
      }
    }, 1000); // Simulate network delay
  });
};

export const signUpWithEmail = async (email: string, password: string, name: string): Promise<WithId<Staff>> => {
    console.log(`Attempting to sign up with email: ${email}`);
    const staffList = await fetchStaffDataFromGAS();
    
    const existingUser = staffList.find(staff => staff.email.toLowerCase() === email.toLowerCase());

    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (existingUser) {
                 if (existingUser.password === password) {
                    // The `role` is already correctly set by fetchStaffDataFromGAS
                    console.log('Sign in successful for existing user:', existingUser.name, 'with role:', existingUser.role);
                    setSession(existingUser);
                    resolve(existingUser);
                } else {
                    console.log('Sign in failed for existing user: Invalid password');
                    reject(new Error('このメールアドレスは登録済みです。パスワードが正しくありません。'));
                }
                return;
            }

            if (password.length < 6) {
                console.log('Sign up failed: Password too weak');
                reject(new Error('パスワードは6文字以上で設定してください。'));
                return;
            }
            
            // NOTE: This only creates a user for the current session.
            // It does not persist the new user to the spreadsheet.
            const newUser: WithId<Staff> = {
                id: `new-${Date.now()}`,
                name,
                email,
                password,
                role: 'staff', // New signups are always 'staff' by default
                color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
                avatarUrl: `https://picsum.photos/seed/${Date.now()}/100/100`,
            };
            
            setSession(newUser);
            console.log('Sign up successful for new user:', newUser.name);
            resolve(newUser);
        }, 1000);
    });
};


export const signOut = async (): Promise<void> => {
    console.log('Signing out user');
    return new Promise((resolve) => {
        setTimeout(() => {
            setSession(null);
            resolve();
        }, 500);
    });
};

export const getCurrentUser = (): WithId<Staff> | null => {
    return getSession();
};
