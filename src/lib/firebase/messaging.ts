'use client';

import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { initializeFirebase } from '@/firebase';
import { firebaseConfig } from '@/firebase/config';

// Function to register the service worker
const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
        try {
            // The service worker is now self-contained and does not need config passed via URL
            const serviceWorkerUrl = '/firebase-messaging-sw.js';
            
            const registration = await navigator.serviceWorker.register(serviceWorkerUrl, {
                scope: '/'
            });
            console.log('Service Worker registration successful, scope is:', registration.scope);
            return registration;
        } catch (err) {
            console.error('Service Worker registration failed:', err);
            return null;
        }
    }
    return null;
};


export const requestNotificationPermission = async () => {
  const supported = await isSupported();
  if (!supported) {
    console.log('This browser does not support Firebase Messaging.');
    return null;
  }
  
  const registration = await registerServiceWorker();
  if (!registration) {
      console.log("Could not register service worker.");
      return null;
  }
  
  const { firebaseApp } = initializeFirebase();
  const messaging = getMessaging(firebaseApp);

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    console.log('Notification permission granted.');
    try {
      const vapidKeyFromConfig = firebaseConfig.vapidKey;
      if (!vapidKeyFromConfig || vapidKeyFromConfig.includes('YOUR_VAPID_KEY')) {
        throw new Error('VAPID key is not configured in firebase/config.ts');
      }
      
      const fcmToken = await getToken(messaging, {
        vapidKey: vapidKeyFromConfig,
        serviceWorkerRegistration: registration,
      });

      if (fcmToken) {
        console.log('FCM Token:', fcmToken);
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
