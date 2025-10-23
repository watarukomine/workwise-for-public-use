
'use client';

import * as React from 'react';
import { ScheduleView } from '@/components/dashboard/schedule-view';
import { StatusUpdates } from '@/components/dashboard/status-updates';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { signIn } from '@/lib/auth';
import { Briefcase, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.05 1.05-2.86 2.25-5.02 2.25-4.33 0-7.87-3.55-7.87-7.95s3.54-7.95 7.87-7.95c2.43 0 3.97 1.02 4.88 1.94l2.6-2.58C18.44 1.56 15.82 0 12.48 0 5.6 0 0 5.6 0 12.5S5.6 25 12.48 25c7.2 0 12.04-4.92 12.04-12.16 0-.8-.08-1.44-.2-2.02h-11.84z" />
    </svg>
);


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
        description: error.message || "Googleログインに失敗しました。コンソールで詳細を確認してください。",
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
              <GoogleIcon className="mr-2 h-5 w-5 fill-white" />
              Googleでログイン
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
