
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Staff, WithId } from '@/lib/types';
import { useUserProfile } from '@/hooks/use-user-profile';
import { fetchGasData } from '@/app/actions/fetch-gas-data';

// スタッフ用のGAS URLを保存するキーを明確に定義
const STAFF_GAS_URL_KEY = 'staffGasUrl';

// A simple hashing function to convert a string (like a staff ID) into a number.
const simpleHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
};

export const fetchStaffDataFromGAS = async (): Promise<WithId<Staff>[]> => {
    // localStorageからスタッフ専用のURLを取得
    const url = localStorage.getItem(STAFF_GAS_URL_KEY);
    if (!url) {
        console.log("スタッフ情報を取得するためのGoogle Apps Script URLが設定されていません。");
        return [];
    }

    try {
        const result = await fetchGasData(url);
        
        const dataToProcess = result.data || (Array.isArray(result) ? result : []);
        
        if (dataToProcess.length === 0) {
            return [];
        }

        return dataToProcess.map((item: any) => {
            const getRole = (): 'admin' | 'staff' => {
                const roleValue = item['権限'] || item['Role'] || item['ロール'];
                if (typeof roleValue === 'string' && roleValue.toLowerCase() === 'admin') {
                    return 'admin';
                }
                return 'staff';
            };

            const staffId = String(item['id'] || item['ID'] || item['スタッフID'] || `gas-staff-${Math.random()}`);
            
            // Generate a consistent color based on the staff ID hash as a fallback
            const fallbackColor = `hsl(${simpleHash(staffId) % 360}, 70%, 60%)`;

            return {
                id: staffId,
                name: item['スタッフ名'] || 'No Name',
                email: item['メールアドレス'] || '',
                role: getRole(),
                password: item['パスワード'] || 'password',
                // GASから取得したセルの背景色'color'を最優先。なければフォールバック
                color: item['color'] || fallbackColor,
                avatarUrl: item['avatarUrl'] || '',
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
  const { profile, isLoading: isProfileLoading } = useUserProfile();
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
        // localStorageにスタッフ用のURLがなければ何もしない
        if (!localStorage.getItem(STAFF_GAS_URL_KEY)) {
            setError("スタッフ情報を取得するためのURLが設定されていません。「スタッフ管理」ページで設定してください。");
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


  useEffect(() => {
    if (!profile || isProfileLoading || isLoading) return;

    if (profile.role !== 'admin') {
        setAppliedSelectedStaffIds([profile.id]);
        setPendingSelectedStaffIds([profile.id]);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([profile.id]));
    }
  }, [profile, isProfileLoading, isLoading]);

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
