
'use client';

import React, { createContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { getCurrentUser, signOut as authSignOut } from '@/lib/auth';
import type { Staff, WithId } from '@/lib/types';

interface UserProfileContextType {
  profile: WithId<Staff> | null;
  isLoading: boolean;
  error: Error | null;
  setProfile: (user: WithId<Staff>) => void;
  clearProfile: () => void;
}

export const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<WithId<Staff> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // On mount, check if there is a user session in localStorage.
    const user = getCurrentUser();
    setProfileState(user);
    setIsLoading(false);
  }, []);

  const setProfile = useCallback((user: WithId<Staff>) => {
    setProfileState(user);
  }, []);

  const clearProfile = useCallback(() => {
    authSignOut(); // This clears the localStorage
    setProfileState(null);
  }, []);


  const value = {
    profile,
    isLoading,
    error: null, // No real error handling in this mock implementation
    setProfile,
    clearProfile,
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}
