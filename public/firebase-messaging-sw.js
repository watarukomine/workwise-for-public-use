// Import the Firebase app and messaging modules
import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";

// Your web app's Firebase configuration
// This configuration is used by the service worker
const firebaseConfig = {
  "projectId": "studio-9545980025-bf83e",
  "appId": "1:21224099607:web:9acfbae7cd9451e23af152",
  "apiKey": "AIzaSyCl1WOEKb9hTh1cXh9TmmuKFzE0gR0hBxU",
  "authDomain": "studio-9545980025-bf83e.firebaseapp.com",
  "measurementId": "G-4191E301S8",
  "messagingSenderId": "21224099607",
  "storageBucket": "studio-9545980025-bf83e.appspot.com"
};


// Initialize the Firebase app in the service worker
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// onBackgroundMessage handles messages received when the app is in the background or closed.
onBackgroundMessage(messaging, (payload) => {
  console.log(
    "[firebase-messaging-sw.js] Received background message ",
    payload
  );

  // Customize notification here
  const notificationTitle = payload.notification?.title || 'New Message';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message.',
    icon: "/firebase-logo.png",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
