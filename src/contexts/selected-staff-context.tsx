
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Staff } from '@/lib/types';

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
  const [allStaff, setAllStaffState] = useState<Staff[]>([]);
  const [pendingSelectedStaffIds, setPendingSelectedStaffIds] = useState<string[]>([]);
  const [appliedSelectedStaffIds, setAppliedSelectedStaffIds] = useState<string[]>([]);
  
  const { toast } = useToast();

  // On initial mount, load applied IDs from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedIds = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedIds) {
        const parsedIds = JSON.parse(savedIds);
        setAppliedSelectedStaffIds(parsedIds);
        setPendingSelectedStaffIds(parsedIds); // Sync pending with applied on initial load
      }
    }
  }, []);

  const setAllStaff = (staff: Staff[]) => {
    setAllStaffState(staff);
    
    // Initialize selection only if it hasn't been loaded from localStorage yet.
    if (typeof window !== 'undefined' && !localStorage.getItem(LOCAL_STORAGE_KEY)) {
      const allStaffIds = staff.map(s => s.id);
      setAppliedSelectedStaffIds(allStaffIds);
      setPendingSelectedStaffIds(allStaffIds);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allStaffIds));
    }
  };

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
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(pendingSelectedStaffIds));
    }
    toast({
      title: "スタッフ選択を更新しました",
      description: `${pendingSelectedStaffIds.length}人のスタッフが選択されました。`,
    });
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
