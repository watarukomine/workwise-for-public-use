
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
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore';
import type { Staff, WithId } from '@/lib/types';

const COLLECTION = 'users';

export const StaffService = {
    /**
     * Subscribes to real-time updates for all staff members (users).
     */
    subscribeToStaff(callback: (staff: WithId<Staff>[]) => void): () => void {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);
        const q = query(colRef, where('_type', '!=', 'order'));

        return onSnapshot(q, (snapshot) => {
            const staffList = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            } as WithId<Staff>));
            callback(staffList);
        }, (error) => {
            console.error("[StaffService] Error in staff realtime subscription:", error);
        });
    },

    /**
     * Fetches all staff members (users).
     * Typically used by Admin.
     */
    async getAllStaff(): Promise<WithId<Staff>[]> {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);
        // During transition, we filter out known 'order' types to avoid junk
        const q = query(colRef, where('_type', '!=', 'order'));
        const snapshot = await getDocs(q);

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
        const q = query(colRef, where('email', '==', email.trim().toLowerCase()));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

        // Filter out any accidentally imported order docs that might have an email field matches
        const staffDocs = snapshot.docs.filter(doc => doc.data()._type !== 'order');
        if (staffDocs.length === 0) return null;

        const docSnap = staffDocs[0];
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
     * Creates a new staff member in Firestore.
     */
    async createStaff(data: Partial<Staff>): Promise<string> {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);

        const staffDocs = await getDocs(query(colRef, where('_type', '!=', 'order')));
        const nextIndex = staffDocs.size + 1;
        const newId = data.id || `STAFF${String(nextIndex).padStart(3, '0')}`;

        const docRef = doc(colRef, newId);
        const staffData = {
            id: newId,
            name: data.name || '新規スタッフ',
            email: data.email || `${newId.toLowerCase()}@toyota-mp.co.jp`,
            role: data.role || 'staff',
            area: data.area || '県央',
            '母店': data['母店'] || '横浜店',
            color: data.color || '#3B82F6',
            currentStatus: '待機中',
            _type: 'staff' as const,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...data,
        };

        await setDoc(docRef, staffData, { merge: true });
        return newId;
    },

    /**
     * Creates or overwrites a staff member.
     */
    async saveStaff(id: string, data: Staff): Promise<void> {
        const { firestore } = initializeFirebase();
        const docRef = doc(firestore, COLLECTION, id);
        const staffData = {
            ...data,
            _type: 'staff' as const,
            updatedAt: serverTimestamp()
        };
        await setDoc(docRef, staffData, { merge: true });
    }
};
