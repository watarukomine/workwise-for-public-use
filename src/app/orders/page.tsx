
'use client';

import { OrderTable } from '@/components/orders/order-table';
import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, Save, ShoppingBag, ExternalLink } from 'lucide-react';
import { useUserProfile } from '@/hooks/use-user-profile';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useOrder } from '@/contexts/order-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ORDER_GAS_URL, ORDER_SHEET_URL } from '@/lib/settings';

export default function OrdersPage() {
  const { orders, isLoading: isLoadingOrders, error: orderError, orderGasUrl, setOrderGasUrl } = useOrder();
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const isAdmin = profile?.role === 'admin';

  const [localUrl, setLocalUrl] = useState(orderGasUrl);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    setLocalUrl(orderGasUrl);
  }, [orderGasUrl]);

  const handleUrlUpdate = () => {
    setIsUpdating(true);
    try {
      if (localUrl !== orderGasUrl) {
        setOrderGasUrl(localUrl);
        toast({
          title: "URLを更新しました",
          description: "新しいURLからデータを再取得・更新します。",
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

  const isLoading = isLoadingOrders || isProfileLoading;

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
       <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ShoppingBag className="h-6 w-6" />
            受注管理
        </h1>
        <p className="text-muted-foreground">
          スプレッドシートから自動取得された受注情報の一覧です。
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>受注一覧</CardTitle>
           <Button asChild variant="outline">
              <a href={ORDER_SHEET_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                受注シートを開く
              </a>
            </Button>
        </CardHeader>
        <CardContent>
          {orderError && !isLoadingOrders ? (
             <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>データ取得エラー</AlertTitle>
              <AlertDescription>
                {orderError}
                <p className="mt-2">下のフォームでURLが正しいか確認するか、`src/lib/settings.ts`の`ORDER_GAS_URL`を確認してください。</p>
              </AlertDescription>
            </Alert>
          ) : null}
          <OrderTable orders={orders} isLoading={isLoading} />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>データソースURL設定</CardTitle>
          <CardDescription>
            受注情報の読み込み、および担当者更新を行うGoogle Apps ScriptのURLです。恒久的な変更は `src/lib/settings.ts` ファイルで行ってください。
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
            <Button onClick={handleUrlUpdate} disabled={isUpdating || localUrl === ORDER_GAS_URL}>
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
