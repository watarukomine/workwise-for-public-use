
'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { WithId, Staff } from '@/lib/types';
import { useMemo } from 'react';

export function useUserProfile() {
  const { user, isUserLoading: isAuthLoading, userError } = useUser();
  const firestore = useFirestore();

  // Memoize the document reference to prevent re-renders
  const staffDocRef = useMemoFirebase(() => {
    if (user?.uid && firestore) {
      return doc(firestore, 'staff', user.uid);
    }
    return null;
  }, [user?.uid, firestore]);

  // Use the useDoc hook to get the profile data from Firestore
  const { data: staffData, isLoading: isProfileLoading, error: profileError } = useDoc<Staff>(staffDocRef);

  const profile: WithId<Staff> | null = useMemo(() => {
    if (!user) {
      return null;
    }
    
    // If we have data from Firestore, use it as the source of truth
    if (staffData) {
      return {
        id: user.uid,
        ...staffData,
        email: user.email, // Always take email from auth
        name: staffData.name || user.displayName || 'Unknown User', // Fallback name
      };
    }
    
    // If Firestore data is still loading or doesn't exist, provide a basic profile from auth
    return {
      id: user.uid,
      name: user.displayName || user.email || 'Unnamed User',
      email: user.email,
      role: 'staff', // Default role until Firestore data loads
    };

  }, [user, staffData]);
  
  const isLoading = isAuthLoading || (user && isProfileLoading);
  const error = userError || profileError;

  return {
    profile,
    isLoading,
    error,
  };
}
