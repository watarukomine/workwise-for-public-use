
import { initializeFirebase } from '@/firebase';
import {
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from 'firebase/firestore';
import type { Customer, WithId } from '@/lib/types';
import { CUSTOMER_GAS_URL } from '@/lib/settings';

const COLLECTION = 'customers';

export const CustomerService = {
    /**
     * Fetches all customers.
     */
    async getAllCustomers(): Promise<WithId<Customer>[]> {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);
        const snapshot = await getDocs(colRef);

        const normalizeCustomer = (data: any, id: string): WithId<Customer> => {
            const rawLat = data.latitude ?? data.lat ?? data['緯度'];
            const rawLng = data.longitude ?? data.lng ?? data['経度'];
            const lat = rawLat !== undefined && rawLat !== null && rawLat !== '' ? Number(rawLat) : undefined;
            const lng = rawLng !== undefined && rawLng !== null && rawLng !== '' ? Number(rawLng) : undefined;
            const name = data.name || data['店舗'] || data['店舗名'] || data['販売店名'] || data['顧客名'] || '名称未設定';
            const address = data.address || data['住所'] || '';

            return {
                ...data,
                id,
                name,
                address,
                latitude: (lat !== undefined && !isNaN(lat)) ? lat : undefined,
                longitude: (lng !== undefined && !isNaN(lng)) ? lng : undefined,
                '店舗': name,
                '住所': address,
                '緯度': lat,
                '経度': lng
            } as WithId<Customer>;
        };

        return snapshot.docs.map(doc => normalizeCustomer(doc.data(), doc.id));
    },

    /**
     * Fetches a single customer by ID.
     */
    async getCustomerById(id: string): Promise<WithId<Customer> | null> {
        const { firestore } = initializeFirebase();
        const docRef = doc(firestore, COLLECTION, id);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) return null;

        const data = snapshot.data();
        const rawLat = data.latitude ?? data.lat ?? data['緯度'];
        const rawLng = data.longitude ?? data.lng ?? data['経度'];
        const lat = rawLat !== undefined && rawLat !== null && rawLat !== '' ? Number(rawLat) : undefined;
        const lng = rawLng !== undefined && rawLng !== null && rawLng !== '' ? Number(rawLng) : undefined;
        const name = data.name || data['店舗'] || data['店舗名'] || data['販売店名'] || data['顧客名'] || '名称未設定';
        const address = data.address || data['住所'] || '';

        return {
            ...data,
            id: snapshot.id,
            name,
            address,
            latitude: (lat !== undefined && !isNaN(lat)) ? lat : undefined,
            longitude: (lng !== undefined && !isNaN(lng)) ? lng : undefined,
            '店舗': name,
            '住所': address,
            '緯度': lat,
            '経度': lng
        } as WithId<Customer>;
    },

    /**
     * Creates a new customer.
     * If ID is not provided, Firestore auto-generates it.
     */
    async createCustomer(data: Omit<Customer, 'id'>): Promise<string> {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);
        const docRef = doc(colRef); // Generate ID

        await setDoc(docRef, {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // GAS Backup
        this.backupToGas(docRef.id, data, 'updateCustomer');

        return docRef.id;
    },

    /**
     * Updates a customer.
     */
    async updateCustomer(id: string, data: Partial<Customer>): Promise<void> {
        const { firestore } = initializeFirebase();
        const docRef = doc(firestore, COLLECTION, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp()
        });

        // GAS Backup
        // Fetch full data if possible, or just send partial data if GAS handles it
        this.backupToGas(id, data, 'updateCustomer');
    },

    /**
     * Backs up customer data to Google Sheets via GAS.
     */
    async backupToGas(id: string, data: any, action: string) {
        try {
            // Map English keys back to Japanese header names for Google Sheets
            const gasData = {
                ...data,
                'ユーザーコード': data.userCode !== undefined ? data.userCode : data['ユーザーコード'],
                '店舗': data.storeName !== undefined ? data.storeName : data['店舗'],
                '住所': data.address !== undefined ? data.address : data['住所'],
                '緯度': data.latitude !== undefined ? data.latitude : data['緯度'],
                '経度': data.longitude !== undefined ? data.longitude : data['経度'],
                '母店': data.mainStore !== undefined ? data.mainStore : data['母店'],
            };

            // Clean up English keys to avoid unused properties in GAS payload
            delete gasData.userCode;
            delete gasData.storeName;
            delete gasData.address;
            delete gasData.latitude;
            delete gasData.longitude;
            delete gasData.mainStore;

            fetch(CUSTOMER_GAS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...gasData,
                    id: id,
                    action: action
                }),
            }).catch(e => console.error("GAS Customer Backup request failed:", e));
        } catch (e) {
            console.error("GAS Customer Backup failed:", e);
        }
    },


    /**
      * Deletes a customer.
      */
    async deleteCustomer(id: string): Promise<void> {
        const { firestore } = initializeFirebase();
        const docRef = doc(firestore, COLLECTION, id);
        await deleteDoc(docRef);
    }
};
