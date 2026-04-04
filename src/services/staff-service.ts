
import { initializeFirebase } from '@/firebase';
import {
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    serverTimestamp
} from 'firebase/firestore';
import type { Staff, WithId } from '@/lib/types';

const COLLECTION = 'users';

export const StaffService = {
    /**
     * Fetches all staff members (users).
     * Typically used by Admin.
     */
    async getAllStaff(): Promise<WithId<Staff>[]> {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);
        const snapshot = await getDocs(colRef);

        return snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        } as WithId<Staff>));
    },

    /**
     * Fetches a single staff member by ID.
     */
    async getStaffById(id: string): Promise<WithId<Staff> | null> {
        const { firestore } = initializeFirebase();
        const docRef = doc(firestore, COLLECTION, id);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) return null;

        return {
            id: snapshot.id,
            ...snapshot.data()
        } as WithId<Staff>;
    },

    /**
     * Gets a staff member by email.
     */
    async getStaffByEmail(email: string): Promise<WithId<Staff> | null> {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);
        const q = query(colRef, where('email', '==', email));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

        const docSnap = snapshot.docs[0];
        return {
            id: docSnap.id,
            ...docSnap.data()
        } as WithId<Staff>;
    },

    /**
     * Updates a staff member's profile.
     */
    async updateStaff(id: string, data: Partial<Staff>): Promise<void> {
        const { firestore } = initializeFirebase();
        const docRef = doc(firestore, COLLECTION, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Creates or overwrites a staff member.
     */
    async saveStaff(id: string, data: Staff): Promise<void> {
        const { firestore } = initializeFirebase();
        const docRef = doc(firestore, COLLECTION, id);
        await setDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp()
        }, { merge: true });
    }
};
