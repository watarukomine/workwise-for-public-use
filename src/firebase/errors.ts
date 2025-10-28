
'use client';

// This file is part of the now-disabled Firebase functionality.
// The FirestorePermissionError is no longer actively thrown but is kept
// to avoid breaking imports in other files.

export class FirestorePermissionError extends Error {
  constructor(context: any) {
    const message = `Mock Firestore Permission Error. Context: ${JSON.stringify(context, null, 2)}`;
    super(message);
    this.name = 'FirebaseError';
  }
}
