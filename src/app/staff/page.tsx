'use client';

import React, { useState, useEffect } from 'react';
import { StaffTable } from '@/components/staff/staff-table';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import { useUserProfile } from '@/hooks/use-user-profile';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { fetchStaffDataFromGAS } from '@/contexts/selected-staff-context';

const STAFF_GAS_URL_KEY = 'staffImporterUrl';

export default function StaffPage() {
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { allStaff, isLoading: isStaffLoading, error, setAllStaff } = useSelectedStaff();
  
  const [localUrl, setLocalUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [initialUrl, setInitialUrl] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const savedUrl = localStorage.getItem(STAFF_GAS_URL_KEY) || '';
    setLocalUrl(savedUrl);
    setInitialUrl(savedUrl);
  }, []);

  const handleUrlUpdate = async () => {
    setIsUpdating(true);
    try {
      localStorage.setItem(STAFF_GAS_URL_KEY, localUrl);
      const newStaff = await fetchStaffDataFromGAS();
      setAllStaff(newStaff);
      setInitialUrl(localUrl);

      toast({
        title: "URLを更新しました",
        description: "新しいURLからスタッフデータを再取得しました。",
      });
      // A full reload might be better to ensure all contexts are fresh.
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "エラー",
        description: `URLの更新に失敗しました: ${e.message}`,
      });
    } finally {
      setIsUpdating(false);
    }
  };


  const isLoading = isProfileLoading || isStaffLoading;

  const staffToDisplay = React.useMemo(() => {
    if (isLoading || !profile || !allStaff) return [];
    if (profile.role === 'admin') {
      return allStaff.filter(s => s.role !== 'admin');
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
            <CardTitle>データソースURL設定</CardTitle>
            <CardDescription>
              スタッフ情報を取得しているGoogle Apps ScriptのURLです。変更がある場合はここで更新できます。
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
              <Button onClick={handleUrlUpdate} disabled={isUpdating || localUrl === initialUrl}>
                {isUpdating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                URLを更新
              </Button>
            </div>
          </CardContent>
           <CardFooter>
              <p className="text-xs text-muted-foreground">
                  URLを変更すると、データは自動的に再読み込みされます。
              </p>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
