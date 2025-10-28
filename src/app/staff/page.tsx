
'use client';

import React from 'react';
import { StaffTable } from '@/components/staff/staff-table';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useUserProfile } from '@/hooks/use-user-profile';
import type { Staff, WithId } from '@/lib/types';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function StaffPage() {
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { allStaff, setAllStaff } = useSelectedStaff();
  const [isFetchingStaff, setIsFetchingStaff] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbyOUN7eqN2f3u9aYaU-5rP8UGrcawlan3FAHzHKjm7RuXifKBCjs2kbfTTB09ygvfRd-Q/exec';

    const fetchStaffData = async () => {
      if (!profile) {
        setIsFetchingStaff(false);
        setAllStaff([]);
        return;
      }
      setIsFetchingStaff(true);
      setError(null);
      try {
        const response = await fetch(GAS_URL, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`);
        }
        const data = await response.json();
        const staffList: WithId<Staff>[] = data.map((item: any) => ({
          id: String(item['スタッフID']),
          role: item['権限（Staff /Admin）'] === 'Admin' ? 'admin' : 'staff',
          name: item['スタッフ名'],
          email: item['メールアドレス'],
          password: item['パスワード'],
          calendarId: item['カレンダーID'],
          color: item['カラー'],
          avatarUrl: `https://picsum.photos/seed/${item['スタッフID']}/100/100`,
        }));
        
        if (profile.role === 'admin') {
            // Admin sees all non-admin staff
            setAllStaff(staffList);
        } else {
            // Non-admin sees only themselves
            const self = staffList.find(s => s.id === profile.id);
            setAllStaff(self ? [self] : []);
        }
      } catch (error) {
        console.error("Failed to fetch staff data", error);
        setError("スタッフ情報の取得に失敗しました。ネットワーク接続を確認するか、後でもう一度お試しください。");
        setAllStaff([]);
      } finally {
        setIsFetchingStaff(false);
      }
    };

    fetchStaffData();
  }, [profile, setAllStaff]);
  
  const isLoading = isProfileLoading || isFetchingStaff;

  const staffToDisplay = React.useMemo(() => {
    if (!profile || !allStaff) return [];
    if (profile.role === 'admin') {
        return allStaff.filter(s => s.role !== 'admin');
    }
    return allStaff;
  }, [profile, allStaff]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">スタッフ・ユーザー管理</h1>
        <p className="text-muted-foreground">
          {profile?.role === 'admin'
            ? "表示するスタッフを選択し、「選択を適用」ボタンでダッシュボードやルート最適化に反映します。" 
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
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}
      
      {isLoading ? (
        <div className="flex items-center justify-center p-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-4">スタッフ情報を読み込んでいます...</p>
        </div>
      ) : (
         !error && profile && <StaffTable staff={staffToDisplay} isLoading={isLoading} />
      )}
    </div>
  );
}
