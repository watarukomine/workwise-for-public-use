// DO NOT USE 'use client' HERE

// Import the Firebase app and messaging modules
import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging/sw';

// This is the SAME configuration object from src/firebase/config.ts
// It needs to be redefined here because service workers have a different scope
// and cannot import from the main application code.
const firebaseConfig = {
  "projectId": "studio-9545980025-bf83e",
  "appId": "1:21224099607:web:9acfbae7cd9451e23af152",
  "apiKey": "AIzaSyCl1WOEKb9hTh1cXh9TmmuKFzE0gR0hBxU",
  "authDomain": "studio-9545980025-bf83e.firebaseapp.com",
  "measurementId": "G-4191E301S8",
  "messagingSenderId": "21224099607",
  "vapidKey": "BPLgqf_y_6m-uQzB3-rQfT_8-L8X_...YOUR_VAPID_KEY"
};


// Initialize the Firebase app in the service worker
// with the same configuration as the main application.
const app = initializeApp(firebaseConfig);
console.log('Firebase service worker initialized.');

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = getMessaging(app);

// If you want to handle background messages, you can add a handler here.
// self.addEventListener('push', (event) => {
//   console.log('Push event received.', event);
//   const payload = event.data?.json();
//   if (payload) {
//     event.waitUntil(
//       self.registration.showNotification(payload.notification.title, {
//         body: payload.notification.body,
//         icon: payload.notification.icon || '/icon.png',
//       })
//     );
//   }
// });
