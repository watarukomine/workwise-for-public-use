'use client';

import { useUser } from '@/firebase';

// This hook now returns data from our simplified, mock authentication context.
export function useUserProfile() {
  const { user, isUserLoading, userError } = useUser();
  // This is a temporary adapter to maintain compatibility with the old profile structure.
  // In the future, components should be updated to use the Firebase User object directly.
  const profile = user
    ? {
        id: user.uid,
        name: user.displayName || user.email,
        email: user.email,
        avatarUrl: user.photoURL || undefined,
        // The 'role' will need to be fetched from Firestore.
        // For now, we'll assign a default role.
        role: 'staff' as 'admin' | 'staff',
      }
    : null;

  return {
    profile,
    isLoading: isUserLoading,
    error: userError,
    // These functions are now no-ops as auth is handled by Firebase.
    setProfile: () => {}, 
    clearProfile: () => {},
  };
}
