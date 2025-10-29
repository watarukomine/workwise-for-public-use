
'use client';

import { OrderTable } from '@/components/orders/order-table';
import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, Save, ShoppingBag } from 'lucide-react';
import { useUserProfile } from '@/hooks/use-user-profile';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useOrder } from '@/contexts/order-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

const STAFF_STATUS_UPDATE_URL_KEY = 'staffStatusUpdateGasUrl';

export default function OrdersPage() {
  const { orders, isLoading: isLoadingOrders, error: orderError, orderGasUrl, setOrderGasUrl } = useOrder();
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const isAdmin = profile?.role === 'admin';

  const [localOrderUrl, setLocalOrderUrl] = useState(orderGasUrl);
  const [localStatusUrl, setLocalStatusUrl] = useState('');
  
  const [isUpdatingOrderUrl, setIsUpdatingOrderUrl] = useState(false);
  const [isUpdatingStatusUrl, setIsUpdatingStatusUrl] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    setLocalOrderUrl(orderGasUrl);
  }, [orderGasUrl]);

  useEffect(() => {
    const savedUrl = localStorage.getItem(STAFF_STATUS_UPDATE_URL_KEY) || '';
    setLocalStatusUrl(savedUrl);
  }, []);

  const handleOrderUrlUpdate = () => {
    setIsUpdatingOrderUrl(true);
    try {
      if (localOrderUrl !== orderGasUrl) {
        setOrderGasUrl(localOrderUrl);
        toast({
          title: "読込用URLを更新しました",
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
      setIsUpdatingOrderUrl(false);
    }
  };

  const handleStatusUrlUpdate = () => {
    setIsUpdatingStatusUrl(true);
    try {
      localStorage.setItem(STAFF_STATUS_UPDATE_URL_KEY, localStatusUrl);
      toast({
        title: "更新用URLを保存しました",
        description: "タイムラインからの担当者割り当て時にこのURLが使用されます。",
      });
    } catch (e) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "URLの保存に失敗しました。",
      });
    } finally {
      setIsUpdatingStatusUrl(false);
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
        <CardHeader>
          <CardTitle>受注一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {orderError && !isLoadingOrders ? (
             <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>データ取得エラー</AlertTitle>
              <AlertDescription>
                {orderError}
                <p className="mt-2">下のフォームでURLが正しいか確認・更新してください。</p>
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
            受注情報を読み込むGoogle Apps ScriptのURLです。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex w-full max-w-xl items-center space-x-2">
            <Input
              type="url"
              placeholder="https://script.google.com/macros/s/..."
              value={localOrderUrl}
              onChange={(e) => setLocalOrderUrl(e.target.value)}
              disabled={isUpdatingOrderUrl}
            />
            <Button onClick={handleOrderUrlUpdate} disabled={isUpdatingOrderUrl || localOrderUrl === orderGasUrl}>
              {isUpdatingOrderUrl ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              読込用URLを更新
            </Button>
          </div>
        </CardContent>
        <CardFooter>
            <p className="text-xs text-muted-foreground">
                URLを変更すると、データは自動的に再読み込みされます。
            </p>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>担当者更新用 GAS URL設定</CardTitle>
          <CardDescription>
            タイムラインで担当者を割り当てた際に、スプレッドシートの「担当」列を更新するGASのURLです。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex w-full max-w-xl items-center space-x-2">
            <Input
              type="url"
              placeholder="https://script.google.com/macros/s/..."
              value={localStatusUrl}
              onChange={(e) => setLocalStatusUrl(e.target.value)}
              disabled={isUpdatingStatusUrl}
            />
            <Button onClick={handleStatusUrlUpdate} disabled={isUpdatingStatusUrl}>
              {isUpdatingStatusUrl ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              更新用URLを保存
            </Button>
          </div>
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground">
                このURLはブラウザ内に保存され、担当者割り当て時に使用されます。
            </p>
        </CardFooter>
      </Card>

    </div>
  );
}
