
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Staff, WithId } from '@/lib/types';
import { StaffService } from '@/services/staff-service';
import { useUser } from '@/firebase/provider';
import { isStaffMatched } from '@/lib/utils';

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
  togglePendingStaffSelection: (staffMemberOrId: any) => void;
  setPendingSelection: (staffIds: string[]) => void;
  applyPendingSelection: (activeStaffObjects?: any[]) => void;
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

  const LOCAL_STORAGE_SELECTION_KEY = 'workwise_staff_selection_v3'; // Single Source of Truth

  const initialLoadDone = useRef(false);
  const STAFF_CACHE_KEY = 'cached_staff_data_v3';

  // Persist selection with current Date tag
  useEffect(() => {
    if (initialLoadDone.current) {
      try {
        const today = new Date().toDateString();
        const payload = JSON.stringify({
          date: today,
          ids: appliedSelectedStaffIds
        });
        localStorage.setItem(LOCAL_STORAGE_SELECTION_KEY, payload);
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
        const parsed = JSON.parse(saved);
        const ids = Array.isArray(parsed) ? parsed : (parsed.ids || []);
        if (Array.isArray(ids) && ids.length > 0) {
          setAppliedSelectedStaffIds(ids);
          setPendingSelectedStaffIds(ids);
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

        // Initial selection setup: Default to ALL staff on fresh start/new day
        if (!initialLoadDone.current) {
          initialLoadDone.current = true;
          const saved = localStorage.getItem(LOCAL_STORAGE_SELECTION_KEY);
          let loadedIds: string[] = [];
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              const today = new Date().toDateString();
              if (parsed && parsed.date === today && Array.isArray(parsed.ids) && parsed.ids.length > 0) {
                loadedIds = parsed.ids;
              }
            } catch (e) {}
          }

          if (loadedIds.length > 0) {
            setAppliedSelectedStaffIds(loadedIds);
            setPendingSelectedStaffIds(loadedIds);
          } else {
            // デフォルト: 全スタッフを選択状態にする (全員チェックON & タイムライン表示)
            const allEntries: string[] = [];
            processedStaff.forEach(s => {
              if (s.id) allEntries.push(String(s.id).trim());
              if (s.name) allEntries.push(String(s.name).trim());
            });
            const defaultIds = Array.from(new Set(allEntries));
            setAppliedSelectedStaffIds(defaultIds);
            setPendingSelectedStaffIds(defaultIds);
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

  const togglePendingStaffSelection = React.useCallback((staffMemberOrId: any) => {
    if (!staffMemberOrId) return;
    const staffId = typeof staffMemberOrId === 'object' ? String(staffMemberOrId.id).trim() : String(staffMemberOrId).trim();
    
    setPendingSelectedStaffIds(prevIds => {
      const exists = prevIds.some(id => id === staffId || (typeof staffMemberOrId === 'object' && isStaffMatched(staffMemberOrId, [id])));
      if (exists) {
        return prevIds.filter(id => id !== staffId && (typeof staffMemberOrId === 'object' ? !isStaffMatched(staffMemberOrId, [id]) : true));
      } else {
        return [...prevIds, staffId];
      }
    });
  }, []);

  const setPendingSelection = React.useCallback((staffIds: string[]) => {
    setPendingSelectedStaffIds(staffIds);
  }, []);

  const applyPendingSelection = React.useCallback((activeStaffObjects: any[] = []) => {
    setAppliedSelectedStaffIds(() => {
      let finalIds = [...pendingSelectedStaffIds];

      // 【ユーザー絶対仕様】チェックが外されたスタッフにチップが貼られていないか確認
      // チップが貼られている場合はそのスタッフのチェックはつけたまま(強制保護)にする
      if (activeStaffObjects && activeStaffObjects.length > 0) {
        activeStaffObjects.forEach(activeStaff => {
          const isSelected = finalIds.some(selId => isStaffMatched(activeStaff, [selId]));
          if (!isSelected) {
            if (activeStaff.id) finalIds.push(String(activeStaff.id).trim());
            if (activeStaff.name) finalIds.push(String(activeStaff.name).trim());
            if (activeStaff['氏名']) finalIds.push(String(activeStaff['氏名']).trim());
            if (activeStaff['スタッフID']) finalIds.push(String(activeStaff['スタッフID']).trim());
          }
        });
      }

      const uniqueFinalIds = Array.from(new Set(finalIds));

      setPendingSelectedStaffIds(uniqueFinalIds);

      try {
        localStorage.setItem(LOCAL_STORAGE_SELECTION_KEY, JSON.stringify({
          date: new Date().toDateString(),
          ids: uniqueFinalIds
        }));
        toast({
          title: "選択を適用しました",
          description: `表示設定を更新・保存しました。`,
        });
      } catch (error) {
        console.error("Failed to save staff IDs to localStorage", error);
      }

      return uniqueFinalIds;
    });
  }, [pendingSelectedStaffIds, toast]);

  const setSelectedStaffIds = React.useCallback((idsOrFn: string[] | ((prev: string[]) => string[])) => {
    setAppliedSelectedStaffIds(prev => {
      const newIds = typeof idsOrFn === 'function' ? idsOrFn(prev) : idsOrFn;
      try {
        localStorage.setItem(LOCAL_STORAGE_SELECTION_KEY, JSON.stringify({
          date: new Date().toDateString(),
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
