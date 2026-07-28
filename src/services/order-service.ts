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
        // Fetch all orders (up to 4000) so all current and future orders like 8/27 are loaded
        const q = query(colRef, limit(4000));
        
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

        // 3. GAS Backup (Await to prevent browser HTTP fetch abort on page navigation)
        const isGasSynced = (data as any).isGasSynced;
        if (!isGasSynced) {
            try {
                await this.backupToGas(orderData as any as Order, 'create');
            } catch (e) {
                console.warn('[OrderService] GAS backup warning:', e);
            }
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

        // Await GAS backup to guarantee spreadsheet sync without browser abort
        try {
            const fullDoc = await getDoc(docRef);
            if (fullDoc.exists()) {
                await this.backupToGas(fullDoc.data() as Order, 'update');
            }
        } catch (e) {
            console.warn('[OrderService] GAS update backup warning:', e);
        }
    },

    /**
     * Backs up data to Google Sheets via GAS Server Action with automatic retries.
     */
    async backupToGas(order: Order, action: 'create' | 'update', maxRetries = 3): Promise<{ status: string, message?: string }> {
        const userCodeVal = order.customerCode || (order as any).userCode || (order as any)['ユーザーコード'] || (order as any)['お取引先コード'] || '';
        const storeNameVal = order.customerName || (order as any).storeName || (order as any)['店舗名'] || (order as any)['お取引先名'] || '';
        const workTypeVal = order.workType || (order as any)['作業区分'] || (order as any)['作業内容'] || '';
        const scheduledDateVal = formatDateYMD(order.scheduledDate || (order as any)['作業予定日'] || (order as any).date);
        const scheduledTimeVal = order.scheduledTime || (order as any)['予定時間'] || '';
        const picNameVal = order.picName || (order as any)['ご担当者様'] || '';
        const orderNoVal = order.orderNo || (order as any).orderNoRemark || (order as any)['受注No(ﾘﾏｰｸ1 8ｹﾀ)'] || '';
        const commentVal = order.comment || (order as any)['任意コメント(ﾘﾏｰｸ2　10ｹﾀ)'] || '';
        const carNameVal = order.carName || (order as any)['車名'] || '';
        const regNoVal = String(order.regNo || (order as any)['登録ナンバー(下４桁)'] || '');
        const statusVal = order.status || (order as any)['受注ステータス'] || '未割当';
        const tireNumberVal = order.tireNumber || (order as any)['タイヤ品番'] || '';
        const tireSizeVal = order.tireSize || (order as any)['タイヤサイズ'] || '';
        const productNameVal = order.productName || (order as any)['品名'] || '';
        const quantityVal = String(order.quantity || (order as any)['本数'] || '');
        const sensorVal = order.sensor || (order as any)['空気圧センサーパッキン交換'] || '';
        const arrangementVal = order.arrangement || (order as any)['タイヤ手配状況'] || '';
        const disposalVal = order.disposal || (order as any)['廃タイヤ処分'] || '';
        const contactVal = order.contact || (order as any)['連絡先'] || '';
        const specialNotesVal = order.specialNotes || (order as any)['特記事項'] || '';
        const submitterVal = (order as any).submitter || (order as any)['フォーム入力者'] || '';

        const payload = {
            ...order,
            gasUrl: ORDER_GAS_URL,
            action: action === 'create' ? 'createOrder' : 'updateOrderSchedule',
            operation: action === 'create' ? 'createOrder' : 'updateOrderSchedule',
            systemId: order.systemId || order.id,
            orderId: order.systemId || order.id || (order as any).displayId,
            displayId: (order as any).displayId || '',
            userCode: userCodeVal,
            customerCode: userCodeVal,
            storeName: storeNameVal,
            customerName: storeNameVal,
            workType: workTypeVal,
            scheduledDate: scheduledDateVal,
            scheduledTime: scheduledTimeVal,
            picName: picNameVal,
            orderNo: orderNoVal,
            comment: commentVal,
            carName: carNameVal,
            regNo: regNoVal,
            status: statusVal,
            tireNumber: tireNumberVal,
            tireSize: tireSizeVal,
            productName: productNameVal,
            quantity: quantityVal,
            sensor: sensorVal,
            arrangement: arrangementVal,
            disposal: disposalVal,
            contact: contactVal,
            specialNotes: specialNotesVal,
            submitter: submitterVal,
            // Japanese column names for GAS Script compatibility
            SystemID: order.systemId || order.id,
            '受注 No': (order as any).displayId || orderNoVal || '',
            '受注行番号': (order as any).displayId || '',
            'ユーザーコード': userCodeVal,
            '店舗名': storeNameVal,
            '作業区分': workTypeVal,
            '作業': workTypeVal,
            '作業予定日': scheduledDateVal,
            '予定時間': scheduledTimeVal,
            'ご担当者様': picNameVal,
            '受注No(ﾘﾏｰｸ1 8ｹﾀ)': orderNoVal,
            '任意コメント(ﾘﾏｰｸ2　10ｹﾀ)': commentVal,
            '車名': carNameVal,
            '登録ナンバー(下４桁)': regNoVal,
            '受注ステータス': statusVal,
            '入庫状況': statusVal,
            'タイヤ品番': tireNumberVal,
            'タイヤサイズ': tireSizeVal,
            '品名': productNameVal,
            '本数': quantityVal,
            '空気圧センサーパッキン交換': sensorVal,
            'タイヤ手配状況': arrangementVal,
            '廃タイヤ処分': disposalVal,
            '連絡先': contactVal,
            '特記事項': specialNotesVal,
            'フォーム入力者': submitterVal,
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
