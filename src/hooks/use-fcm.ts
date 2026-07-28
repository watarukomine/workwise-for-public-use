
import { useEffect, useCallback } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
// @ts-ignore - Realtime Database might not be initialized
import { ref, set } from 'firebase/database';
import { useFirebase } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useToast } from '@/hooks/use-toast';

// VAPIDキー（Firebaseコンソールから取得が必要）
const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY || '';

export function useFcm() {
  const firebase = useFirebase() as any;
  const messaging = firebase.messaging;
  const database = firebase.database;
  
  const { profile } = useUserProfile();
  const { toast } = useToast();

  const requestPermission = useCallback(async () => {
    console.log('[FCM] requestPermission called');
    
    if (!messaging || !database || !profile?.id || profile.role !== 'admin') {
      console.log('[FCM] Skipping permission request (messaging/database service missing or not admin)');
      return;
    }

    try {
      console.log('[FCM] Requesting notification permission...');
      const permission = await Notification.requestPermission();
      console.log('[FCM] Permission result:', permission);

      if (permission === 'granted') {
        let registration;
        if ('serviceWorker' in navigator) {
          registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          console.log('[FCM] Service Worker registered:', registration);
        }

        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration,
        });

        if (token) {
          console.log('[FCM] Token acquired:', token);
          const tokenKey = btoa(token).replace(/[=/+]/g, '').substring(0, 20);
          const tokenRef = ref(database, `admin_fcm_tokens/${profile.id}/${tokenKey}`);
          await set(tokenRef, {
            token,
            updatedAt: new Date().toISOString(),
            platform: typeof window !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
          });
          console.log('[FCM] Token saved to DB');
        }
      }
    } catch (error) {
      console.error('[FCM] An error occurred while retrieving token. ', error);
    }
  }, [messaging, profile, database]);

  useEffect(() => {
    if (profile?.role === 'admin' && messaging && database) {
      requestPermission();
    }
  }, [profile, requestPermission, messaging, database]);

  useEffect(() => {
    if (!messaging) return;

    // Listen for foreground messages
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[FCM] Message received in foreground:', payload);
      toast({
        title: payload.notification?.title || '緊急通知',
        description: payload.notification?.body || '緊急連絡がありました。',
        variant: 'destructive',
      });
    });

    return () => unsubscribe();
  }, [messaging, toast]);

  return { requestPermission };
}
