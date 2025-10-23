'use client';

import { useState, useEffect } from 'react';
import { Auth, onAuthStateChanged, User } from 'firebase/auth';
import { useAuth } from '@/firebase/provider'; // Import from the provider

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
  const { user, isUserLoading, userError } = useAuth();
  
  // Directly return the state from the context.
  // The FirebaseProvider is now the single source of truth for auth state.
  return { user, isLoading: isUserLoading, error: userError };
}
