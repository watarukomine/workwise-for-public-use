// This file MUST be in the /public directory

// Firebase v9+ modular SDK imports
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

// This is a special URL that allows the service worker to get the config object
// The config is passed as a URL query parameter
const firebaseConfig = new URL(location).searchParams.get('firebaseConfig');
if (!firebaseConfig) {
    throw new Error('Firebase config not found in service worker URL query parameter.');
}
const parsedFirebaseConfig = JSON.parse(firebaseConfig);


// Initialize the Firebase app in the service worker
const firebaseApp = initializeApp(parsedFirebaseConfig);
const messaging = getMessaging(firebaseApp);

// onBackgroundMessage is used to handle messages received when the app is in the background.
// The service worker will be woken up to handle the message.
onBackgroundMessage(messaging, (payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  // Customize notification here
  const notificationTitle = payload.notification?.title || 'New Message';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || '/icon-192x192.png'
  };

  // The showNotification() method of the ServiceWorkerRegistration interface creates a notification on an active service worker.
  self.registration.showNotification(notificationTitle, notificationOptions);
});
