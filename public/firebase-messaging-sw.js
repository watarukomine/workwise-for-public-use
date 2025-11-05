// Scripts for Firebase
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Your web app's Firebase configuration
const firebaseConfig = {
  "projectId": "studio-9545980025-bf83e",
  "appId": "1:21224099607:web:9acfbae7cd9451e23af152",
  "apiKey": "AIzaSyCl1WOEKb9hTh1cXh9TmmuKFzE0gR0hBxU",
  "authDomain": "studio-9545980025-bf83e.firebaseapp.com",
  "measurementId": "G-4191E301S8",
  "messagingSenderId": "21224099607"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );
  
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/firebase-logo.png' // Make sure you have this icon in your public folder
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
