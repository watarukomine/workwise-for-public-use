
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
  const cleanPassword = password.trim();
  const { auth, firestore } = initializeFirebase();
  const { doc, getDoc, collection, query, where, getDocs } = await import('firebase/firestore');

  console.log(`[Auth] Sign-in attempt for identifier: '${cleanInput}'`);

  let staffProfile: WithId<Staff> | null = null;

  // 1. Try resolving profile directly from Firestore 'users' collection first
  try {
    // Check by docID (e.g. "STAFF004" or "DEMO1")
    let docRef = doc(firestore, 'users', cleanInput.toUpperCase());
    let snap = await getDoc(docRef);
    if (!snap.exists()) {
      docRef = doc(firestore, 'users', cleanInput);
      snap = await getDoc(docRef);
    }

    if (snap.exists()) {
      staffProfile = { id: snap.id, ...snap.data() } as WithId<Staff>;
    } else {
      // Check by email field
      const q = query(collection(firestore, 'users'), where('email', '==', cleanInput.toLowerCase()));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        staffProfile = { id: qSnap.docs[0].id, ...qSnap.docs[0].data() } as WithId<Staff>;
      }
    }
  } catch (err) {
    console.warn('[Auth] Firestore profile search error:', err);
  }

  // 2. Validate password against Firestore master record if found
  if (staffProfile) {
    const pass1 = String((staffProfile as any).password || '').trim();
    const pass2 = String((staffProfile as any)['パスワード'] || '').trim();
    const pass3 = String((staffProfile as any).pass || '').trim();

    const validPasswords = new Set([pass1, pass2, pass3, `${pass2}!`, `${pass3}!`].filter(Boolean));

    if (validPasswords.has(cleanPassword) || (cleanPassword.length < 6 && validPasswords.has(`${cleanPassword}!`))) {
      console.log(`[Auth] Master password match success for: ${staffProfile.name} (${staffProfile.id})`);
      const targetEmail = staffProfile.email || `${cleanInput.toLowerCase()}@toyota-mp.co.jp`;
      try {
        await signInWithEmailAndPassword(auth, targetEmail, cleanPassword);
      } catch (authErr) {
        if (cleanPassword.length < 6) {
          try {
            await signInWithEmailAndPassword(auth, targetEmail, `${cleanPassword}!`);
          } catch (e) {}
        }
      }
      sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(staffProfile));
      return staffProfile;
    }
  }

  // 3. Try Firebase Auth sign-in
  const targetEmail = staffProfile?.email || (cleanInput.includes('@') ? cleanInput.toLowerCase() : `${cleanInput.toLowerCase()}@toyota-mp.co.jp`);
  
  const passwordsToTry = [cleanPassword];
  if (cleanPassword.length < 6) {
    passwordsToTry.push(`${cleanPassword}!`);
  }

  for (const passCandidate of passwordsToTry) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, targetEmail, passCandidate);
      const user = userCredential.user;

      if (!staffProfile) {
        staffProfile = await StaffService.getStaffByEmail(user.email!);
      }

      if (staffProfile) {
        sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(staffProfile));
        console.log(`[Auth] Firebase Auth login complete for: ${staffProfile.name}`);
        return staffProfile;
      }
    } catch (fbErr: any) {
      console.warn('[Auth] Firebase Auth sign-in attempt failed:', fbErr?.code || fbErr?.message);
    }
  }

  throw new Error('ID/メールアドレス または パスワードが正しくありません。');
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
        currentStatus: '未出勤',
        isOnline: true,
        '母店': '横浜店',
        color: '#3B82F6',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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
  const { auth, firestore: db } = initializeFirebase();
  try {
    const sessionUser = getCurrentUser();
    const currentAuthUser = auth.currentUser;
    const userId = currentAuthUser?.uid || sessionUser?.id;
    const userEmail = currentAuthUser?.email || sessionUser?.email;
    const userName = sessionUser?.name;

    if (db) {
      try {
        const { doc, updateDoc, collection, query, where, getDocs } = await import('firebase/firestore');
        
        const clearFields = {
          latitude: null,
          longitude: null,
          currentStatus: 'ログアウト',
          isOnline: false,
          updatedAt: new Date().toISOString()
        };

        // 1. Update by Direct User ID
        if (userId) {
          await updateDoc(doc(db, 'users', userId), clearFields).catch(() => {});
          await updateDoc(doc(db, 'staffStatus', userId), clearFields).catch(() => {});
        }

        // 2. Fallback update by Email
        if (userEmail) {
          const qEmail = query(collection(db, 'users'), where('email', '==', userEmail.trim().toLowerCase()));
          const snapEmail = await getDocs(qEmail).catch(() => null);
          if (snapEmail && !snapEmail.empty) {
            for (const d of snapEmail.docs) {
              await updateDoc(doc(db, 'users', d.id), clearFields).catch(() => {});
            }
          }
        }

        // 3. Fallback update by Name (e.g. DEMO2)
        if (userName) {
          const qName = query(collection(db, 'users'), where('name', '==', userName.trim()));
          const snapName = await getDocs(qName).catch(() => null);
          if (snapName && !snapName.empty) {
            for (const d of snapName.docs) {
              await updateDoc(doc(db, 'users', d.id), clearFields).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.warn('Failed to clear location on sign out:', err);
      }
    }

    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
  } finally {
    sessionStorage.removeItem(USER_SESSION_KEY);
  }
};

/**
 * Gets the currently "signed-in" user from session storage.
 * @returns The user's profile object or null.
 */
export const getCurrentUser = (): WithId<Staff> | null => {
  try {
    const userJson = sessionStorage.getItem(USER_SESSION_KEY);
    if (userJson) {
      return JSON.parse(userJson);
    }
  } catch (error) {
    console.error('Could not retrieve user from session storage:', error);
  }

  // Return null if no authenticated user session is found
  return null;
};
