
'use client';

import React from 'react';
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
import { useUserProfile } from '@/hooks/use-user-profile';

export default function StaffPage() {
  const firestore = useFirestore();
  const { user, isUserLoading: isAuthLoading } = useUser();
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { allStaff: staffFromContext, setAllStaff } = useSelectedStaff();

  const isAdmin = profile?.role === 'admin';
  const isLoading = isAuthLoading || isProfileLoading;

  const staffCollectionRef = useMemoFirebase(
    () => (firestore && user && isAdmin && !isLoading ? collection(firestore, 'staff') : null),
    [firestore, user, isAdmin, isLoading]
  );
  
  const { data: staffFromHook, isLoading: isStaffLoading, error } = useCollection<WithId<Staff>>(staffCollectionRef);

  React.useEffect(() => {
    if (isAdmin) {
      if (staffFromHook) {
        const formattedStaff = staffFromHook.map(s => ({
          id: s.id,
          name: s.name,
          email: s.email || null,
          avatarUrl: s.avatarUrl,
          color: s.color,
          role: s.role === 'admin' || s.role === 'staff' ? s.role : 'staff',
        }));
        setAllStaff(formattedStaff);
      }
    } else if (!isLoading && profile) {
      // For non-admins, show only their own profile
      const selfStaff: WithId<Staff> = {
        id: profile.uid,
        name: profile.displayName || 'Unknown',
        email: profile.email,
        role: profile.role,
      };
      setAllStaff([selfStaff]);
    } else if (!isLoading && !user) {
        setAllStaff([]);
    }
  }, [staffFromHook, setAllStaff, isLoading, isAdmin, profile, user]);

  const effectiveIsLoading = isLoading || (isAdmin && isStaffLoading);
  
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
            スタッフ情報の取得中にエラーが発生しました。管理者権限がない可能性があります。
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
      
      <StaffTable staff={staffFromContext || []} isLoading={effectiveIsLoading} />
    </div>
  );
}
