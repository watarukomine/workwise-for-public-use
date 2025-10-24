
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
  const [pendingSelectedStaffIds, setPendingSelectedStaffIds] = useState<string[]>([]);
  const [appliedSelectedStaffIds, setAppliedSelectedStaffIds] = useState<string[]>(() => {
    // On initial client-side load, try to get the IDs from localStorage.
    if (typeof window !== 'undefined') {
      const savedIds = localStorage.getItem(LOCAL_STORAGE_KEY);
      return savedIds ? JSON.parse(savedIds) : [];
    }
    return [];
  });
  const [allStaff, setAllStaffState] = useState<Staff[]>([]);
  const { toast } = useToast();

  // This effect runs when appliedSelectedStaffIds changes.
  useEffect(() => {
    // 1. Update pending selections to match the newly applied ones.
    setPendingSelectedStaffIds(appliedSelectedStaffIds);
    // 2. Persist the applied IDs to localStorage.
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(appliedSelectedStaffIds));
    }
  }, [appliedSelectedStaffIds]);
  
  const setAllStaff = (staff: Staff[]) => {
    setAllStaffState(staff);

    // This initialization should only happen if there's nothing in localStorage
    if (typeof window !== 'undefined') {
        const savedIds = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!savedIds && staff.length > 0) {
            const allStaffIds = staff.map(s => s.id);
            // Set both pending and applied, which will trigger the useEffect to save to localStorage
            setPendingSelectedStaffIds(allStaffIds);
            setAppliedSelectedStaffIds(allStaffIds);
        } else if (savedIds) {
            // If there are saved IDs, ensure pending state matches on first load with staff data.
            setPendingSelectedStaffIds(JSON.parse(savedIds));
        }
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
