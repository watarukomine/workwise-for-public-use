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
    subscribeAllOrders(callback: (orders: WithId<Order>[], removedIds?: string[]) => void): () => void {
        const { firestore } = initializeFirebase();
        const colRef = collection(firestore, COLLECTION);
        // Optimize from 3000 to latest 600 orders to ensure instant initial load and low memory usage
        const q = query(colRef, limit(600));
        
        return onSnapshot(q, (snapshot) => {
            const orders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as WithId<Order>));
            const removedIds = snapshot.docChanges()
                .filter(change => change.type === 'removed')
                .map(change => change.doc.id);
            callback(orders, removedIds);
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
    subscribeToOrders(dateStr: string, callback: (orders: WithId<Order>[], removedIds?: string[]) => void): () => void {
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
            const removedIds = snapshot.docChanges()
                .filter(change => change.type === 'removed')
                .map(change => change.doc.id);
            console.log(`[OrderService] Real-time update: ${orders.length} orders found for formats:`, formats, `Removed:`, removedIds);
            callback(orders, removedIds);
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
          status: data.status || '未割当',
          isGasSynced: false
        };

        // 2. Firestore Sync
        await setDoc(docRef, orderData);

        // 3. GAS Backup (Trigger asynchronously in background so user doesn't wait)
        const isGasSynced = (data as any).isGasSynced;
        if (!isGasSynced) {
            this.backupToGas(orderData as any as Order, 'create').catch(e => {
                console.warn('[OrderService] Non-blocking GAS backup warning:', e);
            });
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

        // Trigger GAS backup asynchronously in background so user doesn't wait
        getDoc(docRef).then(fullDoc => {
            if (fullDoc.exists()) {
                this.backupToGas(fullDoc.data() as Order, 'update').catch(e => {
                    console.warn('[OrderService] Non-blocking GAS update backup warning:', e);
                });
            }
        }).catch(e => {
            console.warn('[OrderService] Non-blocking getDoc for GAS update warning:', e);
        });
    },

    /**
     * Backs up data to Google Sheets via GAS Server Action with automatic retries.
     */
    async backupToGas(order: Order, action: 'create' | 'update', maxRetries = 3): Promise<{ status: string, message?: string }> {
        const payload = {
            ...order,
            gasUrl: ORDER_GAS_URL,
            action: action === 'create' ? 'createOrder' : 'updateOrderSchedule',
            operation: action === 'create' ? 'createOrder' : 'updateOrderSchedule',
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
            // Japanese column names for GAS Script compatibility
            SystemID: order.systemId || order.id,
            '受注 No': (order as any).displayId || order.orderNo || '',
            '受注行番号': (order as any).displayId || '',
            'ユーザーコード': order.customerCode || (order as any).userCode || '',
            '店舗名': order.customerName || (order as any).storeName || '',
            '作業区分': order.workType || '',
            '作業予定日': formatDateYMD(order.scheduledDate),
            '予定時間': order.scheduledTime || '',
            'ご担当者様': order.picName || '',
            '受注No(ﾘﾏｰｸ1 8ｹﾀ)': order.orderNo || (order as any).orderNoRemark || '',
            '任意コメント(ﾘﾏｰｸ2　10ｹﾀ)': order.comment || '',
            '車名': order.carName || '',
            '登録ナンバー(下４桁)': order.regNo || '',
            '受注ステータス': order.status || '未割当',
            'タイヤ品番': order.tireNumber || '',
            'タイヤサイズ': order.tireSize || '',
            '品名': order.productName || '',
            '本数': String(order.quantity || ''),
            '空気圧センサーパッキン交換': order.sensor || '',
            'タイヤ手配状況': order.arrangement || '',
            '廃タイヤ処分': order.disposal || '',
            '連絡先': order.contact || '',
            '特記事項': order.specialNotes || '',
            'フォーム入力者': (order as any).submitter || '',
        };

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[OrderService] Triggering GAS backup (attempt ${attempt}/${maxRetries}) for ${order.id || order.systemId}`);
                const res = await updateSheetStatus(payload);
                if (res.status === 'success' || (res.status as string) === 'ok') {
                    console.log('[OrderService] GAS backup successful for order:', order.id || order.systemId);
                    
                    // Update isGasSynced = true in Firestore
                    try {
                        const { firestore } = initializeFirebase();
                        const docRef = doc(firestore, COLLECTION, order.systemId || order.id);
                        await updateDoc(docRef, { isGasSynced: true });
                    } catch (fsErr) {
                        console.warn('[OrderService] Failed to mark isGasSynced:', fsErr);
                    }
                    return res;
                } else {
                    console.warn(`[OrderService] GAS backup attempt ${attempt} returned non-success:`, res.message);
                }
            } catch (e) {
                console.error(`[OrderService] GAS backup attempt ${attempt} threw error:`, e);
            }
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        return { status: 'error', message: 'Maximum retries reached for GAS backup.' };
    },

    /**
     * Auto-recovers and syncs any orders that failed or missed initial GAS sync.
     */
    async syncUnsyncedOrders(): Promise<number> {
        try {
            const { firestore } = initializeFirebase();
            const colRef = collection(firestore, COLLECTION);
            const q = query(colRef, where('isGasSynced', '==', false));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                return 0;
            }

            console.log(`[OrderService] Auto-recovering ${snapshot.size} unsynced orders...`);
            let syncedCount = 0;

            for (const docSnap of snapshot.docs) {
                const orderData = { id: docSnap.id, ...docSnap.data() } as Order;
                const res = await this.backupToGas(orderData, 'create', 2);
                if (res.status === 'success' || res.status === 'ok') {
                    syncedCount++;
                }
            }
            console.log(`[OrderService] Auto-recovered ${syncedCount}/${snapshot.size} orders to GAS.`);
            return syncedCount;
        } catch (e) {
            console.error('[OrderService] Error during syncUnsyncedOrders:', e);
            return 0;
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
