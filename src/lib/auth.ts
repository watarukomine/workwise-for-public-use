'use client';

import { 
  Auth,
  GoogleAuthProvider, 
  signInWithPopup,
  signOut as firebaseSignOut
} from 'firebase/auth';


const provider = new GoogleAuthProvider();

export const signInWithGoogle = async (auth: Auth) => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Error signing in with Google: ', error);
  }
};

export const signOut = async (auth: Auth) => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out: ', error);
  }
};
