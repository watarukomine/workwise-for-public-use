
'use client';

// This is a mock authentication service.
// In a real application, this would be replaced with a robust authentication provider like Firebase Auth.

import { staffData } from './data';
import type { Staff, WithId } from './types';

const MOCK_USER_SESSION_KEY = 'mockUserSession';

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

export const signInWithEmail = async (email: string, password: string): Promise<WithId<Staff>> => {
  console.log(`Attempting to sign in with email: ${email}`);
  
  const user = staffData.find(staff => staff.email === email && staff.password === password);

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (user) {
        console.log('Sign in successful for:', user.name);
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

    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const existingUser = staffData.find(staff => staff.email === email);
            if (existingUser) {
                console.log('Sign up failed: Email already in use');
                reject(new Error('このメールアドレスは既に使用されています。'));
                return;
            }

            if (password.length < 6) {
                console.log('Sign up failed: Password too weak');
                reject(new Error('パスワードは6文字以上で設定してください。'));
                return;
            }
            
            // NOTE: This only adds to the in-memory array for the current session.
            // It does not persist the new user.
            const newUser: WithId<Staff> = {
                id: `new-${Date.now()}`,
                name,
                email,
                password,
                role: 'staff',
                color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
                avatarUrl: `https://picsum.photos/seed/${Date.now()}/100/100`,
            };
            
            staffData.push(newUser);
            setSession(newUser);
            console.log('Sign up successful for:', newUser.name);
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
