import { useEffect, useCallback } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { ref, set } from 'firebase/database';
import { useFirebase } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useToast } from '@/hooks/use-toast';

// VAPIDキー（Firebaseコンソールから取得が必要）
// 一旦プレースホルダーとして空文字にしていますが、ユーザーに設定してもらう必要があります。
const VAPID_KEY = 'BORdd3TgnHTsUUfH_wtTd2JKJSywHyHVw_8-kG71KhcbIJloemep4ggJ6fy8KgvOaiMDkYxPeY4vXsIPNnukIQs';

export function useFcm() {
  const { messaging, database } = useFirebase();
  const { profile } = useUserProfile();
  const { toast } = useToast();

  const requestPermission = useCallback(async () => {
    console.log('[FCM] requestPermission called');
    console.log('[FCM] Status:', {
      hasMessaging: !!messaging,
      profileId: profile?.id,
      role: profile?.role,
      notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'not supported'
    });

    if (!messaging || !database || !profile?.id || profile.role !== 'admin') {
      console.log('[FCM] Skipping permission request (not admin or not initialized)');
      return;
    }

    try {
      console.log('[FCM] Requesting notification permission...');
      const permission = await Notification.requestPermission();
      console.log('[FCM] Permission result:', permission);

      if (permission === 'granted') {
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
        });

        if (token) {
          console.log('[FCM] Token acquired:', token);
          // Save token to Realtime Database
          const tokenRef = ref(database, `admin_fcm_tokens/${profile.id}`);
          await set(tokenRef, {
            token,
            updatedAt: new Date().toISOString(),
          });
          console.log('[FCM] Token saved to DB');
        } else {
          console.warn('[FCM] No registration token available.');
        }
      }
    } catch (error) {
      console.error('[FCM] An error occurred while retrieving token. ', error);
    }
  }, [messaging, profile, database]);

  useEffect(() => {
    console.log('[FCM] useEffect triggered. Role:', profile?.role);
    if (profile?.role === 'admin') {
      requestPermission();
    }
  }, [profile, requestPermission]);

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
