import { initializeFirebase } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';
// import { getAuth } from 'firebase/auth'; // Import for REST Auth -> Removed
import { firebaseConfig } from '../firebase/config'; // Import project config
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';


// Lazy init helper
const getDb = () => {
    const { firestore } = initializeFirebase();
    return firestore;
};

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
    const docId = getAttendanceDocId(date);
    try {
        console.log(`[AttendanceService] Fetching attendance for ${date}...`);
        const db = getDb();
        const docRef = doc(db, COLLECTION_NAME, docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log(`[AttendanceService] Successfully fetched attendance for ${docId}`);
            return data.staffIds as string[];
        }
        console.log(`[AttendanceService] No attendance record found for ${docId}`);
        return null;
    } catch (error) {
        console.warn(`[AttendanceService] SDK fetch failed for ${docId}, trying REST fallback...`, error);
        try {
            return await getDailyAttendanceViaRest(date);
        } catch (restError) {
            console.error(`[AttendanceService] REST fallback also failed for ${docId}:`, restError);
            return null;
        }
    }
};

/**
 * Fetches daily attendance using the Firestore REST API.
 */
const getDailyAttendanceViaRest = async (date: Date): Promise<string[] | null> => {
    const docId = getAttendanceDocId(date);
    console.log(`[AttendanceService] Attempting REST API fetch for ${docId}...`);

    const { firestore } = initializeFirebase();
    // @ts-ignore
    const pId = firestore?._databaseId?.projectId || firebaseConfig.projectId;
    // @ts-ignore
    let dbId = firestore?._databaseId?.database;

    // Ensure we use 'workwise' as the database name -> NO
    // Fixed: Use (default) unless specified, because most projects use default
    if (!dbId || dbId === '(default)' || dbId === pId) {
        dbId = '(default)';
    }

    const projectId = pId;
    const databaseId = dbId;
    const collectionName = COLLECTION_NAME;

    // Construct REST URL
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collectionName}/${docId}?key=${firebaseConfig.apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
        if (response.status === 404) {
            console.log(`[AttendanceService] REST: No document found for ${docId}`);
            return null;
        }
        const errorText = await response.text();
        throw new Error(`REST API fetch failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    // Parse Firestore REST format to simple array
    if (data.fields && data.fields.staffIds && data.fields.staffIds.arrayValue && data.fields.staffIds.arrayValue.values) {
        return data.fields.staffIds.arrayValue.values.map((v: any) => v.stringValue);
    }

    return [];
};


/**
 * Fetches attendance data for a whole month.
 * Returns a map of date string (YYYY-MM-DD) -> staff IDs array.
 */
export const getMonthlyAttendance = async (year: number, month: number): Promise<{ [date: string]: string[] }> => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = endOfMonth(startDate);
    const startId = getAttendanceDocId(startDate);
    const endId = getAttendanceDocId(endDate);

    const result: { [date: string]: string[] } = {};

    try {
        console.log(`[AttendanceService] Fetching monthly attendance for ${year}-${month}...`);
        const db = getDb();
        const q = query(
            collection(db, COLLECTION_NAME),
            where('__name__', '>=', startId),
            where('__name__', '<=', endId)
        );

        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.staffIds && Array.isArray(data.staffIds)) {
                result[doc.id] = data.staffIds;
            }
        });
        console.log(`[AttendanceService] Successfully fetched monthly attendance.`);
        return result;

    } catch (error) {
        console.warn(`[AttendanceService] SDK monthly fetch failed, trying REST fallback...`, error);
        try {
            return await getMonthlyAttendanceViaRest(year, month);
        } catch (restError) {
            console.error(`[AttendanceService] REST monthly fallback also failed:`, restError);
            // Return empty object on total failure allows UI to at least render empty table
            return {};
        }
    }
};

/**
 * Fetches monthly attendance using REST API (RunQuery).
 */
const getMonthlyAttendanceViaRest = async (year: number, month: number): Promise<{ [date: string]: string[] }> => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = endOfMonth(startDate);
    const startId = getAttendanceDocId(startDate);
    const endId = getAttendanceDocId(endDate);

    const { firestore } = initializeFirebase();
    // @ts-ignore
    const pId = firestore?._databaseId?.projectId || firebaseConfig.projectId;
    // @ts-ignore
    let dbId = firestore?._databaseId?.database;

    if (!dbId || dbId === '(default)' || dbId === pId) {
        dbId = '(default)';
    }

    const projectId = pId;
    const databaseId = dbId;
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery?key=${firebaseConfig.apiKey}`;

    const queryBody = {
        structuredQuery: {
            from: [{ collectionId: COLLECTION_NAME }],
            where: {
                compositeFilter: {
                    op: 'AND',
                    filters: [
                        { fieldFilter: { field: { fieldPath: '__name__' }, op: 'GREATER_THAN_OR_EQUAL', value: { referenceValue: `projects/${projectId}/databases/${databaseId}/documents/${COLLECTION_NAME}/${startId}` } } },
                        { fieldFilter: { field: { fieldPath: '__name__' }, op: 'LESS_THAN_OR_EQUAL', value: { referenceValue: `projects/${projectId}/databases/${databaseId}/documents/${COLLECTION_NAME}/${endId}` } } }
                    ]
                }
            }
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`REST API monthly fetch failed: ${response.status} - ${errorText}`);
    }

    const json = await response.json();
    const result: { [date: string]: string[] } = {};

    if (Array.isArray(json)) {
        json.forEach((item: any) => {
            if (item.document) {
                // Extract doc ID from full name "projects/.../documents/.../YYYY-MM-DD"
                const parts = item.document.name.split('/');
                const docId = parts[parts.length - 1];

                const staffIdsField = item.document.fields?.staffIds;
                if (staffIdsField && staffIdsField.arrayValue && staffIdsField.arrayValue.values) {
                    result[docId] = staffIdsField.arrayValue.values.map((v: any) => v.stringValue);
                } else if (staffIdsField && staffIdsField.arrayValue && !staffIdsField.arrayValue.values) {
                    // Empty array
                    result[docId] = [];
                }
            }
        });
    }

    return result;
};

/**
 * Fetches scheduled shift data for a whole month.
 * Returns a map of date string (YYYY-MM-DD) -> scheduled staff IDs array.
 */
export const getMonthlySchedule = async (year: number, month: number): Promise<{ [date: string]: string[] }> => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = endOfMonth(startDate);
    const startId = getAttendanceDocId(startDate);
    const endId = getAttendanceDocId(endDate);

    const result: { [date: string]: string[] } = {};

    try {
        console.log(`[AttendanceService] Fetching monthly schedule for ${year}-${month}...`);
        const db = getDb();
        const q = query(
            collection(db, COLLECTION_NAME),
            where('__name__', '>=', startId),
            where('__name__', '<=', endId)
        );

        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.scheduledStaffIds && Array.isArray(data.scheduledStaffIds)) {
                result[doc.id] = data.scheduledStaffIds;
            }
        });
        console.log(`[AttendanceService] Successfully fetched monthly schedule.`);
        return result;

    } catch (error) {
        console.warn(`[AttendanceService] SDK monthly schedule fetch failed, trying REST fallback...`, error);
        try {
            return await getMonthlyScheduleViaRest(year, month);
        } catch (restError) {
            console.error(`[AttendanceService] REST monthly schedule fallback also failed:`, restError);
            return {};
        }
    }
};

