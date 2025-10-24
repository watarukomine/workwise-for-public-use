'use client';

import { useFirebase } from '@/firebase/provider'; 
import type { User } from 'firebase/auth';

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
 * It leverages the user state managed by the FirebaseProvider.
 *
 * @returns {UseUserResult} Object with user, isLoading, and error.
 */
export function useUser(): UseUserResult {
  const { user, isUserLoading, userError } = useFirebase();
  
  // Directly return the state from the context.
  // The FirebaseProvider is now the single source of truth for auth state.
  return { user, isLoading: isUserLoading, error: userError };
}

    