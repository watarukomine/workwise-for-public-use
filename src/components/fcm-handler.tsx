'use client';

import { useFcm } from '@/hooks/use-fcm';

export function FcmHandler() {
  useFcm();
  return null;
}
