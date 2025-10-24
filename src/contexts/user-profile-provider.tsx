
'use client';

import React, { createContext, ReactNode } from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useDoc } from '@/firebase/firestore/use-doc';
import type { Staff } from '@/lib/types'; // Changed from UserProfile to Staff
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { doc, DocumentReference } from 'firebase/firestore';

interface UserProfileContextType {
  profile: Staff | null; // Changed from UserProfile to Staff
  isLoading: boolean;
  error: Error | null;
}

export const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: isUserLoading, error: userError } = useUser();
  const firestore = useFirestore();

  // Create a document reference to the 'staff' collection instead of 'users'
  const staffProfileRef = useMemoFirebase(() => {
    if (firestore && user?.uid) {
      // Point to the 'staff' collection with the user's UID
      return doc(firestore, 'staff', user.uid) as DocumentReference<Staff>;
    }
    return null;
  }, [firestore, user?.uid]);

  // Use the useDoc hook to fetch the profile data from the 'staff' collection
  const { data: profile, isLoading: isProfileLoading, error: profileError } = useDoc<Staff>(staffProfileRef);

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

    