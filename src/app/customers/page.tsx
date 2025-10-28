
'use client';

import { CustomerTable } from '@/components/customers/customer-table';
import type { Customer } from '@/lib/types';
import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { customerData } from '@/lib/data'; // Import static data
import { useUserProfile } from '@/hooks/use-user-profile';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function CustomersPage() {
  const [customers] = React.useState<any[]>(customerData); // Use static data
  const [isLoading, setIsLoading] = React.useState(false); // No real loading needed
  
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const isAdmin = profile?.role === 'admin';

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
          登録されている販売店の一覧です。
        </p>
      </div>
      <CustomerTable customers={customers} isLoading={isLoading} />
    </div>
  );
}
