
'use client';

// This is a mock authentication service.
// In a real application, this would be replaced with a robust authentication provider like Firebase Auth.

import type { Staff, WithId } from './types';
import { staffData as fallbackStaffData } from './data';

const MOCK_USER_SESSION_KEY = 'mockUserSession';
const STAFF_GAS_URL = 'https://script.google.com/macros/s/AKfycbxT6Qz8vLTVi94Yk5EQpACijVWVOWg-kDwOcADoq2gF63wsSzIIP9FDMP5rR31NR6_I_w/exec';


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

const findRoleValue = (item: any): 'admin' | 'staff' => {
  if (!item || typeof item !== 'object') return 'staff';

  const roleValue = item['権限'];

  if (roleValue && typeof roleValue === 'string' && roleValue.toLowerCase() === 'admin') {
    return 'admin';
  }
  
  return 'staff';
};

export const fetchStaffDataFromGAS = async (): Promise<WithId<Staff>[]> => {
    if (!STAFF_GAS_URL) {
        console.warn("No GAS URL for staff is defined.");
        return [];
    }

    try {
        const response = await fetch(STAFF_GAS_URL, { cache: 'no-store' });
        if (response.ok) {
            const data = await response.json();
            const rawStaffArray = Array.isArray(data) ? data : data.data;

            if (Array.isArray(rawStaffArray)) {
                return rawStaffArray.map((item: any) => {
                    return {
                        id: String(item['スタッフID']),
                        role: findRoleValue(item),
                        name: item['スタッフ名'],
                        email: item['メールアドレス'],
                        password: item['パスワード'],
                        calendarId: item['カレンダーID'],
                        color: item['カラー'],
                        avatarUrl: `https://picsum.photos/seed/${item['スタッフID']}/100/100`,
                    };
                });
            }
        }
    } catch (error) {
        console.error('Error fetching staff data from GAS:', error);
        // In case of fetch error, we can decide if we want to throw or return empty/fallback
        throw new Error('Failed to fetch staff data from spreadsheet.');
    }
    return []; // Return empty if response not ok or data malformed
};


const fetchAndCombineStaffData = async (): Promise<WithId<Staff>[]> => {
  const gasStaff = await fetchStaffDataFromGAS();
  
  const combinedStaffMap = new Map<string, WithId<Staff>>();

  // Add GAS data first
  gasStaff.forEach(staff => {
      if (staff.email) {
        combinedStaffMap.set(staff.email.toLowerCase(), staff)
      }
  });

  // Add fallback data only if it doesn't already exist from GAS
  fallbackStaffData.forEach(staff => {
    if (staff.email && !combinedStaffMap.has(staff.email.toLowerCase())) {
      combinedStaffMap.set(staff.email.toLowerCase(), staff);
    }
  });

  return Array.from(combinedStaffMap.values());
};


export const signInWithEmail = async (email: string, password: string): Promise<WithId<Staff>> => {
  console.log(`Attempting to sign in with email: ${email}`);
  
  const staffList = await fetchAndCombineStaffData();
  const user = staffList.find(staff => staff.email && staff.email.toLowerCase() === email.toLowerCase() && staff.password === password);

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
    console.log(`Attempting to process sign up for email: ${email}`);
    const staffList = await fetchAndCombineStaffData();
    
    const existingUser = staffList.find(staff => staff.email && staff.email.toLowerCase() === email.toLowerCase());

    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (existingUser) {
                 if (existingUser.password === password) {
                    console.log('Login via signup form successful for:', existingUser.name, 'with role:', existingUser.role);
                    setSession(existingUser);
                    resolve(existingUser);
                } else {
                    console.log('Sign up failed for existing user: Invalid password');
                    reject(new Error('このメールアドレスは登録済みですが、パスワードが異なります。'));
                }
                return;
            }
            
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
        }, 1000);
    });
};


export const signOut = () => {
    console.log('Signing out user');
    setSession(null);
};

export const getCurrentUser = (): WithId<Staff> | null => {
    return getSession();
};
