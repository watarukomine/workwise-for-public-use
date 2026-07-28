
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
    try {
      const cachedUser = getCurrentUser();
      if (cachedUser) {
        setProfile(cachedUser);
      }
    } catch (e) {
      console.error('Failed to load profile from local storage:', e);
    } finally {
      setIsLoading(false);
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
