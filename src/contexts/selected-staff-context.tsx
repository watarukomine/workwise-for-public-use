'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Staff } from '@/lib/types';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';

const LOCAL_STORAGE_KEY = 'appliedStaffIds';

interface SelectedStaffContextType {
  pendingSelectedStaffIds: string[];
  appliedSelectedStaffIds: string[];
  allStaff: Staff[];
  setAllStaff: (staff: Staff[]) => void;
  togglePendingStaffSelection: (staffId: string) => void;
  setPendingSelection: (staffIds: string[]) => void;
  applyPendingSelection: () => void;
}

const SelectedStaffContext = createContext<SelectedStaffContextType | undefined>(undefined);

export function SelectedStaffProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const staffCollectionRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'staff') : null),
    [firestore]
  );
  const { data: staffFromHook } = useCollection<Staff>(staffCollectionRef);

  const [allStaff, setAllStaffState] = useState<Staff[]>([]);
  const [pendingSelectedStaffIds, setPendingSelectedStaffIds] = useState<string[]>([]);
  const [appliedSelectedStaffIds, setAppliedSelectedStaffIds] = useState<string[]>([]);
  
  useEffect(() => {
    if (staffFromHook) {
       setAllStaffState(staffFromHook);
    }
  }, [staffFromHook]);


  // On initial mount, load applied IDs from localStorage
  useEffect(() => {
    try {
      const savedIds = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedIds) {
        const parsedIds = JSON.parse(savedIds);
        setAppliedSelectedStaffIds(parsedIds);
        setPendingSelectedStaffIds(parsedIds); // Sync pending with applied on initial load
      }
    } catch (error) {
        console.error("Failed to parse staff IDs from localStorage", error);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, []);

  // When allStaff list is populated for the first time (and nothing is in localStorage)
  useEffect(() => {
    const hasBeenInitialized = localStorage.getItem(LOCAL_STORAGE_KEY) !== null;
    if (allStaff.length > 0 && !hasBeenInitialized) {
      const allStaffIds = allStaff.map(s => s.id);
      setAppliedSelectedStaffIds(allStaffIds);
      setPendingSelectedStaffIds(allStaffIds);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allStaffIds));
    }
  }, [allStaff]);
  
  const setAllStaff = useCallback((staff: Staff[]) => {
    setAllStaffState(staff);
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
    setAllStaff,
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
