
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

function mergeStaffDocs(existing: WithId<Staff>, current: WithId<Staff>): WithId<Staff> {
    const isStaffCode = (x: any) => /^STAFF\d+/i.test(String(x.id || '')) || /^STAFF\d+/i.test(String((x as any).staffCode || '')) || /^STAFF\d+/i.test(String((x as any)._docId || ''));

    const getTime = (obj: any) => {
        const t = obj.lastLocationUpdatedAt || obj.updatedAt || obj.statusUpdatedAt;
        if (!t) return 0;
        const d = new Date(t);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const existingTime = getTime(existing);
    const currentTime = getTime(current);

    const hasLocation = (obj: any) => {
        const lat = Number(obj.latitude ?? obj.lat ?? obj['緯度'] ?? obj.currentLocation?.latitude);
        const lng = Number(obj.longitude ?? obj.lng ?? obj['経度'] ?? obj.currentLocation?.longitude);
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    };

    const existingHasLoc = hasLocation(existing);
    const currentHasLoc = hasLocation(current);

    let newerDoc = current;
    let olderDoc = existing;

    if (currentHasLoc && !existingHasLoc) {
        newerDoc = current;
        olderDoc = existing;
    } else if (!currentHasLoc && existingHasLoc) {
        newerDoc = existing;
        olderDoc = current;
    } else if (currentTime >= existingTime) {
        newerDoc = current;
        olderDoc = existing;
    } else {
        newerDoc = existing;
        olderDoc = current;
    }

    const preferredId = isStaffCode(existing) ? existing.id : (isStaffCode(current) ? current.id : (existing.id || current.id));

    return {
        ...olderDoc,
        ...newerDoc,
        id: preferredId,
        _docId: (existing as any)._docId || (current as any)._docId,
        latitude: (newerDoc as any)['緯度'] ?? (newerDoc as any).latitude ?? (newerDoc as any).lat ?? (olderDoc as any)['緯度'] ?? (olderDoc as any).latitude ?? (olderDoc as any).lat,
        longitude: (newerDoc as any)['経度'] ?? (newerDoc as any).longitude ?? (newerDoc as any).lng ?? (olderDoc as any)['経度'] ?? (olderDoc as any).longitude ?? (olderDoc as any).lng,
        currentStatus: (newerDoc as any)['ステータス'] || (newerDoc as any).currentStatus || (newerDoc as any).status || (olderDoc as any)['ステータス'] || (olderDoc as any).currentStatus || (olderDoc as any).status,
        lastAction: (newerDoc as any).lastAction || (olderDoc as any).lastAction,
        estimatedArrivalTime: (newerDoc as any).estimatedArrivalTime || (olderDoc as any).estimatedArrivalTime,
        nextDestination: (newerDoc as any).nextDestination || (olderDoc as any).nextDestination,
        lastLocationUpdatedAt: (newerDoc as any)['最終位置更新日時'] || (newerDoc as any).lastLocationUpdatedAt || (newerDoc as any).statusUpdatedAt || (olderDoc as any)['最終位置更新日時'] || (olderDoc as any).lastLocationUpdatedAt,
        updatedAt: (newerDoc as any).updatedAt || (olderDoc as any).updatedAt,
    } as unknown as WithId<Staff>;
}

export const StaffService = {
    /**
     * Subscribes to real-time updates for all staff members (users).
     */
    subscribeToStaff(callback: (staff: WithId<Staff>[]) => void): () => void {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);
        const q = colRef;

        return onSnapshot(q, (snapshot) => {
            const rawList = snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                // 明示的なスタッフコード（STAFF001形式やstaffCode/code/staffId等）が存在すればそれをIDとして優先設定
                const explicitStaffId = data.staffCode || data.staffId || data.code || data.userCode || (typeof data.id === 'string' && !data.id.includes('@') && data.id !== docSnap.id ? data.id : null);
                const resolvedId = (explicitStaffId && String(explicitStaffId).trim()) 
                    ? String(explicitStaffId).trim() 
                    : docSnap.id;

                return {
                    ...data,
                    id: resolvedId,
                    _docId: docSnap.id
                } as unknown as WithId<Staff>;
            });

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

            // 氏名による完全一意化（重複ドキュメントの統合と動的データの結合）
            const nameMap = new Map<string, WithId<Staff>>();
            for (const s of staffList) {
                const data = s as any;
                const nameKey = String(s.name || data['氏名'] || data['名前'] || '').replace(/[\s\u3000]+/g, '');
                if (!nameKey) continue;

                if (!nameMap.has(nameKey)) {
                    nameMap.set(nameKey, s);
                } else {
                    const existing = nameMap.get(nameKey)!;
                    nameMap.set(nameKey, mergeStaffDocs(existing, s));
                }
            }

            const uniqueStaff = Array.from(nameMap.values());

            const getOrderVal = (x: any) => {
                if (typeof x.sortOrder === 'number') return x.sortOrder;
                if (typeof x.order === 'number') return x.order;
                const idMatch = String(x.id || '').match(/\d+/);
                if (idMatch) return parseInt(idMatch[0], 10);
                return 999;
            };

            uniqueStaff.sort((a, b) => {
                return getOrderVal(a) - getOrderVal(b);
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
            ...docSnap.data(),
            id: docSnap.id
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

        const nameMap = new Map<string, WithId<Staff>>();
        for (const s of staffList) {
            const data = s as any;
            const nameKey = String(s.name || data['氏名'] || data['名前'] || '').replace(/[\s\u3000]+/g, '');
            if (!nameKey) continue;

            if (!nameMap.has(nameKey)) {
                nameMap.set(nameKey, s);
            } else {
                const existing = nameMap.get(nameKey)!;
                nameMap.set(nameKey, mergeStaffDocs(existing, s));
            }
        }

        const uniqueStaff = Array.from(nameMap.values());

        const getOrderVal = (x: any) => {
            if (typeof x.sortOrder === 'number') return x.sortOrder;
            if (typeof x.order === 'number') return x.order;
            const idMatch = String(x.id || '').match(/\d+/);
            if (idMatch) return parseInt(idMatch[0], 10);
            return 999;
        };

        uniqueStaff.sort((a, b) => {
            return getOrderVal(a) - getOrderVal(b);
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
            ...snapshot.data(),
            id: snapshot.id
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
        await setDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp()
        }, { merge: true });
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
