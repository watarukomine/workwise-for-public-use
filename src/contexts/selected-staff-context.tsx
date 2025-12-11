
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Staff, WithId } from '@/lib/types';
import { fetchGasData } from '@/app/actions/fetch-gas-data';
import { STAFF_GAS_URL } from '@/lib/settings';
import { findKey } from '@/lib/utils';

const simpleHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
};

export const fetchStaffDataFromGAS = async (url: string = STAFF_GAS_URL): Promise<{ staffList?: WithId<Staff>[]; error?: string }> => {
  if (!url || url.includes('TODO_REPLACE_THIS_URL')) {
    const errorMessage = "スタッフ情報を取得するためのURLが /src/lib/settings.ts で設定されていません。";
    console.warn(errorMessage);
    return { error: errorMessage };
  }

  try {
    const result = await fetchGasData(url);

    if (result.error) {
      return { error: result.error };
    }

    const dataToProcess = result.data || [];

    if (dataToProcess.length === 0) {
      console.warn("GASから取得したスタッフデータが空です。");
      return { staffList: [] };
    }

    const staffList = dataToProcess.map((item: any): WithId<Staff> => {
      const getRole = (): 'admin' | 'staff' => {
        const roleValue = findKey(item, ['ロール', '権限', 'role', 'Role']);
        if (typeof roleValue === 'string' && roleValue.toLowerCase() === 'admin') {
          return 'admin';
        }
        return 'staff';
      };

      const staffId = String(findKey(item, ['id', 'ID', 'スタッフID']) || `gas-staff-${Math.random()}`);

      const assignedColor = findKey(item, ['color', 'カラー']);
      const fallbackColor = `hsl(${simpleHash(staffId) % 360}, 70%, 60%)`;

      return {
        id: staffId,
        name: findKey(item, ['スタッフ名', 'name']) || 'No Name',
        email: findKey(item, ['メールアドレス', 'email']) || '',
        password: findKey(item, ['パスワード', 'password', 'Password']) || '',
        role: getRole(),
        color: assignedColor || fallbackColor,
        avatarUrl: findKey(item, ['avatarUrl']) || '',
        calendarId: findKey(item, ['calendarId', 'カレンダーID']),
        '母店': findKey(item, ['母店']),
        ...item
      };
    });
    return { staffList };

  } catch (error: any) {
    console.error('Error fetching staff data from GAS:', error);
    return { error: error.message };
  }
};

interface SelectedStaffContextType {
  pendingSelectedStaffIds: string[];
  appliedSelectedStaffIds: string[];
  allStaff: WithId<Staff>[];
  setAllStaff: (staff: WithId<Staff>[]) => void;
  togglePendingStaffSelection: (staffId: string) => void;
  setPendingSelection: (staffIds: string[]) => void;
  applyPendingSelection: () => void;
  setSelectedStaffIds: (ids: string[]) => void; // New method for direct update
  isLoading: boolean;
  error: string | null;
  staffGasUrl: string;
  setStaffGasUrl: (url: string) => void;
}

const SelectedStaffContext = createContext<SelectedStaffContextType | undefined>(undefined);

