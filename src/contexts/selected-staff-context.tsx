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
  currentDateStr: string;
  setCurrentDateStr: (dateStr: string) => void;
  setAllStaff: (staff: WithId<Staff>[]) => void;
  togglePendingStaffSelection: (staffId: string) => void;
  setPendingSelection: (staffIds: string[]) => void;
  applyPendingSelection: (targetDateStr?: string) => void;
  clearDateSelection: (targetDateStr?: string) => void;
  setSelectedStaffIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  isLoading: boolean;
  isStaffLoading: boolean;
  error: string | null;
}

const SelectedStaffContext = createContext<SelectedStaffContextType | undefined>(undefined);

export function SelectedStaffProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();

  const [allStaff, setAllStaffState] = useState<WithId<Staff>[]>([]);
  const [currentDateStr, setCurrentDateStr] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('dashboard_current_date');
      if (saved) return saved.slice(0, 10);
    }
    const today = new Date();
    const yr = today.getFullYear();
    const mo = String(today.getMonth() + 1).padStart(2, '0');
    const dy = String(today.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  });

  // 日付ごとの手動選択マップ { [dateStr: string]: string[] }
  const [selectionsByDate, setSelectionsByDate] = useState<Record<string, string[]>>({});
  const [pendingSelectedStaffIds, setPendingSelectedStaffIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const LOCAL_STORAGE_DATE_SELECTION_KEY = 'workwise_staff_selection_by_date_v1';
  const STAFF_CACHE_KEY = 'cached_staff_data_v4';
  const initialLoadDone = useRef(false);

  // Restore date-specific selections on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_DATE_SELECTION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setSelectionsByDate(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to restore date selections:', e);
    }
  }, []);

  const appliedSelectedStaffIds = React.useMemo(() => {
    return selectionsByDate[currentDateStr] || [];
  }, [selectionsByDate, currentDateStr]);

  // Sync pendingSelection with active date appliedSelection when currentDateStr changes
  useEffect(() => {
    setPendingSelectedStaffIds(selectionsByDate[currentDateStr] || []);
  }, [currentDateStr, selectionsByDate]);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      setIsLoading(false);
      return;
    }

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
      } catch (e) {}
    }

    console.log('[SelectedStaffContext] Subscribing to realtime staff updates...');
    const unsubscribe = StaffService.subscribeToStaff((staffList) => {
      if (staffList && staffList.length > 0) {
        const processedStaff = staffList.map(s => ({
          ...s,
          name: s.name || (s as any)['氏名'] || (s as any)['名前'] || (s as any)['担当'] || '名前未設定',
          color: s.color || `hsl(${simpleHash(s.id) % 360}, 70%, 60%)`,
        }));

        setAllStaffState(processedStaff);

        try {
          localStorage.setItem(STAFF_CACHE_KEY, JSON.stringify({
            staffList: processedStaff,
            timestamp: Date.now()
          }));
        } catch (e) {}
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
    if (!staffId) return;
    const cleanId = String(staffId).trim();
    setPendingSelectedStaffIds(prevIds =>
      prevIds.includes(cleanId)
        ? prevIds.filter(id => id !== cleanId)
        : [...prevIds, cleanId]
    );
  }, []);

  const setPendingSelection = React.useCallback((staffIds: string[]) => {
    setPendingSelectedStaffIds(staffIds);
  }, []);

  const applyPendingSelection = React.useCallback((targetDateStr?: string) => {
    const activeDate = targetDateStr || currentDateStr;
    setSelectionsByDate(prev => {
      const nextMap = { ...prev, [activeDate]: pendingSelectedStaffIds };
      try {
        localStorage.setItem(LOCAL_STORAGE_DATE_SELECTION_KEY, JSON.stringify(nextMap));
      } catch (error) {
        console.error("Failed to save date selection to localStorage", error);
      }
      return nextMap;
    });

    toast({
      title: "選択を適用しました",
      description: `${activeDate} の表示設定 (${pendingSelectedStaffIds.length}名) を更新しました。`,
    });
  }, [currentDateStr, pendingSelectedStaffIds, toast]);

  const clearDateSelection = React.useCallback((targetDateStr?: string) => {
    const activeDate = targetDateStr || currentDateStr;
    setSelectionsByDate(prev => {
      const nextMap = { ...prev };
      delete nextMap[activeDate];
      try {
        localStorage.setItem(LOCAL_STORAGE_DATE_SELECTION_KEY, JSON.stringify(nextMap));
      } catch (error) {}
      return nextMap;
    });
    setPendingSelectedStaffIds([]);
    toast({
      title: "シフト通りにリセットしました",
      description: `${activeDate} の選択を解除し、シフト通りの表示に戻しました。`,
    });
  }, [currentDateStr, toast]);

  const setSelectedStaffIds = React.useCallback((idsOrFn: string[] | ((prev: string[]) => string[])) => {
    setSelectionsByDate(prev => {
      const currentIds = prev[currentDateStr] || [];
      const newIds = typeof idsOrFn === 'function' ? idsOrFn(currentIds) : idsOrFn;
      const nextMap = { ...prev, [currentDateStr]: newIds };
      try {
        localStorage.setItem(LOCAL_STORAGE_DATE_SELECTION_KEY, JSON.stringify(nextMap));
      } catch (e) {}
      return nextMap;
    });
    setPendingSelectedStaffIds(prev => {
      const newIds = typeof idsOrFn === 'function' ? idsOrFn(prev) : idsOrFn;
      return newIds;
    });
  }, [currentDateStr]);

  const contextValue = React.useMemo(() => ({
    pendingSelectedStaffIds,
    appliedSelectedStaffIds,
    allStaff,
    currentDateStr,
    setCurrentDateStr,
    setAllStaff,
    togglePendingStaffSelection,
    setPendingSelection,
    applyPendingSelection,
    clearDateSelection,
    setSelectedStaffIds,
    isLoading: isLoading,
    isStaffLoading: isLoading,
    error,
  }), [
    pendingSelectedStaffIds,
    appliedSelectedStaffIds,
    allStaff,
    currentDateStr,
    setCurrentDateStr,
    setAllStaff,
    togglePendingStaffSelection,
    setPendingSelection,
    applyPendingSelection,
    clearDateSelection,
    setSelectedStaffIds,
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
