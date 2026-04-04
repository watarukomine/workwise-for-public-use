export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBBelBzLORqNEmMgDMEi8IiqutIGpxfpto",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "workwise-general-v2-kp.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "workwise-general-v2-kp",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "workwise-general-v2-kp.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "152475256065",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:152475256065:web:19dcae9d2c7e91fcd0c700"
};
