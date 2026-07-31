
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
        const q = colRef;

        return onSnapshot(q, (snapshot) => {
            const rawList = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            } as WithId<Staff>));

            const staffList = rawList.filter(s => {
                const data = s as any;
                if (data._type === 'order' || data.orderNo || data.customerName || data.orderType) return false;
                
                const name = String(s.name || data['氏名'] || data['名前'] || '').trim();
                const email = String(s.email || '').trim();
                const id = String(s.id || '').trim();

                if (!name || name === '名前未設定') return false;

                const isNumericName = /^[0-9]+$/.test(name);
                const isNumericId = /^[0-9]+$/.test(id);
                if ((isNumericName || isNumericId) && (!email || email === '-')) {
                    return false;
                }
                return true;
            });

            // ID / 氏名による重複排除
            const seenIds = new Set<string>();
            const uniqueStaff: WithId<Staff>[] = [];
            for (const s of staffList) {
                const nameKey = String(s.name || (s as any)['氏名'] || '').replace(/[\s\u3000]+/g, '');
                const key = `${s.id}_${nameKey}`;
                if (!seenIds.has(key)) {
                    seenIds.add(key);
                    uniqueStaff.push(s);
                }
            }

            uniqueStaff.sort((a, b) => {
                const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : (typeof (a as any).order === 'number' ? (a as any).order : 999);
                const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : (typeof (b as any).order === 'number' ? (b as any).order : 999);
                return orderA - orderB;
            });

            callback(uniqueStaff);
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
        const snapshot = await getDocs(colRef);

        const rawList = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        } as WithId<Staff>));

        const staffList = rawList.filter(s => {
            const data = s as any;
            if (data._type === 'order' || data.orderNo || data.customerName || data.orderType) return false;
            
            const name = String(s.name || data['氏名'] || data['名前'] || '').trim();
            const email = String(s.email || '').trim();
            const id = String(s.id || '').trim();

            if (!name || name === '名前未設定') return false;

            const isNumericName = /^[0-9]+$/.test(name);
            const isNumericId = /^[0-9]+$/.test(id);
            if ((isNumericName || isNumericId) && (!email || email === '-')) {
                return false;
            }
            return true;
        });

        const seenIds = new Set<string>();
        const uniqueStaff: WithId<Staff>[] = [];
        for (const s of staffList) {
            const nameKey = String(s.name || (s as any)['氏名'] || '').replace(/[\s\u3000]+/g, '');
            const key = `${s.id}_${nameKey}`;
            if (!seenIds.has(key)) {
                seenIds.add(key);
                uniqueStaff.push(s);
            }
        }

        uniqueStaff.sort((a, b) => {
            const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : (typeof (a as any).order === 'number' ? (a as any).order : 999);
            const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : (typeof (b as any).order === 'number' ? (b as any).order : 999);
            return orderA - orderB;
        });

        return uniqueStaff;
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

        const allDocs = await getDocs(colRef);
        const existingStaffIds = allDocs.docs.map(d => d.id);
        
        let newId = data.id;
        if (!newId) {
            let maxNum = 0;
            existingStaffIds.forEach(id => {
                const match = id.match(/^STAFF(\d+)$/i);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (num > maxNum) maxNum = num;
                }
            });
            newId = `STAFF${String(maxNum + 1).padStart(3, '0')}`;
        }

        const docRef = doc(colRef, newId);
        const staffData = {
            id: newId,
            name: data.name || '新規スタッフ',
            email: data.email || `${newId.toLowerCase()}@${process.env.NEXT_PUBLIC_STAFF_EMAIL_DOMAIN || 'example.com'}`,
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
