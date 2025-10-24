
'use client';

import React, { createContext, ReactNode } from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useDoc } from '@/firebase/firestore/use-doc';
import type { UserProfile } from '@/lib/types';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { doc, DocumentReference } from 'firebase/firestore';

interface UserProfileContextType {
  profile: UserProfile | null;
  isLoading: boolean;
  error: Error | null;
}

export const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: isUserLoading, error: userError } = useUser();
  const firestore = useFirestore();

  // Create a document reference only when the user ID is available.
  const userProfileRef = useMemoFirebase(() => {
    if (firestore && user?.uid) {
      return doc(firestore, 'users', user.uid) as DocumentReference<UserProfile>;
    }
    // Return null if firestore or user is not available
    return null;
  }, [firestore, user?.uid]);

  // Use the useDoc hook to fetch the profile data.
  // The hook is designed to handle null references gracefully.
  const { data: profile, isLoading: isProfileLoading, error: profileError } = useDoc<UserProfile>(userProfileRef);

  const value = {
    profile: profile || null,
    isLoading: isUserLoading || isProfileLoading,
    error: userError || profileError,
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}
