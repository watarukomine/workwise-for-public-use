
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Staff, WithId } from '@/lib/types';
import { fetchGasData } from '@/app/actions/fetch-gas-data';
import { STAFF_GAS_URL } from '@/lib/settings';

const simpleHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; 
    }
    return Math.abs(hash);
};

const findKey = (item: any, possibleKeys: string[]) => {
    for (const key of possibleKeys) {
        const lowerKey = key.toLowerCase().trim();
        for (const itemKey in item) {
            if (itemKey.toLowerCase().trim() === lowerKey) {
                return item[itemKey];
            }
        }
    }
    return undefined;
};

export const fetchStaffDataFromGAS = async (): Promise<WithId<Staff>[]> => {
    const url = STAFF_GAS_URL;
    if (!url || url.includes('TODO_REPLACE_THIS_URL')) {
        console.log("スタッフ情報を取得するためのGoogle Apps Script URLが設定されていません。");
        throw new Error("スタッフ情報を取得するためのURLが /src/lib/settings.ts で設定されていません。");
    }

    try {
        const result = await fetchGasData(url);
        
        const dataToProcess = result.data || (Array.isArray(result) ? result : []);
        
        if (dataToProcess.length === 0) {
            return [];
        }

        return dataToProcess.map((item: any) => {
            const getRole = (): 'admin' | 'staff' => {
                const roleValue = findKey(item, ['権限', 'role', 'Role', 'ロール']);
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
                calendarId: findKey(item, ['calendarId', 'カレンダーID']),
                color: assignedColor || fallbackColor,
                avatarUrl: findKey(item, ['avatarUrl']) || '',
                area: findKey(item, ['エリア', 'area']),
                ...item
            };
        });

    } catch (error: any) {
        console.error('Error fetching staff data from GAS:', error);
        throw new Error(error.message || 'スプレッドシートからスタッフデータを取得できませんでした。');
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
  isLoading: boolean;
  error: string | null;
}

const SelectedStaffContext = createContext<SelectedStaffContextType | undefined>(undefined);

export function SelectedStaffProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  const [allStaff, setAllStaffState] = useState<WithId<Staff>[]>([]);
  const [pendingSelectedStaffIds, setPendingSelectedStaffIds] = useState<string[]>([]);
  const [appliedSelectedStaffIds, setAppliedSelectedStaffIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const LOCAL_STORAGE_KEY = 'appliedStaffIds';
  
  useEffect(() => {
    const loadStaff = async () => {
        setIsLoading(true);
        setError(null);
        if (!STAFF_GAS_URL || STAFF_GAS_URL.includes('TODO_REPLACE_THIS_URL')) {
            setError("スタッフ情報を取得するためのURLが設定されていません。「/src/lib/settings.ts」ファイルで設定してください。");
            setIsLoading(false);
            return;
        }
        try {
          const fetchedStaff = await fetchStaffDataFromGAS();
          setAllStaffState(fetchedStaff);

          if (fetchedStaff.length > 0) {
            const savedIds = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedIds) {
              const parsedIds = JSON.parse(savedIds);
              setAppliedSelectedStaffIds(parsedIds);
              setPendingSelectedStaffIds(parsedIds);
            } else {
              const allStaffIds = fetchedStaff.map(s => s.id);
              setAppliedSelectedStaffIds(allStaffIds);
              setPendingSelectedStaffIds(allStaffIds);
            }
          }

        } catch (e: any) {
          setError(`スタッフ情報の取得に失敗しました: ${e.message}`);
          console.error(e);
        } finally {
          setIsLoading(false);
        }
    };
    loadStaff();
  }, []); 


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

  const contextValue = {
    pendingSelectedStaffIds,
    appliedSelectedStaffIds,
    allStaff,
    setAllStaff,
    togglePendingStaffSelection,
    setPendingSelection,
    applyPendingSelection,
    isLoading: isLoading,
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
