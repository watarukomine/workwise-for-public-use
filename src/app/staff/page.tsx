'use client';

import React, { useEffect, useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore } from '@/firebase/provider';
import { collection } from 'firebase/firestore';
import { StaffTable } from '@/components/staff/staff-table';
import type { Staff, WithId } from '@/lib/types';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useMemoFirebase } from '@/firebase/provider';
import { useUser } from '@/firebase/auth/use-user';

export default function StaffPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { setAllStaff } = useSelectedStaff();

  const staffCollectionRef = useMemoFirebase(
    () => (firestore && user && !isUserLoading ? collection(firestore, 'staff') : null),
    [firestore, user, isUserLoading]
  );
  
  const { data: staff, isLoading, error } = useCollection<WithId<Staff>>(staffCollectionRef);

  useEffect(() => {
    if (staff) {
      // Map Firestore data to Staff type, ensuring role is correctly typed
      const formattedStaff = staff.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email || null,
        avatarUrl: s.avatarUrl,
        color: s.color,
        // Firestore might return a different type, so we ensure it matches our defined roles
        role: s.role === 'admin' || s.role === 'staff' ? s.role : 'staff',
      }));
      setAllStaff(formattedStaff);
    } else if (!isLoading && !isUserLoading && !user) {
        // If not loading and not logged in, clear staff list
        setAllStaff([]);
    }
  }, [staff, setAllStaff, isLoading, isUserLoading, user]);

  const effectiveIsLoading = isLoading || isUserLoading;
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">スタッフ・ユーザー管理</h1>
        <p className="text-muted-foreground">
          表示するスタッフを選択し、「選択を適用」ボタンでダッシュボードやルート最適化に反映します。
        </p>
      </div>

       {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>データ取得エラー</AlertTitle>
          <AlertDescription>
            スタッフ情報の取得中にエラーが発生しました。権限が不足している可能性があります。
            <pre className="mt-2 text-xs bg-gray-800 p-2 rounded"><code>{error.message}</code></pre>
          </AlertDescription>
        </Alert>
      )}

      {!effectiveIsLoading && !user && (
         <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>ログインしてください</AlertTitle>
          <AlertDescription>
            スタッフ情報を表示するには、ログインが必要です。
          </AlertDescription>
        </Alert>
      )}
      
      <StaffTable staff={staff} isLoading={effectiveIsLoading} />
    </div>
  );
}
