
'use client';
// This hook is disabled in the simplified mock auth flow.
// User state is now managed by useUserProfile via UserProfileProvider.
// This function is kept to prevent import errors but will not be executed.

import { useState } from 'react';
import type { User } from 'firebase/auth'; // Keep type for compatibility

export interface UseUserResult {
  user: any | null; // Use `any` as we are mocking
  isLoading: boolean;
  error: Error | null;
}

export function useUser(): UseUserResult {
  // Returns a mock state. The real user profile is in `useUserProfile`.
  return { user: null, isLoading: false, error: null };
}
