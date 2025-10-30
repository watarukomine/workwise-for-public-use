// This file is no longer used and its functionality has been replaced by the
// FirebaseProvider and the useUser hook. It is kept to prevent import errors
// in other parts of the application that have not yet been updated.

'use client';

import React, { createContext, ReactNode } from 'react';
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
  const value: UserProfileContextType = {
    profile: null,
    isLoading: true,
    error: null,
    setProfile: () => {},
    clearProfile: () => {},
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}
