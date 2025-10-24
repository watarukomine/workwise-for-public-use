
'use client';

import { useContext } from 'react';
import { UserProfileContext } from '@/contexts/user-profile-provider';

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
}

    