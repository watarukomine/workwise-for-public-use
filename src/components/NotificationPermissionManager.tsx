'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { requestNotificationPermission } from '@/lib/firebase/messaging';
import { useUser } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { BellRing, BellOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

export function NotificationPermissionManager() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported' | 'loading'>('loading');

  useEffect(() => {
    // Check if Notification API is supported
    if (!('Notification' in window)) {
        setPermission('unsupported');
        return;
    }
    setPermission(Notification.permission);
  }, []);

  const handleRequestPermission = async () => {
    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'エラー',
        description: 'ユーザーがログインしていません。',
      });
      return;
    }

    try {
      const token = await requestNotificationPermission();
      if (token) {
        // Save the token to Firestore
        const userDocRef = doc(firestore, 'users', user.uid);
        await setDoc(userDocRef, { fcmTokens: { [token]: true } }, { merge: true });
        
        toast({
          title: '通知が有効になりました',
          description: 'スケジュールの更新などのお知らせが届きます。',
        });
        setPermission('granted');
      } else {
        setPermission(Notification.permission); // Update state to 'denied' or 'default'
         toast({
          variant: 'destructive',
          title: '通知を許可できませんでした',
          description: 'ブラウザの設定を確認して、このサイトからの通知を許可してください。',
        });
      }
    } catch (error) {
      console.error('Error handling notification permission:', error);
      toast({
        variant: 'destructive',
        title: 'エラー',
        description: '通知の設定中にエラーが発生しました。',
      });
    }
  };

  if (permission === 'loading' || permission === 'granted' || permission === 'unsupported' || !user) {
    return null; // Don't show anything if loading, already granted, not supported, or not logged in
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
        <Card className="max-w-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><BellRing /> 通知を有効にする</CardTitle>
                <CardDescription>
                    スケジュールの変更など、重要なお知らせをプッシュ通知で受け取りますか？
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={handleRequestPermission} className="w-full">
                    はい、通知を有効にする
                </Button>
            </CardContent>
        </Card>
    </div>
  );
}
