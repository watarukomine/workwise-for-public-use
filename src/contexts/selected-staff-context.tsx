'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Staff } from '@/lib/types';

interface SelectedStaffContextType {
  pendingSelectedStaffIds: string[];
  appliedSelectedStaffIds: string[];
  allStaff: Staff[];
  setAllStaff: (staff: Staff[]) => void;
  togglePendingStaffSelection: (staffId: string) => void;
  applyPendingSelection: () => void;
}

const SelectedStaffContext = createContext<SelectedStaffContextType | undefined>(undefined);

export function SelectedStaffProvider({ children }: { children: ReactNode }) {
  const [pendingSelectedStaffIds, setPendingSelectedStaffIds] = useState<string[]>([]);
  const [appliedSelectedStaffIds, setAppliedSelectedStaffIds] = useState<string[]>([]);
  const [allStaff, setAllStaffState] = useState<Staff[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    setPendingSelectedStaffIds(appliedSelectedStaffIds);
  }, [appliedSelectedStaffIds]);
  
  const setAllStaff = (staff: Staff[]) => {
    setAllStaffState(staff);
    // Initialize pending and applied selections with all staff IDs by default
    const allStaffIds = staff.map(s => s.id);
    setPendingSelectedStaffIds(allStaffIds);
    setAppliedSelectedStaffIds(allStaffIds);
  };

  const togglePendingStaffSelection = (staffId: string) => {
    setPendingSelectedStaffIds(prevIds =>
      prevIds.includes(staffId)
        ? prevIds.filter(id => id !== staffId)
        : [...prevIds, staffId]
    );
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
