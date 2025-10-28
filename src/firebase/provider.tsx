
'use client';
// This file is no longer used in the simplified mock auth flow.
// The UserProfileProvider now handles session state from localStorage.
// Keeping the file to avoid breaking imports, but it can be removed later.

import React, { createContext, useContext, ReactNode, DependencyList, useMemo } from 'react';

// Define a minimal context to avoid errors in components that still use these hooks.
const MockFirebaseContext = createContext<any>(undefined);

export const FirebaseProvider = ({ children }: { children: ReactNode }) => (
  <MockFirebaseContext.Provider value={{}}>
      {children}
  </MockFirebaseContext.Provider>
);

const throwError = () => {
  throw new Error("This Firebase hook should not be used in the current mock setup.");
};

export const useFirebase = () => ({});
export const useAuth = () => { throwError(); };
export const useFirestore = () => { throwError(); };
export const useFirebaseApp = () => { throwError(); };
export const useUser = () => ({ user: null, isUserLoading: true, userError: null });

// A mock implementation of useMemoFirebase to prevent crashes.
export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
}
