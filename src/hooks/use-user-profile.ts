
'use client';

import { useContext } from 'react';
import { UserProfileContext } from '@/contexts/user-profile-provider';

// This hook now returns data from our simplified, mock authentication context.
export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
}
