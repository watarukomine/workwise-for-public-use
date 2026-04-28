
'use client';

import { OrderTable } from '@/components/orders/order-table';
import React, { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, ShoppingBag } from 'lucide-react';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useOrder } from '@/contexts/order-context';
import { useRouter } from 'next/navigation';
import { ORDER_SHEET_URL } from '@/lib/settings';

export default function OrdersPage() {
  const { orders, isLoading: isLoadingOrders, error: orderError } = useOrder();
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const isAdmin = profile?.role === 'admin';
  const router = useRouter();

  useEffect(() => {
    if (!isProfileLoading && !profile) {
      router.push('/login');
    }
  }, [isProfileLoading, profile, router]);

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
        <AlertDescription>このページは管理者のみがアクセスできます。</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <ShoppingBag className="h-6 w-6" />
          <a 
            href={ORDER_SHEET_URL} 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:underline hover:text-primary transition-colors"
          >
            受注管理
          </a>
        </h1>
        <p className="text-muted-foreground text-sm">
          Firestoreデータベースとリアルタイム同期 · セルをクリックして直接編集
        </p>
      </div>

      {orderError && !isLoadingOrders && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>データ取得エラー</AlertTitle>
          <AlertDescription>
            {orderError}
            <p className="mt-1 text-xs">Firestoreの接続設定を確認してください。</p>
          </AlertDescription>
        </Alert>
      )}

      <OrderTable orders={orders} isLoading={isLoading} />
    </div>
  );
}
