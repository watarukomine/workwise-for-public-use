
'use client';

import { OrderTable } from '@/components/orders/order-table';
import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, ShoppingBag, ExternalLink } from 'lucide-react';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useOrder } from '@/contexts/order-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ORDER_SHEET_URL } from '@/lib/settings';
import { useRouter } from 'next/navigation';

export default function OrdersPage() {
  const { orders, isLoading: isLoadingOrders, error: orderError } = useOrder();
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const isAdmin = profile?.role === 'admin';
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!isProfileLoading && !profile) {
      router.push('/login');
    }
  }, [isProfileLoading, profile, router]);

  const handleHeaderClick = () => {
    if (ORDER_SHEET_URL && isAdmin) {
      window.open(ORDER_SHEET_URL, '_blank', 'noopener,noreferrer');
    }
  };

  const isLoading = isLoadingOrders || isProfileLoading;

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
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
        <h1
          className="text-2xl font-semibold tracking-tight flex items-center gap-2"
        >
          <ShoppingBag className="h-6 w-6" />
          受注管理
        </h1>
        <p className="text-muted-foreground">
          Firestoreデータベースからリアルタイムに同期されている受注情報の一覧です。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle
            onClick={handleHeaderClick}
            className={isAdmin && ORDER_SHEET_URL ? "cursor-pointer hover:underline flex items-center gap-2" : "flex items-center gap-2"}
          >
            受注一覧
            {isAdmin && ORDER_SHEET_URL && <ExternalLink className="h-5 w-5 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orderError && !isLoadingOrders ? (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>データ取得エラー</AlertTitle>
              <AlertDescription>
                {orderError}
                <p className="mt-2 text-xs">Firestoreの接続設定を確認してください。</p>
              </AlertDescription>
            </Alert>
          ) : null}
          <OrderTable orders={orders} isLoading={isLoading} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>バックエンド設定</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            現在はFirestoreデータベースをプライマリデータソースとして使用しています。Google Apps Scriptによるデータの取得・更新は無効化されています。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
