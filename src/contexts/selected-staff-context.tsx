
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Staff, WithId } from '@/lib/types';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { useUser } from '@/firebase/auth/use-user';
import { useUserProfile } from '@/hooks/use-user-profile';

const LOCAL_STORAGE_KEY = 'appliedStaffIds';

interface SelectedStaffContextType {
  pendingSelectedStaffIds: string[];
  appliedSelectedStaffIds: string[];
  allStaff: WithId<Staff>[];
  setAllStaff: (staff: WithId<Staff>[]) => void;
  togglePendingStaffSelection: (staffId: string) => void;
  setPendingSelection: (staffIds: string[]) => void;
  applyPendingSelection: () => void;
}

const SelectedStaffContext = createContext<SelectedStaffContextType | undefined>(undefined);

export function SelectedStaffProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { toast } = useToast();

  const isAdmin = profile?.role === 'admin';

  const staffCollectionRef = useMemoFirebase(
    () => (firestore && isAdmin && !isProfileLoading ? collection(firestore, 'staff') : null),
    [firestore, isAdmin, isProfileLoading]
  );
  
  const { data: staffFromHook } = useCollection<WithId<Staff>>(staffCollectionRef);

  const [allStaff, setAllStaff] = useState<WithId<Staff>[]>([]);
  const [pendingSelectedStaffIds, setPendingSelectedStaffIds] = useState<string[]>([]);
  const [appliedSelectedStaffIds, setAppliedSelectedStaffIds] = useState<string[]>([]);
  
  useEffect(() => {
    if (staffFromHook) {
       setAllStaff(staffFromHook);
    } else if (!isProfileLoading && !isAdmin) {
      // If the user is not an admin, 'allStaff' should just be their own profile
      if (profile) {
        const selfStaff: WithId<Staff> = {
            id: profile.uid,
            name: profile.displayName || 'Unknown',
            email: profile.email,
            role: profile.role
        };
        setAllStaff([selfStaff]);
      } else {
        setAllStaff([]);
      }
    }
  }, [staffFromHook, isAdmin, isProfileLoading, profile]);


  // On initial mount, load applied IDs from localStorage
  useEffect(() => {
    try {
      const savedIds = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedIds) {
        const parsedIds = JSON.parse(savedIds);
        setAppliedSelectedStaffIds(parsedIds);
        setPendingSelectedStaffIds(parsedIds);
      }
    } catch (error) {
        console.error("Failed to parse staff IDs from localStorage", error);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, []);

  const setAllStaffCb = useCallback((staff: WithId<Staff>[]) => {
    setAllStaff(staff);
    const hasBeenInitialized = localStorage.getItem(LOCAL_STORAGE_KEY) !== null;
    if (staff.length > 0 && !hasBeenInitialized) {
      const allStaffIds = staff.map(s => s.id);
      setAppliedSelectedStaffIds(allStaffIds);
      setPendingSelectedStaffIds(allStaffIds);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allStaffIds));
    }
  }, []);


  const togglePendingStaffSelection = (staffId: string) => {
    setPendingSelectedStaffIds(prevIds =>
      prevIds.includes(staffId)
        ? prevIds.filter(id => id !== staffId)
        : [...prevIds, staffId]
    );
  };
  
  const setPendingSelection = (staffIds: string[]) => {
    setPendingSelectedStaffIds(staffIds);
  };

  const applyPendingSelection = () => {
    setAppliedSelectedStaffIds(pendingSelectedStaffIds);
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(pendingSelectedStaffIds));
        toast({
            title: "スタッフ選択を更新しました",
            description: `${pendingSelectedStaffIds.length}人のスタッフが選択されました。`,
        });
    } catch (error) {
        console.error("Failed to save staff IDs to localStorage", error);
        toast({
            variant: "destructive",
            title: "保存エラー",
            description: "設定を保存できませんでした。",
        });
    }
  };

  const contextValue = {
    pendingSelectedStaffIds,
    appliedSelectedStaffIds,
    allStaff,
    setAllStaff: setAllStaffCb,
    togglePendingStaffSelection,
    setPendingSelection,
    applyPendingSelection,
  };

  return (
    <SelectedStaffContext.Provider value={contextValue}>
      {children}
    </SelectedStaffContext.Provider>
  );
}

export function useSelectedStaff() {
  const context = useContext(SelectedStaffContext);
  if (context === undefined) {
    throw new Error('useSelectedStaff must be used within a SelectedStaffProvider');
  }
  return context;
}
