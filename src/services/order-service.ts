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
    onSnapshot,
    orderBy,
    limit
} from 'firebase/firestore';
import type { Order, WithId } from '@/lib/types';
import { CounterService } from './counter-service';
import { ORDER_GAS_URL } from '@/lib/settings';

const COLLECTION = 'orders';

export const OrderService = {
    /**
     * Fetches orders for a specific date (or all if not specified).
     */
    async getOrdersByDate(dateStr: string): Promise<WithId<Order>[]> {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);

        // Try both common formats: yyyy/MM/dd and yyyy-MM-dd
        const formats = [dateStr, dateStr.replace(/-/g, '/'), dateStr.replace(/\//g, '-')];
        
        const results = await Promise.all(formats.map(async (fmt) => {
            const q = query(colRef, where('scheduledDate', '==', fmt));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as WithId<Order>));
        }));

        // Flatten and de-duplicate by ID
        const allOrders = results.flat();
        const uniqueOrders = Array.from(new Map(allOrders.map(item => [item.id, item])).values());
        
        console.log(`[OrderService] Fetched ${uniqueOrders.length} unique orders for formats:`, formats);
        return uniqueOrders;
    },

    /**
     * Fetches generic tasks for a specific date.
     */
    async getTasksByDate(dateStr: string): Promise<WithId<Order>[]> {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);

        const q = query(
            colRef, 
            where('scheduledDate', '==', dateStr),
            where('_type', '==', 'task')
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as WithId<Order>));
    },

    /**
     * Real-time subscription to both orders and tasks for a date.
     * Supports both yyyy/MM/dd and yyyy-MM-dd formats.
     */
    subscribeToOrders(dateStr: string, callback: (orders: WithId<Order>[]) => void): () => void {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);
        
        // Use 'in' query to support both date formats in real-time
        const formats = [dateStr, dateStr.replace(/-/g, '/'), dateStr.replace(/\//g, '-')];
        const q = query(colRef, where('scheduledDate', 'in', formats));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const orders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as WithId<Order>));
            console.log(`[OrderService] Real-time update: ${orders.length} orders found for formats:`, formats);
            callback(orders);
        }, (error) => {
            console.error(`[OrderService] Subscription error:`, error);
        });
        return unsubscribe;
    },

    /**
     * Creates a new order.
     * Performs dual-write: Firestore (Primary) + GAS (Backup).
     */
    async createOrder(data: Partial<Order>): Promise<string> {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);
        
        // 1. Generate IDs
        // Only generate a sequential displayId if it's a real order (has customerCode)
        let displayId = data.displayId || '';
        if (!displayId && data.customerCode) {
          const nextDisplayId = await CounterService.getNextOrderId();
          displayId = String(nextDisplayId);
        }

        const systemId = data.systemId || `${data.scheduledDate?.replace(/\//g, '') || ''}_${data.customerCode || 'new'}_${Math.random().toString(36).substr(2, 5)}`;
        
        const docRef = doc(colRef, systemId);
        const now = serverTimestamp();

        const orderData = {
          ...data,
          id: systemId,
          displayId: displayId,
          systemId: systemId,
          _type: 'order' as const,
          createdAt: now,
          updatedAt: now,
          status: data.status || '未割当'
        };

        // Remove temp property before saving
        delete (orderData as any).isGasSynced;

        // 2. Firestore Sync
        await setDoc(docRef, orderData);

        // 3. GAS Backup (Non-blocking or background call recommended)
        // Note: For spreadsheet parity, we call the createOrder action in GAS
        const isGasSynced = (data as any).isGasSynced;
        if (!isGasSynced) {
            this.backupToGas(orderData as any as Order, 'create');
        }

        return systemId;
    },

    /**
     * Updates an order.
     * Performs dual-write: Firestore + GAS Sync.
     */
    async updateOrder(id: string, data: Partial<Order>): Promise<void> {
        const { firestore } = initializeFirebase();
        const docRef = doc(firestore, COLLECTION, id);
        
        const updateData = {
            ...data,
            updatedAt: serverTimestamp()
        };

        await updateDoc(docRef, updateData);

        // Fetch full data for GAS backup update
        const fullDoc = await getDoc(docRef);
        if (fullDoc.exists()) {
            this.backupToGas(fullDoc.data() as Order, 'update');
        }
    },

    /**
     * Backs up data to Google Sheets via GAS.
     */
    async backupToGas(order: Order, action: 'create' | 'update') {
        try {
            // We can't directly call "use server" actions easily from here if this runs on client.
            // But we can perform a simple fetch to the GAS URL.
            const payload = {
                ...order,
                gasUrl: ORDER_GAS_URL,
                action: action === 'create' ? 'createOrder' : 'updateOrderSchedule',
            };

            // Non-blocking fetch
            fetch(ORDER_GAS_URL, {
                method: 'POST',
                body: JSON.stringify(payload),
                mode: 'no-cors' // Simple fire and forget
            }).catch(e => console.warn('GAS backup background fetch failed:', e));
            
        } catch (e) {
            console.error('Failed to trigger GAS backup:', e);
        }
    },

    async deleteOrder(id: string): Promise<void> {
        const { firestore } = initializeFirebase();
        const docRef = doc(firestore, COLLECTION, id);
        await deleteDoc(docRef);
    },

    async updateStatus(id: string, status: string, location?: { lat: number, lon: number }): Promise<void> {
        const updateData: any = { 
            status,
            updatedAt: serverTimestamp()
        };
        if (location) {
            updateData.latitude = location.lat;
            updateData.longitude = location.lon;
        }
        
        // This is a specialized update, often used in mobile.
        // We ensure it also triggers the backup.
        await this.updateOrder(id, updateData);
    }
};
