
'use client';
// This hook is disabled in the simplified mock auth flow.
// Data is now sourced from static files in /lib/data.ts.
// This function is kept to prevent import errors but will not be executed.

import { useState } from 'react';

export const useDoc = <T>(docRef: any) => {
  const [data] = useState<T | null>(null);
  const [isLoading] = useState(false);
  const [error] = useState<Error | null>(null);

  // The hook's logic is removed to prevent any Firestore calls.
  // It returns a static, empty state.
  
  return { data, isLoading, error };
};
