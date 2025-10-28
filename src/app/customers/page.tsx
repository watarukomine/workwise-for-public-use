
'use client';

import { CustomerTable } from '@/components/customers/customer-table';
import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useUserProfile } from '@/hooks/use-user-profile';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function CustomersPage() {
  // Static data is removed. Data should be fetched from an external source.
  const [customers, setCustomers] = React.useState<any[]>([]); 
  const [isLoading, setIsLoading] = React.useState(false);
  
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const isAdmin = profile?.role === 'admin';

  // In a real application, you would fetch the customer data here,
  // for example, from a context or an API call that gets data 
  // imported via the Import page.
  // For now, it will be an empty list.

  if (isProfileLoading) {
    return <p>Loading...</p>;
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
        <h1 className="text-2xl font-semibold tracking-tight">販売店情報</h1>
        <p className="text-muted-foreground">
          登録されている販売店の一覧です。データは「データ取込」ページからインポートしてください。
        </p>
      </div>
      <CustomerTable customers={customers} isLoading={isLoading} />
    </div>
  );
}
