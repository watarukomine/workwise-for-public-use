
'use client';

import { CustomerTable } from '@/components/customers/customer-table';
import React, { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, Building2 } from 'lucide-react';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useCustomer } from '@/contexts/customer-context';
import { useRouter } from 'next/navigation';

export default function CustomersPage() {
  const { customers, isLoading: isLoadingCustomers, error: customerError } = useCustomer();
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const isAdmin = profile?.role === 'admin';
  const router = useRouter();

  useEffect(() => {
    if (!isProfileLoading && !profile) {
      router.push('/login');
    }
  }, [isProfileLoading, profile, router]);

  const isLoading = isLoadingCustomers || isProfileLoading;

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
          <Building2 className="h-6 w-6" />
          販売店情報
        </h1>
        <p className="text-muted-foreground text-sm">
          Firestoreデータベースとリアルタイム同期 · セルをクリックして直接編集
        </p>
      </div>

      {customerError && !isLoadingCustomers && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>データ取得エラー</AlertTitle>
          <AlertDescription>
            {customerError}
            <p className="mt-1 text-xs">Firestoreの接続設定を確認してください。</p>
          </AlertDescription>
        </Alert>
      )}

      <CustomerTable customers={customers} isLoading={isLoading} />
    </div>
  );
}
