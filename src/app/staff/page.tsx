
'use client';

import React, { useState, useEffect } from 'react';
import { StaffTable } from '../../components/staff/staff-table';
import { useSelectedStaff } from '../../contexts/selected-staff-context';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { useUserProfile } from '../../hooks/use-user-profile';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { MonthlyShiftTable } from '../../components/staff/monthly-shift-table';
import { ShiftImportDialog } from '../../components/dashboard/shift-import-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { STAFF_SHEET_URL } from '../../lib/settings';

export default function StaffPage() {
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { allStaff, isLoading: isStaffLoading, error } = useSelectedStaff();
  const router = useRouter();

  useEffect(() => {
    if (!isProfileLoading && !profile) {
      router.push('/login');
    }
  }, [isProfileLoading, profile, router]);

  const handleHeaderClick = () => {
    if (STAFF_SHEET_URL && profile?.role === 'admin') {
      window.open(STAFF_SHEET_URL, '_blank', 'noopener,noreferrer');
    }
  };

  const isLoading = isProfileLoading || isStaffLoading;

  const staffToDisplay = React.useMemo(() => {
    if (isLoading || !profile || !allStaff) return [];
    if (profile.role === 'admin') {
      return allStaff;
    }
    const self = allStaff.find(s => s.id === profile.id);
    return self ? [self] : [];
  }, [profile, allStaff, isLoading]);

  // Refresh trigger for the shift table
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUpload = () => {
    // Trigger a refresh of the shift table
    setRefreshTrigger(prev => prev + 1);
  };

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1
            onClick={handleHeaderClick}
            className={profile?.role === 'admin' && STAFF_SHEET_URL ? "text-2xl font-semibold tracking-tight cursor-pointer hover:underline flex items-center gap-2" : "text-2xl font-semibold tracking-tight flex items-center gap-2"}
          >
            スタッフ管理
            {profile?.role === 'admin' && STAFF_SHEET_URL && <ExternalLink className="h-5 w-5 text-muted-foreground" />}
          </h1>
          {profile?.role === 'admin' && (
            <ShiftImportDialog onUpload={handleUpload} />
          )}
        </div>
        <p className="text-muted-foreground">
          {profile?.role === 'admin'
            ? "Firestoreデータベースから取得されたスタッフの一覧です。表示するスタッフを選択し、「選択を適用」ボタンで他ページに反映します。"
            : "ご自身の情報を確認できます。"}
        </p>
      </div>

      {error && !isStaffLoading && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>データ取得エラー</AlertTitle>
          <AlertDescription>
            {error}
            <p className="mt-2 text-xs">Firestoreの接続設定を確認してください。</p>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-4">最新のスタッフ情報を読み込んでいます...</p>
        </div>
      ) : (
        <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="list">スタッフ一覧</TabsTrigger>
            <TabsTrigger value="shift">月間シフト表</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4">
            <StaffTable staff={staffToDisplay} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="shift" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>月間シフト確認</CardTitle>
                <CardDescription>各スタッフの出勤状況を確認できます。</CardDescription>
              </CardHeader>
              <CardContent>
                <MonthlyShiftTable staffList={staffToDisplay} refreshTrigger={refreshTrigger} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {!isLoading && allStaff.length === 0 && !error && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>スタッフ情報がありません</AlertTitle>
          <AlertDescription>
            <p>スタッフ情報を取得できませんでした。Firestoreの設定を確認してください。</p>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>バックエンド設定</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            現在はFirestoreデータベースをデータソースとして使用しています。Google Apps Scriptによるデータの取得・更新は無効化されています。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
