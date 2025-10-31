
'use client';

import { CustomerTable } from '@/components/customers/customer-table';
import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, Save, ExternalLink } from 'lucide-react';
import { useUserProfile } from '@/hooks/use-user-profile';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCustomer } from '@/contexts/customer-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { CUSTOMER_GAS_URL, CUSTOMER_SHEET_URL } from '@/lib/settings';

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
      setIsUpdating(false);
    }
  };

  const handleHeaderClick = () => {
    if (CUSTOMER_SHEET_URL && isAdmin) {
      window.open(CUSTOMER_SHEET_URL, '_blank', 'noopener,noreferrer');
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
          <CardTitle 
            onClick={handleHeaderClick}
            className={isAdmin && CUSTOMER_SHEET_URL ? "cursor-pointer hover:underline flex items-center gap-2" : "flex items-center gap-2"}
          >
            販売店情報
            {isAdmin && CUSTOMER_SHEET_URL && <ExternalLink className="h-5 w-5 text-muted-foreground" />}
          </CardTitle>
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
                <p className="mt-2">下のフォームでURLが正しいか確認するか、`src/lib/settings.ts`の`CUSTOMER_GAS_URL`を確認してください。</p>
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
            販売店情報を取得しているGoogle Apps ScriptのURLです。恒久的な変更は `src/lib/settings.ts` ファイルで行ってください。
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
            <Button onClick={handleUrlUpdate} disabled={isUpdating || localUrl === CUSTOMER_GAS_URL}>
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

    </div>
  );
}
