
'use client';
// This file is no longer used in the simplified mock auth flow.
// The UserProfileProvider now handles session state from localStorage.
// Keeping the file to avoid breaking imports, but it can be removed later.
import React from 'react';

export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
