'use client';
import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';

/** Initiate anonymous sign-in. Returns a promise for error handling. */
export function initiateAnonymousSignIn(authInstance: Auth): Promise<void> {
  return signInAnonymously(authInstance)
    .then(() => { /* Auth state change handled by onAuthStateChanged listener */ })
    .catch((error) => {
      console.error('[Auth] Anonymous sign-in failed:', error.code, error.message);
      throw error; // Re-throw so callers can handle
    });
}

/** Initiate email/password sign-up. Returns a promise for error handling. */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string): Promise<void> {
  return createUserWithEmailAndPassword(authInstance, email, password)
    .then(() => { /* Auth state change handled by onAuthStateChanged listener */ })
    .catch((error) => {
      console.error('[Auth] Email sign-up failed:', error.code, error.message);
      throw error;
    });
}

/** Initiate email/password sign-in. Returns a promise for error handling. */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): Promise<void> {
  return signInWithEmailAndPassword(authInstance, email, password)
    .then(() => { /* Auth state change handled by onAuthStateChanged listener */ })
    .catch((error) => {
      console.error('[Auth] Email sign-in failed:', error.code, error.message);
      throw error;
    });
}
