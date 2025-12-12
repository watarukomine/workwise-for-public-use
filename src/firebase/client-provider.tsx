'use client';

import React, { useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    // Initialize Firebase on the client side, once per component mount.
    return initializeFirebase();
  }, []); // Empty dependency array ensures this runs only once on mount

  // Automatically sign in anonymously to satisfy Firestore rules (auth != null)
  React.useEffect(() => {
    const { auth } = firebaseServices;
    import('firebase/auth').then(({ signInAnonymously, onAuthStateChanged }) => {
      onAuthStateChanged(auth, (user) => {
        if (user) {
          console.log('✅ Firebase Auth: User is signed in:', user.uid);
        } else {
          console.log('❌ Firebase Auth: User is signed out.');
        }
      });

      signInAnonymously(auth).then(() => {
        console.log('✅ Anonymous login successful.');
      }).catch((e) => {
        console.error('❌ Failed to sign in anonymously:', e);
      });
    });
  }, [firebaseServices]);

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
      functions={firebaseServices.functions}
    >
      {children}
    </FirebaseProvider>
  );
}
