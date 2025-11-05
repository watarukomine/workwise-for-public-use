'use client';

import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { initializeFirebase } from '@/firebase';

export const requestNotificationPermission = async () => {
  const supported = await isSupported();
  if (!supported) {
    console.log('This browser does not support Firebase Messaging.');
    return null;
  }
  
  const { firebaseApp } = initializeFirebase();
  const messaging = getMessaging(firebaseApp);

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    console.log('Notification permission granted.');
    try {
      const fcmToken = await getToken(messaging, {
        vapidKey: 'YOUR_VAPID_KEY_HERE', // This will be replaced by the build process
      });
      if (fcmToken) {
        console.log('FCM Token:', fcmToken);
        // TODO: Send this token to your server and associate it with the current user.
        return fcmToken;
      } else {
        console.log('No registration token available. Request permission to generate one.');
        return null;
      }
    } catch (err) {
      console.error('An error occurred while retrieving token. ', err);
      return null;
    }
  } else {
    console.log('Unable to get permission to notify.');
    return null;
  }
};
