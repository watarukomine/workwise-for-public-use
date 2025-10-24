'use client';

import { 
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

// This function should be called within a component or another client-side function.
const getAuthAndFirestore = () => {
  // Directly initialize and get auth and firestore instances.
  const { auth, firestore } = initializeFirebase();
  return { auth, firestore };
};

const createUserProfileDocument = async (user: User) => {
    const { firestore } = getAuthAndFirestore();
    if (!user.uid) return; // Add guard clause for user.uid
    const userRef = doc(firestore, 'users', user.uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
        const { displayName, email, photoURL } = user;
        const createdAt = serverTimestamp();
        
        try {
            await setDoc(userRef, {
                uid: user.uid,
                displayName,
                email,
                photoURL,
                role: 'staff', // Default role for new users
                createdAt,
            });
        } catch (error) {
            console.error("Error creating user profile document: ", error);
        }
    }
    // If the document already exists, do nothing.
    // Role escalation should be handled manually in the Firebase console or by a trusted admin function.
};


export const signIn = async () => {
  const { auth } = getAuthAndFirestore();
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    
    // Create a user profile document in Firestore if it doesn't exist
    await createUserProfileDocument(result.user);

  } catch (error: any) {
    // Specific check for 'auth/operation-not-allowed'
    if (error.code === 'auth/operation-not-allowed') {
        console.error("Google Sign-In is not enabled in the Firebase console. Please enable it in the 'Authentication' > 'Sign-in method' tab.");
        // We can throw a more specific error for the UI to catch
        throw new Error("GoogleログインがFirebaseプロジェクトで有効になっていません。");
    }
    console.error('Error signing in with Google: ', error);
    throw error;
  }
};

export const signOut = async () => {
  const { auth } = getAuthAndFirestore();
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out: ', error);
  }
};
