'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Staff, WithId } from '@/lib/types';
import { useUserProfile } from '@/hooks/use-user-profile';
import { fetchStaffDataFromGAS } from '@/lib/auth'; // Import the fetch function

const LOCAL_STORAGE_KEY = 'appliedStaffIds';

interface SelectedStaffContextType {
  pendingSelectedStaffIds: string[];
  appliedSelectedStaffIds: string[];
  allStaff: WithId<Staff>[];
  setAllStaff: (staff: WithId<Staff>[]) => void;
  togglePendingStaffSelection: (staffId: string) => void;
  setPendingSelection: (staffIds: string[]) => void;
  applyPendingSelection: () => void;
  isLoading: boolean; // Add loading state
  error: string | null; // Add error state
}

const SelectedStaffContext = createContext<SelectedStaffContextType | undefined>(undefined);

export function SelectedStaffProvider({ children }: { children: ReactNode }) {
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { toast } = useToast();

  const [allStaff, setAllStaffState] = useState<WithId<Staff>[]>([]);
  const [pendingSelectedStaffIds, setPendingSelectedStaffIds] = useState<string[]>([]);
  const [appliedSelectedStaffIds, setAppliedSelectedStaffIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // This effect loads staff data from GAS when the user profile is available
  useEffect(() => {
    const loadStaff = async () => {
      if (profile && !isProfileLoading) {
        setIsLoading(true);
        setError(null);
        try {
          const fetchedStaff = await fetchStaffDataFromGAS();
          setAllStaffState(fetchedStaff);
        } catch (e: any) {
          setError("スタッフ情報の取得に失敗しました。");
          console.error(e);
        } finally {
          setIsLoading(false);
        }
      } else if (!isProfileLoading) {
        // If there's no profile and we are not loading, stop loading state.
        setIsLoading(false);
      }
    };
    loadStaff();
  }, [profile, isProfileLoading]);


  useEffect(() => {
    try {
      const savedIds = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedIds) {
        const parsedIds = JSON.parse(savedIds);
        setAppliedSelectedStaffIds(parsedIds);
        setPendingSelectedStaffIds(parsedIds);
      } else if (profile && profile.role !== 'admin' && allStaff.length > 0) {
          // For non-admins, default to only their own ID if not set
          setAppliedSelectedStaffIds([profile.id]);
          setPendingSelectedStaffIds([profile.id]);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([profile.id]));
      } else if (profile && profile.role === 'admin' && allStaff.length > 0) {
        // For admins, if nothing is set, default to all staff
        const allStaffIds = allStaff.map(s => s.id);
        setAppliedSelectedStaffIds(allStaffIds);
        setPendingSelectedStaffIds(allStaffIds);
      }
    } catch (error) {
        console.error("Failed to process staff IDs from localStorage", error);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, [profile, allStaff]);

  const setAllStaff = (staff: WithId<Staff>[]) => {
    setAllStaffState(staff);
  };

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
    isLoading: isLoading || isProfileLoading,
    error,
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
