
'use client';

// This is a mock authentication service.
// In a real application, this would be replaced with a robust authentication provider like Firebase Auth.

import type { Staff, WithId } from './types';
import { staffData as fallbackStaffData } from './data';
// The function to fetch from GAS has been moved to selected-staff-context.tsx

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

const findRoleValue = (item: any): 'admin' | 'staff' => {
  if (!item || typeof item !== 'object') return 'staff';
  const roleValue = item['権限'];
  if (roleValue && typeof roleValue === 'string' && roleValue.toLowerCase() === 'admin') {
    return 'admin';
  }
  return 'staff';
};


// This function now only combines data, it does not fetch from GAS itself.
// It relies on the staff data passed to it.
const combineStaffData = (gasStaff: WithId<Staff>[]): WithId<Staff>[] => {
  const combinedStaffMap = new Map<string, WithId<Staff>>();

  // Add GAS data first
  if (Array.isArray(gasStaff)) {
    gasStaff.forEach(staff => {
        if (staff.email) {
          combinedStaffMap.set(staff.email.toLowerCase(), staff)
        }
    });
  }

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
  
  let combinedStaff: WithId<Staff>[] = [];

  // Try fetching from GAS, but have a fallback
  try {
      if (typeof window !== 'undefined') {
        const staffGasUrl = localStorage.getItem('staffImporterUrl');
        if (staffGasUrl) {
            const response = await fetch(staffGasUrl, { cache: 'no-store' });
            if (response.ok) {
                const result = await response.json();
                const rawStaffArray = result.data || (Array.isArray(result) ? result : []);
                 if (Array.isArray(rawStaffArray)) {
                    const gasStaff = rawStaffArray.map((item: any) => ({
                        id: String(item['スタッフID'] || item.id),
                        role: findRoleValue(item),
                        name: item['スタッフ名'] || item.name,
                        email: item['メールアドレス'] || item.email,
                        password: item['パスワード'] || item.password,
                        calendarId: item['カレンダーID'] || item.calendarId,
                        color: item['カラー'] || item.color,
                        avatarUrl: `https://picsum.photos/seed/${String(item['スタッフID'] || item.id)}/100/100`,
                    }));
                     combinedStaff = combineStaffData(gasStaff);
                } else {
                   // If GAS returns invalid data, use fallback only
                   combinedStaff = combineStaffData([]);
                }
            } else {
                // If response is not OK, use fallback
                console.warn("Could not fetch from GAS, using fallback staff data.");
                combinedStaff = combineStaffData([]);
            }
        } else {
             // If no URL, use fallback
            combinedStaff = combineStaffData([]);
        }
      } else {
         // If server-side, use fallback
         combinedStaff = combineStaffData([]);
      }
  } catch (error) {
      console.error("Error fetching staff from GAS during sign in, using fallback.", error);
      combinedStaff = combineStaffData([]); // Use fallback on any error
  }
  
  const user = combinedStaff.find(staff => staff.email && staff.email.toLowerCase() === email.toLowerCase() && staff.password === password);

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
