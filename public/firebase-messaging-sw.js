// This file must be in the public directory.
// It allows the app to receive push notifications when it's in the background.

// Scripts for firebase and messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
// Be sure to replace the config values with your own
//
// TODO: Replace this with your actual Firebase config.
const firebaseConfig = {
  apiKey: "AIzaSyCl1WOEKb9hTh1cXh9TmmuKFzE0gR0hBxU",
  authDomain: "studio-9545980025-bf83e.firebaseapp.com",
  projectId: "studio-9545980025-bf83e",
  storageBucket: "studio-9545980025-bf83e.appspot.com",
  messagingSenderId: "21224099607",
  appId: "1:21224099607:web:9acfbae7cd9451e23af152",
  measurementId: "G-4191E301S8"
};


firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/firebase-logo.png' // you can use your own icon here
  };

  self.registration.showNotification(notificationTitle,
    notificationOptions);
});
