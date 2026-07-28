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
import { updateSheetStatus } from '@/app/actions/gas-actions';

const COLLECTION = 'orders';

function generateDateFormats(dateStr: string): string[] {
    const cleanStr = dateStr.split('T')[0];
    const parts = cleanStr.includes('-') ? cleanStr.split('-') : cleanStr.split('/');
    if (parts.length === 3) {
        const year = parts[0];
        const month = String(parseInt(parts[1], 10));
        const day = String(parseInt(parts[2], 10));
        const padMonth = month.padStart(2, '0');
        const padDay = day.padStart(2, '0');

        return Array.from(new Set([
            `${year}-${padMonth}-${padDay}`,
            `${year}/${padMonth}/${padDay}`,
            `${year}-${month}-${day}`,
        ]));
    }
    return [dateStr, dateStr.replace(/-/g, '/'), dateStr.replace(/\//g, '-')];
}

function formatDateYMD(dateStr?: string): string {
    if (!dateStr) return '';
    const cleanStr = String(dateStr).trim();
    if (!cleanStr) return '';

    if (cleanStr.includes('T') || cleanStr.includes('Z')) {
        const d = new Date(cleanStr);
        if (!isNaN(d.getTime())) {
            const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
            const yyyy = jst.getUTCFullYear();
            const mm = String(jst.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(jst.getUTCDate()).padStart(2, '0');
            return `${yyyy}/${mm}/${dd}`;
        }
    }

    if (cleanStr.includes('-')) {
        const parts = cleanStr.split('-');
        if (parts.length === 3) {
            return `${parts[0]}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`;
        }
    }

    if (cleanStr.includes('/')) {
        const parts = cleanStr.split('/');
        if (parts.length === 3) {
            return `${parts[0]}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`;
        }
    }

    return cleanStr;
}

export const OrderService = {
    /**
     * Fetches all orders from Firestore (with optional limit).
     */
    async getAllOrders(limitCount = 3000): Promise<WithId<Order>[]> {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);
        const q = query(colRef, limit(limitCount));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as WithId<Order>));
    },

    /**
     * Subscribes to all orders in real-time.
     */
    /**
     * Subscribes to recent orders (latest 500) for high performance without fetching 3,000+ docs.
     */
    subscribeAllOrders(callback: (orders: WithId<Order>[]) => void): () => void {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);
        // Optimize from 3000 to latest 600 orders to ensure instant initial load and low memory usage
        const q = query(colRef, limit(600));
        
        return onSnapshot(q, (snapshot) => {
            const orders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as WithId<Order>));
            callback(orders);
        }, (error) => {
            console.error(`[OrderService] Subscribe all orders error:`, error);
        });
    },

    /**
     * Fetches orders for a specific date (or all if not specified).
     */
    async getOrdersByDate(dateStr: string): Promise<WithId<Order>[]> {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);

        const formats = generateDateFormats(dateStr);
        
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

        const formats = generateDateFormats(dateStr);
        const q = query(
            colRef, 
            where('scheduledDate', 'in', formats),
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
     * Supports yyyy/MM/dd, yyyy-MM-dd, yyyy/M/d, yyyy-M-d formats in real-time.
     */
    subscribeToOrders(dateStr: string, callback: (orders: WithId<Order>[]) => void): () => void {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);
        
        const formats = generateDateFormats(dateStr);
        // Firestore 'in' operator supports up to 30 elements
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

        // 3. GAS Backup (Synchronous await to guarantee real-time spreadsheet write)
        const isGasSynced = (data as any).isGasSynced;
        if (!isGasSynced) {
            await this.backupToGas(orderData as any as Order, 'create');
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
            await this.backupToGas(fullDoc.data() as Order, 'update');
        }
    },

    /**
     * Backs up data to Google Sheets via GAS Server Action.
     */
    async backupToGas(order: Order, action: 'create' | 'update') {
        try {
            const payload = {
                ...order,
                gasUrl: ORDER_GAS_URL,
                action: action === 'create' ? 'createOrder' : 'updateOrderSchedule',
                systemId: order.systemId || order.id,
                orderId: order.systemId || order.id || (order as any).displayId,
                displayId: (order as any).displayId || '',
                userCode: order.customerCode || (order as any).userCode || '',
                customerCode: order.customerCode || (order as any).userCode || '',
                storeName: order.customerName || (order as any).storeName || '',
                customerName: order.customerName || (order as any).storeName || '',
                workType: order.workType || '',
                scheduledDate: formatDateYMD(order.scheduledDate),
                scheduledTime: order.scheduledTime || '',
                picName: order.picName || '',
                orderNo: order.orderNo || (order as any).orderNoRemark || '',
                comment: order.comment || '',
                carName: order.carName || '',
                regNo: order.regNo || '',
                status: order.status || '未割当',
                tireNumber: order.tireNumber || '',
                tireSize: order.tireSize || '',
                productName: order.productName || '',
                quantity: String(order.quantity || ''),
                sensor: order.sensor || '',
                arrangement: order.arrangement || '',
                disposal: order.disposal || '',
                contact: order.contact || '',
                specialNotes: order.specialNotes || '',
                submitter: (order as any).submitter || '',
            };

            // Call Server Action synchronously to guarantee real-time spreadsheet write before returning
            const res = await updateSheetStatus(payload);
            if (res.status === 'error') {
                console.warn('[OrderService] GAS backup returned error status:', res.message);
            } else {
                console.log('[OrderService] GAS backup successful for order:', order.id || order.systemId);
            }

        } catch (e) {
            console.error('[OrderService] Failed to trigger GAS backup:', e);
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
