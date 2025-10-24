
'use client';

import React, { useMemo } from 'react';
import { collection, query } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useCollection, type WithId } from '@/firebase/firestore/use-collection';
import type { Staff, UserProfile } from '@/lib/types';
import { StaffTable } from "@/components/staff/staff-table";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useSelectedStaff } from "@/contexts/selected-staff-context";

// Helper to generate a consistent color from a string (e.g., user ID)
const generateColorFromString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
};


export default function StaffPage() {
  const { setAllStaff } = useSelectedStaff();
  const firestore = useFirestore();

  // Memoize the query to prevent re-renders
  const usersQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'));
  }, [firestore]);

  // Use the useCollection hook to fetch user profiles
  const { data: userProfiles, isLoading, error } = useCollection<UserProfile>(usersQuery);

  // This effect will run when userProfiles data changes.
  // It maps the Firestore UserProfile data to the Staff type used by the context.
  React.useEffect(() => {
    if (userProfiles) {
      const formattedStaff: Staff[] = userProfiles.map((profile) => ({
        id: profile.uid,
        name: profile.displayName || 'Unnamed User',
        email: profile.email,
        role: profile.role,
        avatarUrl: profile.photoURL || '',
        color: generateColorFromString(profile.uid),
      }));
      setAllStaff(formattedStaff);
    }
  }, [userProfiles, setAllStaff]);


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">スタッフ・ユーザー管理</h1>
        <p className="text-muted-foreground">
          Firestoreから取得したユーザー一覧です。チェックを入れたスタッフが他のページに表示されます。
        </p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>データ取得エラー</AlertTitle>
          <AlertDescription>
            {error.message || 'スタッフ情報の取得中に不明なエラーが発生しました。'}
          </AlertDescription>
        </Alert>
      )}
      <StaffTable staff={userProfiles as WithId<Staff>[] | null} isLoading={isLoading} />
    </div>
  );
}
