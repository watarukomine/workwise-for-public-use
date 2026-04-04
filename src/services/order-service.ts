
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
    serverTimestamp,
    Timestamp,
    onSnapshot
} from 'firebase/firestore';
import type { Order, WithId } from '@/lib/types';

const COLLECTION = 'orders';

export const OrderService = {
    /**
     * Fetches orders for a specific date (or all if not specified).
     * Note: This replaces the daily-sheet based fetching.
     */
    async getOrdersByDate(dateStr: string): Promise<WithId<Order>[]> {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);

        // Query orders where scheduledDate == dateStr
        // We assume scheduledDate is stored as YYYY-MM-DD string as per type definition
        const q = query(colRef, where('scheduledDate', '==', dateStr));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as WithId<Order>));
    },

    /**
     * Real-time subscription to orders for a date.
     */
    subscribeToOrders(dateStr: string, callback: (orders: WithId<Order>[]) => void): () => void {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);
        const q = query(colRef, where('scheduledDate', '==', dateStr));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const orders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as WithId<Order>));
            callback(orders);
        });
        return unsubscribe;
    },

    /**
     * Fetches unassigned orders.
     * Assuming strict definition: no staffId assignment.
     */
    async getUnassignedOrders(): Promise<WithId<Order>[]> {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);
        // Query where staffId is null or empty
        const q = query(colRef, where('staffId', '==', null));
        // Firestore doesn't support OR in simple queries for (null OR empty). 
        // We might need to filter client side or ensure we always store null for unassigned.

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as WithId<Order>));
    },

    /**
     * Fetches a single order by ID.
     */
    async getOrderById(id: string): Promise<WithId<Order> | null> {
        const { firestore } = initializeFirebase();
        const docRef = doc(firestore, COLLECTION, id);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) return null;

        return {
            id: snapshot.id,
            ...snapshot.data()
        } as WithId<Order>;
    },

    /**
     * Creates a new order.
     * Supports both object-based creation and mapping from form args.
     */
    async createOrder(data: Partial<Order>): Promise<string> {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);
        const docRef = doc(colRef); // Generate ID

        const now = serverTimestamp();

        // Ensure minimal fields
        const orderData = {
            ...data,
            id: docRef.id,
            createdAt: now,
            updatedAt: now,
            // Default status if not provided
            status: data.status || '未割当'
        };

        await setDoc(docRef, orderData);

        return docRef.id;
    },

    /**
     * Updates an order.
     */
    async updateOrder(id: string, data: Partial<Order>): Promise<void> {
        const { firestore } = initializeFirebase();
        const docRef = doc(firestore, COLLECTION, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp()
        });
    },

    /**
      * Deletes an order.
      */
    async deleteOrder(id: string): Promise<void> {
        const { firestore } = initializeFirebase();
        const docRef = doc(firestore, COLLECTION, id);
        await deleteDoc(docRef);
    },

    /**
     * Specialized method to update status/location (e.g. from mobile app)
     */
    async updateStatus(id: string, status: string, location?: { lat: number, lon: number }): Promise<void> {
        const updateData: any = { status };
        if (location) {
            updateData.latitude = location.lat;
            updateData.longitude = location.lon;
        }
        await this.updateOrder(id, updateData);
    }
};
