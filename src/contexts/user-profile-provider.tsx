
'use client';

import React, { createContext, ReactNode, useState, useEffect } from 'react';
import { getCurrentUser } from '@/lib/auth';
import type { Staff, WithId } from '@/lib/types';

interface UserProfileContextType {
  profile: WithId<Staff> | null;
  isLoading: boolean;
  error: Error | null; // Errors are not expected in this mock setup but kept for type consistency.
}

export const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<WithId<Staff> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // On mount, check if there is a user session in localStorage.
    const user = getCurrentUser();
    setProfile(user);
    setIsLoading(false);
  }, []);

  const value = {
    profile: profile,
    isLoading: isLoading,
    error: null, // No real error handling in this mock implementation
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}
