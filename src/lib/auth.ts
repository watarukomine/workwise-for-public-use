'use client';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

const getAuthAndFirestore = () => {
  const { auth, firestore } = initializeFirebase();
  return { auth, firestore };
};

const createUserProfileDocument = async (user: User, name?: string) => {
  const { firestore } = getAuthAndFirestore();
  if (!user.uid) return;
  const userRef = doc(firestore, 'users', user.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    const { email, photoURL } = user;
    const createdAt = serverTimestamp();
    try {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: name || email?.split('@')[0], // Use name from sign up form, or part of email
        email,
        photoURL,
        role: 'staff', // Default role for new users
        createdAt,
      });
    } catch (error) {
      console.error("Error creating user profile document: ", error);
    }
  } else {
    // If user exists, but maybe displayname is new
    if (name) {
        try {
            await updateDoc(userRef, { displayName: name });
        } catch (error) {
            console.error("Error updating display name: ", error);
        }
    }
  }
};


export const signUpWithEmail = async (email: string, password: string, name: string) => {
    const { auth } = getAuthAndFirestore();
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await createUserProfileDocument(userCredential.user, name);
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
