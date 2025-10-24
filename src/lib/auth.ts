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
  const staffRef = doc(firestore, 'staff', user.uid); // staffドキュメントの参照も作成

  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) {
    const { email, photoURL } = user;
    const displayName = name || email?.split('@')[0] || 'New User';
    const createdAt = serverTimestamp();
    
    // ユーザープロファイルデータ
    const userProfileData = {
      uid: user.uid,
      displayName: displayName,
      email,
      photoURL,
      role: 'staff', // デフォルトの役割
      createdAt,
    };

    // スタッフデータ
    const staffData = {
      id: user.uid,
      name: displayName,
      email: email,
      role: 'staff',
      color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`, // ランダムな色を割り当て
    };

    try {
      // usersとstaffの両方にドキュメントを作成
      await setDoc(userRef, userProfileData);
      await setDoc(staffRef, staffData);
    } catch (error) {
      console.error("Error creating user profile and staff documents: ", error);
    }
  } else {
    // 既存ユーザーの場合、表示名が指定されていれば更新する
    if (name) {
        try {
            await updateDoc(userRef, { displayName: name });
            await updateDoc(staffRef, { name: name }); // staffドキュメントも更新
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
