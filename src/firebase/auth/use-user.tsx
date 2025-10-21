
'use client';

import { useState, useEffect } from 'react';
import { Auth, onAuthStateChanged, User } from 'firebase/auth';
import { getAuthInstance } from '@/lib/auth';

/**
 * Interface for the return value of the useUser hook.
 */
export interface UseUserResult {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * React hook to get the current authenticated user from Firebase Auth.
 *
 * @param {Auth} auth - The Firebase Auth instance.
 * @returns {UseUserResult} Object with user, isLoading, and error.
 */
export function useUser(auth?: Auth): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const authInstance = auth || getAuthInstance();

  useEffect(() => {
    // Guard against auth being undefined on initial renders.
    if (!authInstance) {
      setIsLoading(false);
      return;
    }

    // Set up the real-time listener for authentication state changes.
    const unsubscribe = onAuthStateChanged(
      authInstance,
      (firebaseUser) => {
        setUser(firebaseUser);
        setIsLoading(false);
      },
      (authError) => {
        console.error("useUser: onAuthStateChanged error:", authError);
        setError(authError);
        setIsLoading(false);
      }
    );

    // Clean up the listener when the component unmounts.
    return () => unsubscribe();
  }, [authInstance]); // Re-run the effect if the auth instance changes.

  return { user, isLoading, error };
}
