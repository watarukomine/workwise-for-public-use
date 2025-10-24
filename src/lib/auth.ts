
'use client';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type Auth,
  type User,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

const getAuthAndFirestore = () => {
  const { auth, firestore } = initializeFirebase();
  return { auth, firestore };
};

const createStaffDocument = async (user: User, name: string) => {
  const { firestore } = getAuthAndFirestore();
  if (!user.uid) return;

  const staffRef = doc(firestore, 'staff', user.uid);
  const staffSnapshot = await getDoc(staffRef);

  if (!staffSnapshot.exists()) {
    const { email, photoURL } = user;
    const createdAt = serverTimestamp();
    
    // The new unified staff data
    const staffData = {
      id: user.uid,
      name: name,
      email: email,
      photoURL: photoURL,
      role: 'staff', // Default role for new sign-ups
      color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
      createdAt,
    };

    try {
      await setDoc(staffRef, staffData);
      // Also update the auth user profile's displayName
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: name });
      }
    } catch (error) {
      console.error("Error creating staff document: ", error);
    }
  }
};


export const signUpWithEmail = async (email: string, password: string, name: string) => {
    const { auth } = getAuthAndFirestore();
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await createStaffDocument(userCredential.user, name);
    return userCredential;
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

    