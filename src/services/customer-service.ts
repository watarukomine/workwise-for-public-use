
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
import type { Customer, WithId } from '@/lib/types';
import { ORDER_GAS_URL } from '@/config/settings';

const COLLECTION = 'customers';

export const CustomerService = {
    /**
     * Fetches all customers.
     */
    async getAllCustomers(): Promise<WithId<Customer>[]> {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);
        const snapshot = await getDocs(colRef);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as WithId<Customer>));
    },

    /**
     * Fetches a single customer by ID.
     */
    async getCustomerById(id: string): Promise<WithId<Customer> | null> {
        const { firestore } = initializeFirebase();
        const docRef = doc(firestore, COLLECTION, id);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) return null;

        return {
            id: snapshot.id,
            ...snapshot.data()
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
            fetch(ORDER_GAS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...data,
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
