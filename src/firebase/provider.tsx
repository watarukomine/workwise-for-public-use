'use client';

import React, { createContext, useContext, ReactNode, useMemo, useState, useEffect, DependencyList } from 'react';
import { FirebaseApp, getApps, initializeApp, getApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged, getAuth } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

// Combined state for the Firebase context
export interface FirebaseContextState {
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  user: User | null;
  isLoading: boolean;
  error: Error | null;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * FirebaseProvider manages and provides Firebase services and user authentication state.
 */
export const FirebaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [firebaseApp, setFirebaseApp] = useState<FirebaseApp | null>(null);
  const [firestore, setFirestore] = useState<Firestore | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const authInstance = getAuth(app);
      const firestoreInstance = getFirestore(app);

      setFirebaseApp(app);
      setAuth(authInstance);
      setFirestore(firestoreInstance);

      const unsubscribe = onAuthStateChanged(
        authInstance,
        (firebaseUser) => {
          setUser(firebaseUser);
          setIsLoading(false);
        },
        (authError) => {
          console.error("FirebaseProvider: onAuthStateChanged error:", authError);
          setError(authError);
          setIsLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.error("Failed to initialize Firebase", e);
      setError(e as Error);
      setIsLoading(false);
    }
  }, []);

  const contextValue = useMemo(() => ({
    firebaseApp,
    firestore,
    auth,
    user,
    isLoading,
    error,
  }), [firebaseApp, firestore, auth, user, isLoading, error]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

const useFirebaseContext = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase hook must be used within a FirebaseProvider.');
  }
  return context;
};

export const useFirebaseApp = (): FirebaseApp | null => useFirebaseContext().firebaseApp;
export const useFirestore = (): Firestore | null => useFirebaseContext().firestore;
export const useAuth = (): Auth | null => useFirebaseContext().auth;
export const useUser = () => {
    const { user, isLoading, error } = useFirebaseContext();
    return { user, isLoading, error };
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}
