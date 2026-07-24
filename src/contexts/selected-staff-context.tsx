
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Staff, WithId } from '@/lib/types';
import { StaffService } from '@/services/staff-service';
import { useUser } from '@/firebase/provider';

const simpleHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
};

interface SelectedStaffContextType {
  pendingSelectedStaffIds: string[];
  appliedSelectedStaffIds: string[];
  allStaff: WithId<Staff>[];
  setAllStaff: (staff: WithId<Staff>[]) => void;
  togglePendingStaffSelection: (staffId: string) => void;
  setPendingSelection: (staffIds: string[]) => void;
  applyPendingSelection: () => void;
  setSelectedStaffIds: (ids: string[] | ((prev: string[]) => string[])) => void; // Support functional update
  isLoading: boolean;
  isStaffLoading: boolean;
  error: string | null;
}

const SelectedStaffContext = createContext<SelectedStaffContextType | undefined>(undefined);

export function SelectedStaffProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();

  const [allStaff, setAllStaffState] = useState<WithId<Staff>[]>([]);
  const [pendingSelectedStaffIds, setPendingSelectedStaffIds] = useState<string[]>([]);
  const [appliedSelectedStaffIds, setAppliedSelectedStaffIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const LOCAL_STORAGE_KEY = 'appliedStaffIds';
  const LOCAL_STORAGE_SELECTION_KEY = 'workwise_staff_selection'; // { date: string, ids: string[] }

  const initialLoadDone = useRef(false);
  const STAFF_CACHE_KEY = 'cached_staff_data_v2'; // Changed key to avoid conflict with old GAS data

  // Persist selection
  useEffect(() => {
    if (initialLoadDone.current && appliedSelectedStaffIds.length > 0) {
      try {
        const today = new Date().toDateString();
        localStorage.setItem(LOCAL_STORAGE_SELECTION_KEY, JSON.stringify({
          date: today,
          ids: appliedSelectedStaffIds
        }));
      } catch (e) {
        console.warn('Failed to save selection to localStorage:', e);
      }
    }
  }, [appliedSelectedStaffIds]);

  // Restore selection on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SELECTION_KEY);
      if (saved) {
        const { date, ids } = JSON.parse(saved);
        if (date === new Date().toDateString() && Array.isArray(ids) && ids.length > 0) {
          setAppliedSelectedStaffIds(ids);
          setPendingSelectedStaffIds(ids);
        }
      }
    } catch (e) {
      console.warn('Failed to restore selection:', e);
    }
  }, []);

  useEffect(() => {
    // Guard: skip if user is not authenticated or still loading
    if (isUserLoading || !user) {
      setIsLoading(false);
      return;
    }

    // Step 1: Load cached data immediately (optimistic)
    if (!initialLoadDone.current) {
      try {
        const cachedData = localStorage.getItem(STAFF_CACHE_KEY);
        if (cachedData) {
          const { staffList: cachedStaff } = JSON.parse(cachedData);
          if (cachedStaff && cachedStaff.length > 0) {
            setAllStaffState(cachedStaff);
            setIsLoading(false);
          }
        }
      } catch (e) {
        console.warn('Failed to load cached staff data:', e);
      }
    }

    // Step 2: Subscribe to Realtime Staff Updates from Firestore (onSnapshot)
    console.log('[SelectedStaffContext] Subscribing to realtime staff updates...');
    const unsubscribe = StaffService.subscribeToStaff((staffList) => {
      if (staffList && staffList.length > 0) {
        const processedStaff = staffList.map(s => ({
          ...s,
          name: s.name || (s as any)['氏名'] || (s as any)['名前'] || (s as any)['担当'] || '名前未設定',
          color: s.color || `hsl(${simpleHash(s.id) % 360}, 70%, 60%)`,
        }));

        setAllStaffState(processedStaff);

        // Cache fresh staff list
        try {
          localStorage.setItem(STAFF_CACHE_KEY, JSON.stringify({
            staffList: processedStaff,
            timestamp: Date.now()
          }));
        } catch (e) {}

        // Initial selection setup
        if (!initialLoadDone.current) {
          initialLoadDone.current = true;
          const savedIds = localStorage.getItem(LOCAL_STORAGE_KEY);
          if (savedIds) {
            try {
              const parsedIds = JSON.parse(savedIds);
              setAppliedSelectedStaffIds(parsedIds);
              setPendingSelectedStaffIds(parsedIds);
            } catch (e) {}
          } else {
            const allIds = processedStaff.map(s => s.id);
            setAppliedSelectedStaffIds(prev => prev.length === 0 ? allIds : prev);
            setPendingSelectedStaffIds(prev => prev.length === 0 ? allIds : prev);
          }
        }
      }
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [user, isUserLoading]);

  const setAllStaff = React.useCallback((staff: WithId<Staff>[]) => {
    setAllStaffState(staff);
  }, []);

  const togglePendingStaffSelection = React.useCallback((staffId: string) => {
    setPendingSelectedStaffIds(prevIds =>
      prevIds.includes(staffId)
        ? prevIds.filter(id => id !== staffId)
        : [...prevIds, staffId]
    );
  }, []);

  const setPendingSelection = React.useCallback((staffIds: string[]) => {
    setPendingSelectedStaffIds(staffIds);
  }, []);

  const applyPendingSelection = React.useCallback(() => {
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
  }, [pendingSelectedStaffIds, toast]);

  const setSelectedStaffIds = React.useCallback((idsOrFn: string[] | ((prev: string[]) => string[])) => {
    setAppliedSelectedStaffIds(prev => {
      const newIds = typeof idsOrFn === 'function' ? idsOrFn(prev) : idsOrFn;
      return newIds;
    });
    // Sync pending with applied
    setPendingSelectedStaffIds(prev => {
      const newIds = typeof idsOrFn === 'function' ? idsOrFn(prev) : idsOrFn;
      return newIds;
    });
  }, []);

  const contextValue = React.useMemo(() => ({
    pendingSelectedStaffIds,
    appliedSelectedStaffIds,
    allStaff,
    setAllStaff,
    togglePendingStaffSelection,
    setPendingSelection,
    applyPendingSelection,
    setSelectedStaffIds,
    isLoading: isLoading,
    isStaffLoading: isLoading,
    error,
  }), [
    pendingSelectedStaffIds,
    appliedSelectedStaffIds,
    allStaff,
    isLoading,
    error,
  ]);

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
