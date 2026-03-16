importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDoWLRBcQyzkItN9jvXqu1naadp8P8YFDI",
  authDomain: "workwisebu2-31559534-cd9ee.firebaseapp.com",
  databaseURL: "https://workwisebu2-31559534-cd9ee-default-rtdb.firebaseio.com",
  projectId: "workwisebu2-31559534-cd9ee",
  storageBucket: "workwisebu2-31559534-cd9ee.firebasestorage.app",
  messagingSenderId: "1030153269382",
  appId: "1:1030153269382:web:f9bee44d7e2b38a087a107"
});

const messaging = firebase.messaging();

// バックグラウンド通知のカスタマイズが必要な場合はここに実装
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icons/icon-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
