
'use client';

import React, { useEffect, useState } from 'react';
import { StaffTable } from '@/components/staff/staff-table';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useUserProfile } from '@/hooks/use-user-profile';
import type { Staff, WithId } from '@/lib/types';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { fetchStaffDataFromGAS } from '@/lib/auth';

export default function StaffPage() {
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  // The 'allStaff' from context is now used for selection state, not for displaying data.
  const { setAllStaff } = useSelectedStaff();
  const [staffData, setStaffData] = useState<WithId<Staff>[]>([]);
  const [isFetchingStaff, setIsFetchingStaff] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStaff() {
      if (!profile) {
        setIsFetchingStaff(false);
        return;
      };
      
      setIsFetchingStaff(true);
      setError(null);
      try {
        const fetchedStaff = await fetchStaffDataFromGAS();
        setStaffData(fetchedStaff);
        setAllStaff(fetchedStaff); // Update context for selection logic
      } catch (e: any) {
        setError("スタッフ情報の取得に失敗しました。");
        console.error(e);
      } finally {
        setIsFetchingStaff(false);
      }
    }
    loadStaff();
  }, [profile, setAllStaff]);
  
  const isLoading = isProfileLoading || isFetchingStaff;

  const staffToDisplay = React.useMemo(() => {
    if (!profile || !staffData) return [];
    if (profile.role === 'admin') {
        // For admin, filter out other admins from the main list view.
        return staffData.filter(s => s.role !== 'admin');
    }
    // For staff, show only themselves.
    const self = staffData.find(s => s.id === profile.id);
    return self ? [self] : [];
  }, [profile, staffData]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">スタッフ・ユーザー管理</h1>
        <p className="text-muted-foreground">
          {profile?.role === 'admin'
            ? "スプレッドシートから取得したスタッフの一覧です。表示するスタッフを選択し、「選択を適用」ボタンで他ページに反映します。" 
            : "ご自身の情報を確認できます。"}
        </p>
      </div>

      {!isLoading && !profile && (
         <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>ログインしてください</AlertTitle>
          <AlertDescription>
            <p>このページを表示するにはログインが必要です。</p>
             <Button asChild className="mt-4">
              <Link href="/login">
                 ログインページへ
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {error && (
         <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
         </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-4">最新のスタッフ情報を読み込んでいます...</p>
        </div>
      ) : (
         profile && <StaffTable staff={staffToDisplay} isLoading={isLoading} />
      )}
      
      {!isLoading && profile && staffData.length === 0 && !error && (
         <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>スタッフ情報がありません</AlertTitle>
            <AlertDescription>
                <p>スプレッドシートからスタッフ情報を取得できませんでした。GASのURLやシートの内容を確認してください。</p>
            </AlertDescription>
         </Alert>
      )}
    </div>
  );
}
