
'use client';

import { 
  doc, 
  setDoc, 
  serverTimestamp, 
  type DocumentReference, 
  type SetOptions,
  type Firestore,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * A wrapper around Firestore's setDoc that provides detailed, contextual
 * error information for security rule violations.
 * 
 * @param docRef The DocumentReference of the document to write.
 * @param data The data to be written.
 * @param options An object to configure the set behavior.
 */
export async function setDocWithContext(
  docRef: DocumentReference,
  data: Record<string, unknown>,
  options: SetOptions = {}
): Promise<void> {
  // Add a server-side timestamp to the data
  const dataWithTimestamp = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    // Attempt the Firestore operation
    await setDoc(docRef, dataWithTimestamp, options);
  } catch (serverError: any) {
    // If it fails, construct and throw a detailed permission error
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: options.merge || options.mergeFields ? 'update' : 'create',
      requestResourceData: data, // We pass the original data for clarity
    });

    // Emit the error for the global listener
    errorEmitter.emit('permission-error', permissionError);
    
    // Also throw the error so the calling function's promise rejects
    throw permissionError;
  }
}
