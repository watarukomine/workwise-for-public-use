import { initializeFirebase } from '@/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';

const { firestore: db } = initializeFirebase();

const COLLECTION_NAME = 'daily_attendance';

/**
 * Generates the document ID from a Date object (YYYY-MM-DD).
 */
export const getAttendanceDocId = (date: Date): string => {
    return format(date, 'yyyy-MM-dd');
};

/**
 * Fetches the list of attending staff IDs for a specific date.
 * Returns null if no record exists for that date.
 */
export const getDailyAttendance = async (date: Date): Promise<string[] | null> => {
    try {
        const docId = getAttendanceDocId(date);
        const docRef = doc(db, COLLECTION_NAME, docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            return data.staffIds as string[];
        }
        return null;
    } catch (error) {
        console.error(`Error fetching daily attendance for ${date}:`, error);
        // In case of error, return null to avoid breaking the UI, 
        // but log it. The UI might fallback to defaults or previous state.
        return null;
    }
};

/**
 * Saves the list of attending staff IDs for a specific date.
 */
export const saveDailyAttendance = async (date: Date, staffIds: string[]): Promise<void> => {
    try {
        const docId = getAttendanceDocId(date);
        const docRef = doc(db, COLLECTION_NAME, docId);

        await setDoc(docRef, {
            id: docId,
            date: docId,
            staffIds,
            updatedAt: serverTimestamp(),
        }, { merge: true });

        console.log(`Saved attendance for ${docId}: ${staffIds.length} staff.`);
    } catch (error) {
        console.error(`Error saving daily attendance for ${date}:`, error);
        throw error;
    }
};
