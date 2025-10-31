
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

export default function StaffPage() {
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { allStaff, isLoading: isStaffLoading, error } = useSelectedStaff();
  
  // The local URL state now reflects the hardcoded URL from settings.
  // We keep the state management UI to allow temporary overrides for debugging,
  // but it won't persist.
  const [localUrl, setLocalUrl] = useState(STAFF_GAS_URL);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const handleUrlUpdate = async () => {
    setIsUpdating(true);
    toast({
        title: "URLを更新しました",
        description: "ページを再読み込みして、新しいURLからスタッフデータを取得します。",
      });
    // This will effectively reload the page with the new URL for this session.
    // However, on next load, it will revert to the URL from settings.ts
    // For a permanent change, the user should be instructed to change settings.ts
    window.location.href = `${window.location.origin}${window.location.pathname}?gasUrl=${encodeURIComponent(localUrl)}`;
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

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">スタッフ管理</h1>
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
        profile && <StaffTable staff={staffToDisplay} isLoading={isLoading} />
      )}
      
      {!isLoading && profile && allStaff.length === 0 && !error && (
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
             <div className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>スタッフマスタ用 データソースURL設定</CardTitle>
                  <CardDescription>
                    スタッフ情報を取得しているGoogle Apps ScriptのURLです。恒久的な変更は `src/lib/settings.ts` ファイルで行ってください。
                  </CardDescription>
                </div>
                 <Button asChild variant="outline">
                    <a href={STAFF_SHEET_URL} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      スタッフシートを開く
                    </a>
                  </Button>
              </div>
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
              <Button onClick={handleUrlUpdate} disabled={isUpdating || localUrl === STAFF_GAS_URL}>
                {isUpdating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                このセッションでURLを更新
              </Button>
            </div>
          </CardContent>
           <CardFooter>
              <p className="text-xs text-muted-foreground">
                  ここでの更新は一時的なものです。ページをリロードすると`settings.ts`の値に戻ります。
              </p>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
