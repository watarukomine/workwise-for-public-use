'use client';

import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { initializeFirebase } from '@/firebase';

// This is the VAPID key from your Firebase project settings.
// It's safe to expose this public key.
const VAPID_KEY = 'BPLgqf_y_6m-uQzB3-rQfT_8-L8X_oP7q3y5t6Yh8U4wX_2iZzJm5n3V_1oR9c_7kS6g4B2wE1';

const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
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
      if (!VAPID_KEY) {
        throw new Error('VAPID key is not configured.');
      }
      
      const fcmToken = await getToken(messaging, {
        vapidKey: VAPID_KEY,
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
