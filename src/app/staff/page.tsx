
'use client';

import React from 'react';
import { StaffTable } from '@/components/staff/staff-table';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useUserProfile } from '@/hooks/use-user-profile';
import { staffData } from '@/lib/data'; // Import static data

export default function StaffPage() {
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { allStaff: staffFromContext, setAllStaff } = useSelectedStaff();

  React.useEffect(() => {
    // If a user is logged in, filter the static data based on their role
    if (profile) {
      if (profile.role === 'admin') {
        setAllStaff(staffData); // Admin sees all staff
      } else {
        // Staff sees only their own data
        const self = staffData.find(s => s.id === profile.id);
        setAllStaff(self ? [self] : []);
      }
    } else if (!isProfileLoading) {
        // If no user is logged in (and we're not loading), show an empty list
        setAllStaff([]);
    }
  }, [profile, isProfileLoading, setAllStaff]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">スタッフ・ユーザー管理</h1>
        <p className="text-muted-foreground">
          {profile?.role === 'admin'
            ? "表示するスタッフを選択し、「選択を適用」ボタンでダッシュボードやルート最適化に反映します。" 
            : "ご自身の情報を確認できます。"}
        </p>
      </div>

      {!isProfileLoading && !profile && (
         <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>ログインしてください</AlertTitle>
          <AlertDescription>
            スタッフ情報を表示するには、ログインが必要です。
          </AlertDescription>
        </Alert>
      )}
      
      <StaffTable staff={staffFromContext || []} isLoading={isProfileLoading} />
    </div>
  );
}
