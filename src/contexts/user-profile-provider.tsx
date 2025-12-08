
'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import type { Staff, WithId } from '@/lib/types';
import { getCurrentUser } from '@/lib/auth';

interface UserProfileContextType {
  profile: WithId<Staff> | null;
  isLoading: boolean;
  error: Error | null;
  setProfile: (user: WithId<Staff> | null) => void;
  clearProfile: () => void;
}

export const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<WithId<Staff> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Safety timeout to ensure loading doesn't stick forever (e.g. if localStorage access fails silently)
    const timeoutId = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    try {
      // On initial load, try to get the user from session storage
      const user = getCurrentUser();
      if (user) {
        setProfile(user);
      }
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load user profile'));
    } finally {
      setIsLoading(false);
      clearTimeout(timeoutId);
    }
  }, []);

  const handleSetProfile = (user: WithId<Staff> | null) => {
    setProfile(user);
    if (user) {
      sessionStorage.setItem('workwise-user-profile', JSON.stringify(user));
    } else {
      sessionStorage.removeItem('workwise-user-profile');
    }
  };

  const clearProfile = () => {
    handleSetProfile(null);
  };

  const value: UserProfileContextType = {
    profile,
    isLoading,
    error,
    setProfile: handleSetProfile,
    clearProfile,
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}
