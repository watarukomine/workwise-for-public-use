
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Staff, WithId } from '@/lib/types';
// Removed direct import of staffData, as it will be fetched dynamically.
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
  const { profile } = useUserProfile();
  const { toast } = useToast();

  const [allStaff, setAllStaff] = useState<WithId<Staff>[]>([]);
  const [pendingSelectedStaffIds, setPendingSelectedStaffIds] = useState<string[]>([]);
  const [appliedSelectedStaffIds, setAppliedSelectedStaffIds] = useState<string[]>([]);
  
  // This effect now primarily loads saved selections from localStorage.
  // The initial setting of staff data will happen in pages that fetch it.
  useEffect(() => {
    try {
      const savedIds = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedIds) {
        const parsedIds = JSON.parse(savedIds);
        setAppliedSelectedStaffIds(parsedIds);
        setPendingSelectedStaffIds(parsedIds);
      } else if (profile && profile.role !== 'admin') {
          // For non-admins, default to only their own ID
          setAppliedSelectedStaffIds([profile.id]);
          setPendingSelectedStaffIds([profile.id]);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([profile.id]));
      }
    } catch (error) {
        console.error("Failed to process staff IDs from localStorage", error);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, [profile]);

  const togglePendingStaffSelection = (staffId: string) => {
    if (profile?.role !== 'admin') {
        toast({ title: "権限エラー", description: "スタッフの選択は管理者のみ可能です。", variant: "destructive" });
        return;
    }
    setPendingSelectedStaffIds(prevIds =>
      prevIds.includes(staffId)
        ? prevIds.filter(id => id !== staffId)
        : [...prevIds, staffId]
    );
  };
  
  const setPendingSelection = (staffIds: string[]) => {
    if (profile?.role !== 'admin') return;
    setPendingSelectedStaffIds(staffIds);
  };

  const applyPendingSelection = () => {
    if (profile?.role !== 'admin') return;
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