/**
 * Fetches monthly schedule using REST API (RunQuery).
 */
const getMonthlyScheduleViaRest = async (year: number, month: number): Promise<{ [date: string]: string[] }> => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = endOfMonth(startDate);
    const startId = getAttendanceDocId(startDate);
    const endId = getAttendanceDocId(endDate);

    const { firestore } = initializeFirebase();
    // @ts-ignore
    const pId = firestore?._databaseId?.projectId || firebaseConfig.projectId;
    // @ts-ignore
    let dbId = firestore?._databaseId?.database;

    if (!dbId || dbId === '(default)' || dbId === pId) {
        dbId = '(default)';
    }

    const projectId = pId;
    const databaseId = dbId;
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery?key=${firebaseConfig.apiKey}`;

    const queryBody = {
        structuredQuery: {
            from: [{ collectionId: COLLECTION_NAME }],
            where: {
                compositeFilter: {
                    op: 'AND',
                    filters: [
                        { fieldFilter: { field: { fieldPath: '__name__' }, op: 'GREATER_THAN_OR_EQUAL', value: { referenceValue: `projects/${projectId}/databases/${databaseId}/documents/${COLLECTION_NAME}/${startId}` } } },
                        { fieldFilter: { field: { fieldPath: '__name__' }, op: 'LESS_THAN_OR_EQUAL', value: { referenceValue: `projects/${projectId}/databases/${databaseId}/documents/${COLLECTION_NAME}/${endId}` } } }
                    ]
                }
            }
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`REST API monthly schedule fetch failed: ${response.status} - ${errorText}`);
    }

    const json = await response.json();
    const result: { [date: string]: string[] } = {};

    if (Array.isArray(json)) {
        json.forEach((item: any) => {
            if (item.document) {
                const parts = item.document.name.split('/');
                const docId = parts[parts.length - 1];

                const scheduleField = item.document.fields?.scheduledStaffIds;
                if (scheduleField && scheduleField.arrayValue && scheduleField.arrayValue.values) {
                    result[docId] = scheduleField.arrayValue.values.map((v: any) => v.stringValue);
                } else if (scheduleField && scheduleField.arrayValue && !scheduleField.arrayValue.values) {
                    result[docId] = [];
                }
            }
        });
    }

    return result;
};


/**
 * Saves daily attendance using the Firestore REST API.
 */
// @ts-ignore
const saveDailyAttendanceViaRest = async (date: Date, staffIds: string[]): Promise<void> => {
    const docId = getAttendanceDocId(date);
    console.log(`[AttendanceService] Attempting REST API save for ${docId}...`);

    // We use a custom auth system (spreadsheet based), so we don't have a Firebase Auth token.
    // The Firestore rules are set to public for this collection during development to allow this.
    // We rely on the API Key in the URL for project identification.

    const { firestore } = initializeFirebase();
    // @ts-ignore
    const pId = firestore?._databaseId?.projectId || firebaseConfig.projectId;
    // @ts-ignore
    let dbId = firestore?._databaseId?.database;

    // Ensure we use 'workwise' unless specifically told otherwise.
    // The previous logic to use projectId as databaseId was incorrect for standard Firestore setups.
    if (!dbId || dbId === '(default)' || dbId === pId) {
        dbId = '(default)';
    }

    console.log(`[AttendanceService] Debug: Project=${pId}, Database=${dbId} (adjusted)`);

    const projectId = pId;
    const databaseId = dbId;
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${COLLECTION_NAME}/${docId}?key=${firebaseConfig.apiKey}&updateMask.fieldPaths=id&updateMask.fieldPaths=date&updateMask.fieldPaths=staffIds&updateMask.fieldPaths=updatedAt`;

    const body = {
        name: `projects/${projectId}/databases/${databaseId}/documents/${COLLECTION_NAME}/${docId}`,
        fields: {
            id: { stringValue: docId },
            date: { timestampValue: date.toISOString() },
            staffIds: {
                arrayValue: {
                    values: staffIds.map(id => ({ stringValue: id }))
                }
            },
            updatedAt: { timestampValue: new Date().toISOString() }
        }
    };

    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`REST API failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    console.log(`[AttendanceService] REST API save successful for ${docId}`);
};

/**
 * Saves the list of attending staff IDs for a specific date.
 */
export const saveDailyAttendance = async (date: Date, staffIds: string[]): Promise<void> => {
    const docId = getAttendanceDocId(date);
    console.log(`[AttendanceService] Saving attendance for ${date}:`, staffIds);
    try {
        const db = getDb();
        const docRef = doc(db, COLLECTION_NAME, docId);
        await setDoc(docRef, {
            id: docId,
            date: date, // Firestore saves as Timestamp
            staffIds: staffIds,
            updatedAt: serverTimestamp(),
        });
        console.log(`[AttendanceService] SDK save successful for ${docId}`);
    } catch (error) {
        console.warn(`[AttendanceService] SDK save failed for ${docId}, switching to REST fallback...`, error);
        await saveDailyAttendanceViaRest(date, staffIds);
    }
};

/**
 * Fetches attendance data including checkedOutIds.
 */
export const getDailyAttendanceDetails = async (date: Date): Promise<{ staffIds: string[], checkedOutIds: string[], scheduledStaffIds: string[] }> => {
    const docId = getAttendanceDocId(date);
    try {
        const db = getDb();
        const docRef = doc(db, COLLECTION_NAME, docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                staffIds: (data.staffIds as string[]) || [],
                checkedOutIds: (data.checkedOutIds as string[]) || [],
                scheduledStaffIds: (data.scheduledStaffIds as string[]) || []
            };
        }
        return { staffIds: [], checkedOutIds: [], scheduledStaffIds: [] };
    } catch (error) {
        console.warn(`[AttendanceService] SDK fetch details failed, returning empty structure...`, error);
        // Fallback to purely 'staffIds' from normal getter if we wanted, but for now just return empty or minimal.
        const simpleIds = await getDailyAttendance(date);
        return { staffIds: simpleIds || [], checkedOutIds: [], scheduledStaffIds: [] };
    }
};

/**
 * Saves monthly scheduled staff (Shift Import) in batch.
 */
export const saveDailyScheduledBatch = async (records: { date: Date; staffIds: string[] }[]): Promise<void> => {
    const db = getDb();

    // Process in chunks of 500
    const chunkDetails = [];
    for (let i = 0; i < records.length; i += 500) {
        chunkDetails.push(records.slice(i, i + 500));
    }

    for (const chunk of chunkDetails) {
        const batch = writeBatch(db);
        chunk.forEach(record => {
            const docId = getAttendanceDocId(record.date);
            const docRef = doc(db, COLLECTION_NAME, docId);
            batch.set(docRef, {
                id: docId,
                date: record.date,
                scheduledStaffIds: record.staffIds, // Write to scheduledStaffIds
                updatedAt: serverTimestamp(),
            }, { merge: true });
        });

        // Add a timeout to batch commit
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Batch Timeout (5s)')), 5000)
        );

        try {
            await Promise.race([batch.commit(), timeoutPromise]);
            console.log(`Scheduled Batch saved ${records.length} records.`);
        } catch (batchError) {
            console.error('Scheduled Batch save failed, skipping REST fallback for now (complicated for schedule):', batchError);
            throw batchError;
        }
    }
};

/**
 * Updates a specific staff's status for a date.
 * status: 'present' (Clock In) | 'checked_out' (Clock Out) | 'absent' (Remove from both)
 */
export const updateStaffStatus = async (date: Date, staffId: string, status: 'present' | 'checked_out' | 'absent'): Promise<void> => {
    const docId = getAttendanceDocId(date);
    const db = getDb();
    const docRef = doc(db, COLLECTION_NAME, docId);

    try {
        // We need to read-modify-write to ensure we don't overwrite other fields concurrently (optimistic locking not strictly needed for this scale yet)
        const current = await getDailyAttendanceDetails(date);
        let newStaffIds = new Set(current.staffIds);
        let newCheckedOutIds = new Set(current.checkedOutIds);

        if (status === 'present') {
            newStaffIds.add(staffId);
            newCheckedOutIds.delete(staffId); // Automatically valid again? Or just remove from checked_out
        } else if (status === 'checked_out') {
            newStaffIds.add(staffId); // Must be in staffIds to be "present via clock-in" even if checked out
            newCheckedOutIds.add(staffId);
        } else if (status === 'absent') {
            newStaffIds.delete(staffId);
            newCheckedOutIds.delete(staffId);
        }

        await setDoc(docRef, {
            id: docId,
            date: date,
            staffIds: Array.from(newStaffIds),
            checkedOutIds: Array.from(newCheckedOutIds),
            updatedAt: serverTimestamp(),
        }, { merge: true });

        console.log(`[AttendanceService] Updated status for ${staffId} to ${status}`);

    } catch (e) {
        console.error("Failed to update staff status", e);
        throw e;
    }
};

/**
 * Saves daily attendance in batch (used for bulk imports).
 * Note: If batch size exceeds 500, caller should split it.
 */
export const saveDailyAttendanceBatch = async (records: { date: Date; staffIds: string[] }[]): Promise<void> => {
    const db = getDb();

    // Process in chunks of 500
    const chunkDetails = [];
    for (let i = 0; i < records.length; i += 500) {
        chunkDetails.push(records.slice(i, i + 500));
    }

    for (const chunk of chunkDetails) {
        const batch = writeBatch(db);
        chunk.forEach(record => {
            const docId = getAttendanceDocId(record.date);
            const docRef = doc(db, COLLECTION_NAME, docId);
            batch.set(docRef, {
                id: docId,
                date: record.date,
                staffIds: record.staffIds,
                updatedAt: serverTimestamp(),
            }, { merge: true });
        });

        // Add a timeout to batch commit
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Batch Timeout (5s)')), 5000)
        );

        try {
            await Promise.race([batch.commit(), timeoutPromise]);
            console.log(`Batch saved ${records.length} records.`);
        } catch (batchError) {
            console.error('Batch save failed/timed out, switching to SERIAL FALLBACK:', batchError);

            // Fallback: Save one by one using REST directly to avoid per-record timeout
            console.warn('[AttendanceService] Batch failed, bypassing SDK and ensuring REST Fallback for all records.');
            let successCount = 0;
            for (const record of records) {
                try {
                    // Direct REST call to save time
                    await saveDailyAttendanceViaRest(record.date, record.staffIds);
                    successCount++;
                } catch (serialError) {
                    console.error(`Serial REST save failed for ${record.date}:`, serialError);
                }
            }
            console.log(`Serial REST fallback completed. Success: ${successCount}/${records.length}`);
            if (successCount === 0) {
                throw new Error('All serial saves failed.');
            }
        }
    }
};
