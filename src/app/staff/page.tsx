
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
  // Data is now sourced exclusively from the context, which is updated by the importer.
  const { allStaff } = useSelectedStaff();

  // The isLoading state now only depends on the profile loading.
  const isLoading = isProfileLoading;

  const staffToDisplay = React.useMemo(() => {
    if (!profile || !allStaff) return [];
    if (profile.role === 'admin') {
        // For admin, filter out other admins from the main list view.
        return allStaff.filter(s => String(s.role).toLowerCase() !== 'admin');
    }
    // For staff, show only themselves.
    const self = allStaff.find(s => s.id === profile.id);
    return self ? [self] : [];
  }, [profile, allStaff]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">スタッフ・ユーザー管理</h1>
        <p className="text-muted-foreground">
          {profile?.role === 'admin'
            ? "「データ取込」ページでインポートしたスタッフの一覧です。表示するスタッフを選択し、「選択を適用」ボタンで他ページに反映します。" 
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

      {isLoading ? (
        <div className="flex items-center justify-center p-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-4">ユーザー情報を読み込んでいます...</p>
        </div>
      ) : (
         profile && <StaffTable staff={staffToDisplay} isLoading={isLoading} />
      )}
      
      {!isLoading && profile && allStaff.length === 0 && (
         <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>スタッフ情報がありません</AlertTitle>
            <AlertDescription>
                <p>表示するスタッフ情報がありません。「データ取込」ページからスタッフデータをインポートしてください。</p>
                <Button asChild className="mt-4">
                    <Link href="/import">
                        データ取込ページへ
                    </Link>
                </Button>
            </AlertDescription>
         </Alert>
      )}
    </div>
  );
}