export function SelectedStaffProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  const [allStaff, setAllStaffState] = useState<WithId<Staff>[]>([]);
  const [pendingSelectedStaffIds, setPendingSelectedStaffIds] = useState<string[]>([]);
  const [appliedSelectedStaffIds, setAppliedSelectedStaffIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize with default, will update from localStorage in useEffect
  const [staffGasUrl, setStaffGasUrlState] = useState(STAFF_GAS_URL);

  const LOCAL_STORAGE_KEY = 'appliedStaffIds';
  const URL_STORAGE_KEY = 'custom_staff_gas_url';

  const initialLoadDone = useRef(false);
  const STAFF_CACHE_KEY = 'cached_staff_data';

  const setStaffGasUrl = (url: string) => {
    setStaffGasUrlState(url);
    try {
      localStorage.setItem(URL_STORAGE_KEY, url);
    } catch (e) {
      console.warn('Failed to save staff GAS URL to localStorage:', e);
    }
  };

  useEffect(() => {
    // Load saved URL from localStorage
    try {
      const savedUrl = localStorage.getItem(URL_STORAGE_KEY);
      if (savedUrl) {
        setStaffGasUrlState(savedUrl);
      }
    } catch (e) {
      console.warn('Failed to load saved URL:', e);
    }
  }, []);

  useEffect(() => {
    // Rely on effect dependency to reload when staffGasUrl changes
    // But verify if we need to reset initialLoadDone or just call loadStaff directly

    // We can't rely strictly on initialLoadDone ref if we want to support URL updates triggering re-fetch
    // So we reset it or just allow re-fetching

    const loadStaff = async () => {
      setError(null);
      setIsLoading(true);

      const currentUrl = staffGasUrl;

      if (!currentUrl || currentUrl.includes('TODO_REPLACE_THIS_URL')) {
        setError("スタッフ情報を取得するためのURLが設定されていません。「/src/lib/settings.ts」ファイルで設定してください。");
        setIsLoading(false);
        return;
      }

      // Step 1: Load cached data immediately (optimistic)
      if (!initialLoadDone.current) {
        try {
          const cachedData = localStorage.getItem(STAFF_CACHE_KEY);
          if (cachedData) {
            const { staffList: cachedStaff, timestamp } = JSON.parse(cachedData);
            if (cachedStaff && cachedStaff.length > 0) {
              setAllStaffState(cachedStaff);

              const savedIds = localStorage.getItem(LOCAL_STORAGE_KEY);
              if (savedIds) {
                const parsedIds = JSON.parse(savedIds);
                setAppliedSelectedStaffIds(parsedIds);
                setPendingSelectedStaffIds(parsedIds);
              } else {
                const allStaffIds = cachedStaff.map((s: WithId<Staff>) => s.id);
                setAppliedSelectedStaffIds(allStaffIds);
                setPendingSelectedStaffIds(allStaffIds);
              }
              // Show UI immediately with cached data
              setIsLoading(false);
            }
          }
        } catch (e) {
          console.warn('Failed to load cached staff data:', e);
        }
        initialLoadDone.current = true;
      }

      // Step 2: Fetch fresh data in background (or foreground if URL changed)
      try {
        if (allStaff.length === 0) setIsLoading(true);

        const { staffList, error: fetchError } = await fetchStaffDataFromGAS(currentUrl);

        if (fetchError) {
          if (allStaff.length === 0) {
            throw new Error(fetchError);
          } else {
            console.warn('Background refresh failed, using cached data:', fetchError);
          }
        }

        if (staffList && staffList.length > 0) {
          setAllStaffState(staffList);

          // Cache the fresh data
          try {
            localStorage.setItem(STAFF_CACHE_KEY, JSON.stringify({
              staffList,
              timestamp: Date.now()
            }));
          } catch (e) {
            console.warn('Failed to cache staff data:', e);
          }

          // Update selection if no selection exists
          if (appliedSelectedStaffIds.length === 0) {
            const savedIds = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedIds) {
              const parsedIds = JSON.parse(savedIds);
              setAppliedSelectedStaffIds(parsedIds);
              setPendingSelectedStaffIds(parsedIds);
            } else {
              const allStaffIds = staffList.map(s => s.id);
              setAppliedSelectedStaffIds(allStaffIds);
              setPendingSelectedStaffIds(allStaffIds);
            }
          }
        }

      } catch (e: any) {
        if (allStaff.length === 0) {
          setError(`スタッフ情報の取得に失敗しました: ${e.message}`);
        }
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    loadStaff();
  }, [staffGasUrl]); // Re-run when URL changes


  const setAllStaff = (staff: WithId<Staff>[]) => {
    setAllStaffState(staff);
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

  const setSelectedStaffIds = (ids: string[]) => {
    setAppliedSelectedStaffIds(ids);
    setPendingSelectedStaffIds(ids);
    // We update local storage silently to keep state consistent across reloads
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(ids));
    } catch (e) {
      console.warn('Failed to save staff IDs to localStorage', e);
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
    setSelectedStaffIds,
    isLoading: isLoading,
    error,
    staffGasUrl,
    setStaffGasUrl,
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
