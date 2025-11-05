'use client';

import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { initializeFirebase } from '@/firebase';
import { firebaseConfig } from '@/firebase/config';

/**
 * Requests notification permission and retrieves the FCM token.
 * This function now correctly handles the async nature of isSupported()
 * and ensures the service worker is registered.
 *
 * @returns {Promise<string | null>} The FCM token if permission is granted, otherwise null.
 */
export const requestNotificationPermission = async (): Promise<string | null> => {
  const supported = await isSupported();
  if (!supported) {
    console.log('Firebase Messaging is not supported in this browser.');
    return null;
  }
  
  const { firebaseApp } = initializeFirebase();
  const messaging = getMessaging(firebaseApp);

  try {
    // 1. Register the service worker
    const serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('Service Worker registration successful.');

    // 2. Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission was not granted.');
      return null;
    }
    console.log('Notification permission granted.');

    // 3. Get the token
    if (!firebaseConfig.vapidKey) {
      console.error('VAPID key is missing in firebaseConfig.');
      return null;
    }
    
    console.log('Requesting FCM token...');
    const fcmToken = await getToken(messaging, {
      vapidKey: firebaseConfig.vapidKey,
      serviceWorkerRegistration, // Pass the registration
    });

    if (fcmToken) {
      console.log('FCM Token retrieved:', fcmToken);
      return fcmToken;
    } else {
      console.log('No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (err) {
    console.error('An error occurred while retrieving token or requesting permission.', err);
    return null;
  }
};
