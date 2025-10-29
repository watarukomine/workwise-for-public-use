
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Staff, WithId } from '@/lib/types';
import { useUserProfile } from '@/hooks/use-user-profile';
import { fetchGasData } from '@/app/actions/fetch-gas-data';


const LOCAL_STORAGE_KEY = 'appliedStaffIds';
const STAFF_GAS_URL_KEY = 'staffImporterUrl';

const findRoleValue = (item: any): 'admin' | 'staff' => {
  if (!item || typeof item !== 'object') return 'staff';
  const roleValue = item['権限'];
  if (roleValue && typeof roleValue === 'string' && roleValue.toLowerCase() === 'admin') {
    return 'admin';
  }
  return 'staff';
};

export const fetchStaffDataFromGAS = async (): Promise<WithId<Staff>[]> => {
    if (typeof window === 'undefined') return [];
    const staffGasUrl = localStorage.getItem(STAFF_GAS_URL_KEY);
    
    if (!staffGasUrl) {
        console.warn("No GAS URL for staff is defined in localStorage.");
        return [];
    }

    try {
        const result = await fetchGasData(staffGasUrl);
        
        if (result.error && result.message) {
          throw new Error(result.message);
        }

        const rawStaffArray = result.data || (Array.isArray(result) ? result : []);

        if (Array.isArray(rawStaffArray)) {
            return rawStaffArray.map((item: any, index: number) => {
                const id = String(item['スタッフID'] || item.id || `staff-${index}`);
                const color = item['カラー'] || item.color || `hsl(${(index * 137.5) % 360}, 70%, 50%)`;
                return {
                    id: id,
                    role: findRoleValue(item),
                    name: item['スタッフ名'] || item.name,
                    email: item['メールアドレス'] || item.email,
                    password: item['パスワード'] || item.password,
                    calendarId: item['カレンダーID'] || item.calendarId,
                    color: color,
                    avatarUrl: `https://picsum.photos/seed/${id}/100/100`,
                };
            });
        }
         return [];
    } catch (error: any) {
        console.error('Error fetching staff data from GAS:', error);
        throw new Error(error.message || 'Failed to fetch staff data from spreadsheet.');
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
  
  useEffect(() => {
    const loadStaff = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const fetchedStaff = await fetchStaffDataFromGAS();
          setAllStaffState(fetchedStaff);

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
