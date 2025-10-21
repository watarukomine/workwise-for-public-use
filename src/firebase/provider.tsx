'use client';

import React, { createContext, useContext, ReactNode, useMemo, DependencyList } from 'react';
import { Auth, User } from 'firebase/auth';
import { getFirebase } from '@/firebase'; // Import the new centralized getter
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { useUser as useAuthUserHook } from './auth/use-user';


// Combined state for the Firebase context
export interface FirebaseContextState {
  auth: Auth;
  user: User | null;
  isLoading: boolean;
  error: Error | null;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * FirebaseProvider manages and provides user authentication state.
 * Firebase services (app, auth, firestore) are now managed by getFirebase().
 */
export const FirebaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Extract the instances from the central getter inside the component.
  const { auth: authInstance } = getFirebase();
  const { user, isLoading, error } = useAuthUserHook(authInstance);

  const contextValue = useMemo(() => ({
    auth: authInstance, // Provide the singleton auth instance
    user,
    isLoading,
    error,
  }), [authInstance, user, isLoading, error]);

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

// Hooks to access context values are now in index.ts for better organization
export const useAuth = (): Auth => useFirebaseContext().auth;
export const useUser = () => {
    const { user, isLoading, error } = useFirebaseContext();
    return { user, isLoading, error };
};


// Memoization hook remains the same
type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}
