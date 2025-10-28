
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
    
    // Check if data is an object with a 'data' property, or a direct array
    const rawStaffArray = Array.isArray(data) ? data : data.data;

    if (!Array.isArray(rawStaffArray)) {
        console.error("GAS response did not contain a valid data array, using fallback.");
        return fallbackStaffData;
    }

    // Assuming the GAS returns an array of objects with specific keys
    return rawStaffArray.map((item: any) => ({
      id: String(item['スタッフID']),
      role: String(item['権限（Staff /Admin）'] || 'staff').toLowerCase() === 'admin' ? 'admin' : 'staff',
      name: item['スタッフ名'],
      email: item['メールアドレス'],
      password: item['パスワード'],
      calendarId: item['カレンダーID'],
      color: item['カラー'],
      avatarUrl: `https://picsum.photos/seed/${item['スタッフID']}/100/100`, // Generate a consistent avatar
    }));
  } catch (error) {
    console.error('Error fetching staff data from GAS:', error);
    return fallbackStaffData; // Return fallback data in case of any error
  }
};


export const signInWithEmail = async (email: string, password: string): Promise<WithId<Staff>> => {
  console.log(`Attempting to sign in with email: ${email}`);
  
  const staffList = await fetchStaffDataFromGAS();
  const user = staffList.find(staff => staff.email === email && staff.password === password);

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (user) {
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

    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const existingUser = staffList.find(staff => staff.email === email);
            if (existingUser) {
                console.log('User already exists, attempting login instead for:', existingUser.name);
                 if (existingUser.password === password) {
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
                role: 'staff',
                color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
                avatarUrl: `https://picsum.photos/seed/${Date.now()}/100/100`,
            };
            
            // staffData.push(newUser); // This won't persist
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
