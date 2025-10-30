'use client';

import { useUser } from '@/firebase';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { useMemo } from 'react';
import type { WithId, Staff } from '@/lib/types';

export function useUserProfile() {
  const { user, isUserLoading, userError } = useUser();
  const { allStaff, isLoading: isStaffLoading } = useSelectedStaff();

  const profile: WithId<Staff> | null = useMemo(() => {
    if (!user || !allStaff || allStaff.length === 0) {
      return null;
    }

    const staffProfile = allStaff.find(staff => staff.id === user.uid || staff.email === user.email);

    return {
      id: user.uid,
      name: staffProfile?.name || user.displayName || user.email || 'Unknown User',
      email: user.email,
      avatarUrl: staffProfile?.avatarUrl || user.photoURL || undefined,
      // Use role from the comprehensive staff list, default to 'staff'
      role: staffProfile?.role || 'staff',
      // Include other relevant details from staffProfile if they exist
      calendarId: staffProfile?.calendarId,
      color: staffProfile?.color,
      password: staffProfile?.password, // Note: sensitive data
    };
  }, [user, allStaff]);
  
  const isLoading = isUserLoading || isStaffLoading;

  return {
    profile,
    isLoading,
    error: userError,
    // These functions are now no-ops as auth is handled by Firebase.
    setProfile: () => {}, 
    clearProfile: () => {},
  };
}
