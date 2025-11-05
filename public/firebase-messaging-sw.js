// Scripts for Firebase products are imported here
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// Initialize the Firebase app in the service worker with the config from the main app
// This configuration is automatically provided by Firebase App Hosting.
firebase.initializeApp({
  "projectId": "studio-9545980025-bf83e",
  "appId": "1:21224099607:web:9acfbae7cd9451e23af152",
  "apiKey": "AIzaSyCl1WOEKb9hTh1cXh9TmmuKFzE0gR0hBxU",
  "authDomain": "studio-9545980025-bf83e.firebaseapp.com",
  "measurementId": "G-4191E301S8",
  "messagingSenderId": "21224099607",
  "vapidKey": "BPLgqf_y_6m-uQzB3-rQfT_8-L8X_...YOUR_VAPID_KEY"
});

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
