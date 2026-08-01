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
  const [pendingSelectedStaffIds, setPendingSelectedStaffIds] = useState<string[]>([]);
  const [appliedSelectedStaffIds, setAppliedSelectedStaffIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const LOCAL_STORAGE_SELECTION_KEY = 'workwise_staff_selection_v3';
  const STAFF_CACHE_KEY = 'cached_staff_data_v3';
  const initialLoadDone = useRef(false);

  // Restore selection on mount
  useEffect(() => {
    try {
      // 過去の古い競合キーを完全に一掃・クリア
      localStorage.removeItem('appliedStaffIds');
      localStorage.removeItem('workwise_staff_selection');

      const saved = localStorage.getItem(LOCAL_STORAGE_SELECTION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const ids = Array.isArray(parsed) ? parsed : (parsed.ids || []);
        if (Array.isArray(ids)) {
          // 【汚染データ自動クリーンアップ安全装置】
          // 過去のバグで保存されてしまった「全員選択（20名以上）」のゴミデータが残っている場合、
          // 一度強制的にリセット（クリア）してクリーンな初期状態にする
          if (ids.length >= 20) {
            localStorage.removeItem(LOCAL_STORAGE_SELECTION_KEY);
            setAppliedSelectedStaffIds([]);
            setPendingSelectedStaffIds([]);
          } else {
            setAppliedSelectedStaffIds(ids);
            setPendingSelectedStaffIds(ids);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to restore selection:', e);
    }
  }, []);

  useEffect(() => {
    if (isUserLoading || !user) {
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

        if (!initialLoadDone.current) {
          initialLoadDone.current = true;
          const saved = localStorage.getItem(LOCAL_STORAGE_SELECTION_KEY);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              const ids = Array.isArray(parsed) ? parsed : (parsed?.ids || []);
              if (Array.isArray(ids)) {
                setAppliedSelectedStaffIds(ids);
                setPendingSelectedStaffIds(ids);
              }
            } catch (e) {}
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

  const applyPendingSelection = React.useCallback(() => {
    setAppliedSelectedStaffIds(pendingSelectedStaffIds);
    try {
      localStorage.setItem(LOCAL_STORAGE_SELECTION_KEY, JSON.stringify({
        ids: pendingSelectedStaffIds
      }));
      toast({
        title: "選択を適用しました",
        description: `${pendingSelectedStaffIds.length}名の表示設定を更新しました。`,
      });
    } catch (error) {
      console.error("Failed to save staff IDs to localStorage", error);
    }
  }, [pendingSelectedStaffIds, toast]);

  const setSelectedStaffIds = React.useCallback((idsOrFn: string[] | ((prev: string[]) => string[])) => {
    setAppliedSelectedStaffIds(prev => {
      const newIds = typeof idsOrFn === 'function' ? idsOrFn(prev) : idsOrFn;
      try {
        localStorage.setItem(LOCAL_STORAGE_SELECTION_KEY, JSON.stringify({
          ids: newIds
        }));
      } catch (e) {}
      return newIds;
    });
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
    setAllStaff,
    togglePendingStaffSelection,
    setPendingSelection,
    applyPendingSelection,
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
