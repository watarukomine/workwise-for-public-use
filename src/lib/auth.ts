
'use client';

import type { Staff, WithId } from './types';
import { fetchStaffDataFromGAS } from '@/contexts/selected-staff-context';

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
  
  const staffList = await fetchStaffDataFromGAS();

  if (!staffList || staffList.length === 0) {
      throw new Error('スタッフマスタにアクセスできません。スタッフ管理ページでURLが正しく設定されているか確認してください。');
  }

  // This is the corrected logic. It correctly checks the `email` and `password` properties
  // on the Staff objects that were mapped in `fetchStaffDataFromGAS`.
  const user = staffList.find(staff => 
      staff.email?.toLowerCase() === email.toLowerCase() && 
      staff.password === password
  );

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (user) {
        console.log('Sign in successful for:', user.name, 'with role:', user.role);
        setSession(user);
        resolve(user);
      } else {
        console.log('Sign in failed: Invalid credentials. Checked against:', staffList.length, 'staff members.');
        reject(new Error('メールアドレスまたはパスワードが正しくありません。'));
      }
    }, 500); // Simulate network delay
  });
};

export const signUpWithEmail = async (email: string, password: string, name: string): Promise<WithId<Staff>> => {
    console.log(`Attempting to process sign up for email: ${email}`);

    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (password.length < 6) {
                console.log('Sign up failed: Password too weak');
                reject(new Error('パスワードは6文字以上で設定してください。'));
                return;
            }
            
            const newUser: WithId<Staff> = {
                id: `new-${Date.now()}`,
                name,
                email,
                password,
                role: 'staff',
                color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
                avatarUrl: `https://picsum.photos/seed/${Date.now()}/100/100`,
            };
            
            setSession(newUser);
            console.log('Sign up successful for new user:', newUser.name);
            resolve(newUser);
        }, 500);
    });
};


export const signOut = () => {
    console.log('Signing out user');
    setSession(null);
};

export const getCurrentUser = (): WithId<Staff> | null => {
    return getSession();
};
