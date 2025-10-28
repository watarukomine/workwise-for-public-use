'use client';

import { CustomerTable } from '@/components/customers/customer-table';
import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import { useUserProfile } from '@/hooks/use-user-profile';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCustomer } from '@/contexts/customer-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export default function CustomersPage() {
  const { customers, isLoading: isLoadingCustomers, error: customerError, customerGasUrl, setCustomerGasUrl } = useCustomer();
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const isAdmin = profile?.role === 'admin';

  const [localUrl, setLocalUrl] = useState(customerGasUrl);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    setLocalUrl(customerGasUrl);
  }, [customerGasUrl]);


  const handleUrlUpdate = () => {
    setIsUpdating(true);
    try {
      if (localUrl !== customerGasUrl) {
        setCustomerGasUrl(localUrl);
        toast({
          title: "URLを更新しました",
          description: "新しいURLからデータを再取得します。",
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
      // The loading state in the context will handle showing spinners,
      // so we can turn this off quickly.
      setIsUpdating(false);
    }
  };

  const isLoading = isLoadingCustomers || isProfileLoading;

  if (isProfileLoading) {
    return (
        <div className="flex items-center justify-center p-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-4">ユーザー情報を読み込んでいます...</p>
        </div>
    );
  }

  if (!profile) {
     return (
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
      )
  }

  if (!isAdmin) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>権限がありません</AlertTitle>
          <AlertDescription>
            このページは管理者のみがアクセスできます。
          </AlertDescription>
        </Alert>
      )
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>販売店情報</CardTitle>
          <CardDescription>
            スプレッドシートから自動取得された販売店の一覧です。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {customerError && !isLoadingCustomers ? (
             <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>データ取得エラー</AlertTitle>
              <AlertDescription>
                {customerError}
                <p className="mt-2">下のフォームでURLが正しいか確認・更新してください。</p>
              </AlertDescription>
            </Alert>
          ) : null}
          <CustomerTable customers={customers} isLoading={isLoading} />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>データソースURL設定</CardTitle>
          <CardDescription>
            販売店情報を取得しているGoogle Apps ScriptのURLです。変更がある場合はここで更新できます。
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
            <Button onClick={handleUrlUpdate} disabled={isUpdating || localUrl === customerGasUrl}>
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

    </div>
  );
}
