'use server';

import { appendOrderDirectToSheet, DirectOrderPayload } from '@/lib/google-sheets-direct';

export async function appendOrderDirectServerAction(payload: DirectOrderPayload) {
  try {
    console.log('[SheetDirectServerAction] Direct Sheet Sync initiated for:', payload.systemId);
    const result = await appendOrderDirectToSheet(payload);
    return result;
  } catch (error: any) {
    console.error('[SheetDirectServerAction] Direct Sheet Sync failed:', error);
    return { success: false, error: error.message };
  }
}
