
'use client';

import React, { useState, useEffect } from 'react';
import { StaffTable } from '@/components/staff/staff-table';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, Users } from 'lucide-react';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MonthlyShiftTable } from '@/components/staff/monthly-shift-table';
import { ShiftImportDialog } from '@/components/dashboard/shift-import-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { STAFF_SHEET_URL } from '@/lib/settings';

import { AddStaffDialog } from '@/components/staff/add-staff-dialog';

import { useOrder } from '@/contexts/order-context';
import { format, parseISO, isValid } from 'date-fns';

export default function StaffPage() {
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { scheduleEvents } = useOrder();
  const { allStaff, appliedSelectedStaffIds, setSelectedStaffIds, isLoading: isStaffLoading, error } = useSelectedStaff();
  const router = useRouter();

  // 【ユーザー絶対仕様】スタッフ管理画面を開いたロード時に本日作業チップがあるスタッフIDを自動マージ（チェックON）
  useEffect(() => {
    if (isStaffLoading || !allStaff || allStaff.length === 0) return;

    let targetDate = new Date();
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('dashboard_current_date');
      if (saved) {
        const d = parseISO(saved);
        if (isValid(d)) targetDate = d;
      }
    }
    const targetDateStr = format(targetDate, 'yyyy-MM-dd');

    const activeStaffIdsToday = new Set<string>();
    if (scheduleEvents && scheduleEvents.length > 0) {
      scheduleEvents.forEach(e => {
        const evStart = typeof e.start === 'string' ? parseISO(e.start) : e.start;
        if (isValid(evStart)) {
          const eventDateStr = format(evStart, 'yyyy-MM-dd');
          if (eventDateStr === targetDateStr) {
            if (e.staffId && e.staffId !== 'unassigned') {
              const cleanKey = String(e.staffId).trim();
              const staffObj = allStaff.find(s => 
                String(s.id).trim() === cleanKey || 
                String(s.name).trim() === cleanKey ||
                String(s.name).trim().replace(/[\s\u3000]+/g, '') === cleanKey.replace(/[\s\u3000]+/g, '') ||
                ((s as any)['氏名'] && String((s as any)['氏名']).trim().replace(/[\s\u3000]+/g, '') === cleanKey.replace(/[\s\u3000]+/g, ''))
              );
              if (staffObj && staffObj.id) {
                activeStaffIdsToday.add(staffObj.id);
              }
            }
          }
        }
      });
    }

    if (activeStaffIdsToday.size > 0) {
      const missingIds = Array.from(activeStaffIdsToday).filter(id => !appliedSelectedStaffIds.includes(id));
      if (missingIds.length > 0) {
        setSelectedStaffIds(prev => {
          return Array.from(new Set([...prev, ...activeStaffIdsToday]));
        });
      }
    }
  }, [allStaff, isStaffLoading, scheduleEvents, appliedSelectedStaffIds, setSelectedStaffIds]);

  useEffect(() => {
    if (!isProfileLoading && !profile) {
      router.push('/login');
    }
  }, [isProfileLoading, profile, router]);

  const isLoading = isProfileLoading || isStaffLoading;

  const staffToDisplay = React.useMemo(() => {
    if (isLoading || !profile || !allStaff) return [];
    if (profile.role === 'admin') return allStaff;
    const self = allStaff.find(s => s.id === profile.id);
    return self ? [self] : [];
  }, [profile, allStaff, isLoading]);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const handleUpload = () => setRefreshTrigger(prev => prev + 1);

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6" />
            <a 
              href={STAFF_SHEET_URL} 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:underline hover:text-primary transition-colors"
            >
              スタッフ管理
            </a>
          </h1>
          <p className="text-muted-foreground text-sm">
            {profile?.role === 'admin'
              ? "Firestoreデータベースとリアルタイム同期 · セルをクリックして直接編集"
              : "ご自身の情報を確認できます。"}
          </p>
        </div>
        {profile?.role === 'admin' && (
          <div className="flex items-center gap-2">
            <AddStaffDialog onCreated={handleUpload} />
            <ShiftImportDialog onUpload={handleUpload} />
          </div>
        )}
      </div>

      {error && !isStaffLoading && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>データ取得エラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="list">スタッフ一覧</TabsTrigger>
          <TabsTrigger value="shift">月間シフト表</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <StaffTable staff={staffToDisplay} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="shift" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>月間シフト確認</CardTitle>
              <CardDescription>各スタッフの出勤状況を確認できます。</CardDescription>
            </CardHeader>
            <CardContent>
              <MonthlyShiftTable staffList={staffToDisplay} refreshTrigger={refreshTrigger} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {!isLoading && allStaff.length === 0 && !error && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>スタッフ情報がありません</AlertTitle>
          <AlertDescription>
            「インポート」ページからCSVファイルをアップロードしてスタッフデータを登録してください。
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
