
'use client';

import { CustomerTable } from '@/components/customers/customer-table';
import React, { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useCustomer } from '@/contexts/customer-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CUSTOMER_SHEET_URL } from '@/lib/settings';
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

  const handleHeaderClick = () => {
    if (CUSTOMER_SHEET_URL && isAdmin) {
      window.open(CUSTOMER_SHEET_URL, '_blank', 'noopener,noreferrer');
    }
  };

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
            Firestoreデータベースから取得された販売店の一覧です。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {customerError && !isLoadingCustomers ? (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>データ取得エラー</AlertTitle>
              <AlertDescription>
                {customerError}
                <p className="mt-2 text-xs">Firestoreの接続設定を確認してください。</p>
              </AlertDescription>
            </Alert>
          ) : null}
          <CustomerTable customers={customers} isLoading={isLoading} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>バックエンド設定</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            現在はFirestoreデータベースをデータソースとして使用しています。Google Apps Scriptによるデータの取得・更新は無効化されています。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
