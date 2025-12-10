
'use client';

import React, { useState, useEffect } from 'react';
import { StaffTable } from '@/components/staff/staff-table';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, Save, ExternalLink } from 'lucide-react';
import { useUserProfile } from '@/hooks/use-user-profile';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { STAFF_GAS_URL, STAFF_SHEET_URL } from '@/lib/settings';
import { useRouter } from 'next/navigation';

export default function StaffPage() {
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  // Destructure staffGasUrl and setStaffGasUrl from context
  const { allStaff, isLoading: isStaffLoading, error, staffGasUrl, setStaffGasUrl } = useSelectedStaff();
  const router = useRouter();

  // Local state for the input field, initialized with context value
  const [localUrl, setLocalUrl] = useState(staffGasUrl);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isProfileLoading && !profile) {
      router.push('/login');
    }
  }, [isProfileLoading, profile, router]);

  // Sync local input with context value when it changes (e.g. loaded from storage)
  useEffect(() => {
    if (staffGasUrl) {
      setLocalUrl(staffGasUrl);
    }
  }, [staffGasUrl]);

  const handleUrlUpdate = async () => {
    setIsUpdating(true);
    try {
      if (localUrl !== staffGasUrl) {
        setStaffGasUrl(localUrl);
        toast({
          title: "URLを更新しました",
          description: "新しいURLからスタッフデータを取得し、設定をブラウザに保存しました。",
        });
      }
    } catch (e) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "URLの更新に失敗しました。",
      });
    } finally {
      setIsUpdating(false);
    }
  };


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
        <h1
          onClick={handleHeaderClick}
          className={profile?.role === 'admin' && STAFF_SHEET_URL ? "text-2xl font-semibold tracking-tight cursor-pointer hover:underline flex items-center gap-2" : "text-2xl font-semibold tracking-tight flex items-center gap-2"}
        >
          スタッフ管理
          {profile?.role === 'admin' && STAFF_SHEET_URL && <ExternalLink className="h-5 w-5 text-muted-foreground" />}
        </h1>
        <p className="text-muted-foreground">
          {profile?.role === 'admin'
            ? "スプレッドシートから取得したスタッフの一覧です。表示するスタッフを選択し、「選択を適用」ボタンで他ページに反映します。"
            : "ご自身の情報を確認できます。"}
        </p>
      </div>

      {error && !isStaffLoading && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>データ取得エラー</AlertTitle>
          <AlertDescription>
            {error}
            <p className="mt-2">下のフォームでURLが正しいか確認・更新するか、`src/lib/settings.ts`の`STAFF_GAS_URL`を確認してください。</p>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-4">最新のスタッフ情報を読み込んでいます...</p>
        </div>
      ) : (
        <StaffTable staff={staffToDisplay} isLoading={isLoading} />
      )}

      {!isLoading && allStaff.length === 0 && !error && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>スタッフ情報がありません</AlertTitle>
          <AlertDescription>
            <p>スプレッドシートからスタッフ情報を取得できませんでした。下のフォームでURLが正しいか確認・更新してください。</p>
          </AlertDescription>
        </Alert>
      )}

      {profile?.role === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle>スタッフマスタ用 データソースURL設定</CardTitle>
            <CardDescription>
              スタッフ情報を取得しているGoogle Apps ScriptのURLです。設定はブラウザに保存され、次回以降も使用されます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex w-full max-w-xl items-center space-x-2">
              <Input
                type="url"
                placeholder="https://script.google.com/macros/s/..."
                value={localUrl}
                onChange={(e) => setLocalUrl(e.target.value)}
                disabled={isUpdating}
              />
              <Button onClick={handleUrlUpdate} disabled={isUpdating || localUrl === staffGasUrl}>
                {isUpdating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                URLを保存して更新
              </Button>
            </div>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              ここでの変更はブラウザ(localStorage)に保存され、`src/lib/settings.ts`のデフォルト値より優先されます。
            </p>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
