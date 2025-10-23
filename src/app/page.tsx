'use client';

import * as React from 'react';
import { ScheduleView } from '@/components/dashboard/schedule-view';
import { StatusUpdates } from '@/components/dashboard/status-updates';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { signIn } from '@/lib/auth';
import { Briefcase, Loader2, LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DashboardPage() {
  const { user, isLoading } = useUser();
  const { toast } = useToast();

  const handleSignIn = async () => {
    try {
      await signIn();
    } catch (error: any) {
      console.error("Sign in failed:", error);
      toast({
        variant: "destructive",
        title: "ログインに失敗しました",
        description: error.message || "匿名ログインに失敗しました。コンソールで詳細を確認してください。",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
        <div className="flex h-[calc(100vh-10rem)] w-full flex-col items-center justify-center rounded-lg border border-dashed shadow-sm text-center p-8">
            <Briefcase className="h-16 w-16 text-primary mb-4" />
            <h2 className="text-2xl font-semibold tracking-tight">WorkWiseへようこそ</h2>
            <p className="text-muted-foreground mt-2 mb-6 max-w-md">
                スタッフのスケジュールと現在の活動をリアルタイムで管理するには、まずログインしてください。
            </p>
            <Button onClick={handleSignIn} size="lg">
              <LogIn className="mr-2 h-5 w-5" />
              匿名でログイン
            </Button>
        </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">管理者ダッシュボード</h1>
        <p className="text-muted-foreground">
          スタッフのスケジュールと現在の状況を一覧で確認できます。
        </p>
      </div>
      <div className="flex flex-col gap-8">
        <ScheduleView />
        <StatusUpdates />
      </div>
    </div>
  );
}
