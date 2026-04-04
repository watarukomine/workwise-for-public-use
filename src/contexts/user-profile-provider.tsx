
'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import type { Staff, WithId } from '@/lib/types';
import { getCurrentUser } from '@/lib/auth';
import { initializeFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

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
    // Safety timeout to ensure loading doesn't stick forever
    const timeoutId = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    const syncProfile = async () => {
      try {
        const cachedUser = getCurrentUser();
        if (cachedUser) {
          // Initialize Firebase to get Firestore
          const { firestore } = initializeFirebase();
          const userDocRef = doc(firestore, 'users', cachedUser.id);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const latestProfile = { ...userDoc.data() as Staff, id: userDoc.id };
            handleSetProfile(latestProfile);
          } else {
            setProfile(cachedUser);
          }
        }
      } catch (e) {
        console.error('Failed to sync profile with Firestore:', e);
        // Fallback to cached user if available
        const cachedUser = getCurrentUser();
        if (cachedUser) setProfile(cachedUser);
      } finally {
        setIsLoading(false);
        clearTimeout(timeoutId);
      }
    };

    syncProfile();
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
