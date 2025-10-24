
'use client';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { setDocWithContext } from '@/lib/mutations';

const getAuthAndFirestore = () => {
  const { auth, firestore } = initializeFirebase();
  return { auth, firestore };
};

const createStaffDocument = async (user: User, name: string) => {
  const { auth, firestore } = getAuthAndFirestore();
  if (!user.uid) return;

  const staffRef = doc(firestore, 'staff', user.uid);
  
  try {
    const staffSnapshot = await getDoc(staffRef);

    if (!staffSnapshot.exists()) {
      const { email, photoURL } = user;
      
      const staffData = {
        id: user.uid,
        name: name,
        email: email,
        photoURL: photoURL,
        role: 'staff',
        color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
        // createdAt is handled by setDocWithContext
      };

      // Use the new mutation function which handles contextual errors
      await setDocWithContext(staffRef, staffData, { merge: false });
      
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: name });
      }
    }
  } catch (error) {
    // This will now catch a wider range of issues, but the permission
    // error during setDoc is handled inside setDocWithContext.
    // We can re-throw or handle other types of errors here if needed.
    console.error("Error in createStaffDocument:", error);
    // Re-throwing the original error might be useful for debugging other issues.
    throw error;
  }
};


export const signUpWithEmail = async (email: string, password: string, name: string) => {
    const { auth } = getAuthAndFirestore();
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await createStaffDocument(userCredential.user, name);
        return userCredential;
    } catch(e: any) {
        // The error from createUserWithEmailAndPassword is an auth error, not a Firestore error.
        // It's okay to let it propagate as is for now, as it's already descriptive.
        // e.g., auth/email-already-in-use
        console.error("Sign up failed:", e.code);
        throw e;
    }
}

export const signInWithEmail = async (email: string, password: string) => {
    const { auth } = getAuthAndFirestore();
    return await signInWithEmailAndPassword(auth, email, password);
}

export const signOut = async () => {
  const { auth } = getAuthAndFirestore();
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out: ', error);
  }
};
