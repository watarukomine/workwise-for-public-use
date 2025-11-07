
'use client';

import { useContext } from 'react';
import { UserProfileContext } from '@/contexts/user-profile-provider';

/**
 * Hook to access the user's profile, loading state, and error state.
 * This data is managed by the UserProfileProvider and is based on session storage.
 */
export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
}
