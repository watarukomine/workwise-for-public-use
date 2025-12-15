import { initializeFirebase } from '../firebase';
import { doc, getDoc, setDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { fetchGasData } from '../app/actions/fetch-gas-data';
import { ORDER_GAS_URL } from '../lib/settings';
import { mapRawToOrder } from '../lib/utils';
import { format, parseISO, isValid } from 'date-fns';
import { WithId, Order } from '../lib/types';

const COLLECTION_NAME = 'daily_orders';

export interface DailyOrdersDocument {
    date: string;
    orders: WithId<Order>[];
    updatedAt: Timestamp;
}

// Lazy init helper
const getDb = () => {
    const { firestore } = initializeFirebase();
    return firestore;
}

/**
 * Fetches all orders from GAS, groups them by date, and saves them to Firestore.
 * This effectively snapshots the spreadsheet state into the database for fast retrieval.
 */
export async function syncOrdersFromGasToFirestore(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
        const db = getDb();

        // 1. Fetch Raw Data
        if (!ORDER_GAS_URL) throw new Error("ORDER_GAS_URL is not defined in settings.");

        const result = await fetchGasData(ORDER_GAS_URL);
        if (result.error) throw new Error(result.error);

        const rawOrders = result.data || [];
        if (!Array.isArray(rawOrders)) throw new Error("Invalid data format from GAS");

        // 2. Process and Group by Date
        const ordersByDate = new Map<string, WithId<Order>[]>();
        const noDateOrders: WithId<Order>[] = [];

        rawOrders.forEach((rawOrder: any) => {
            try {
                const order = mapRawToOrder(rawOrder);

                // Determine Date Key
                let dateKey = order.scheduledDate;

                // If scheduledDate is missing, try to parse from other fields or fallback
                if (!dateKey) {
                    const scheduledTimeStr = rawOrder['チップ配置作業予定'];
                    if (scheduledTimeStr) {
                        const d = parseISO(scheduledTimeStr);
                        if (isValid(d)) {
                            dateKey = format(d, 'yyyy-MM-dd');
                        }
                    }
                }

                if (dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
                    if (!ordersByDate.has(dateKey)) {
                        ordersByDate.set(dateKey, []);
                    }
                    ordersByDate.get(dateKey)!.push(order);
                } else {
                    noDateOrders.push(order);
                }
            } catch (e) {
                console.error("Failed to parse order during sync:", rawOrder, e);
            }
        });

        console.log(`[Sync] Raw Orders: ${rawOrders.length}`);
        console.log(`[Sync] Dates found: ${ordersByDate.size}`);
        console.log(`[Sync] No Date Orders: ${noDateOrders.length}`);
        ordersByDate.forEach((val, key) => console.log(`[Sync] Date ${key}: ${val.length} orders`));

        const removeUndefined = (obj: any): any => {
            if (obj === null || obj === undefined) return null;
            if (Object.prototype.toString.call(obj) === '[object Date]') return obj;
            if (Array.isArray(obj)) return obj.map(removeUndefined);
            if (typeof obj === 'object') {
                const result: any = {};
                for (const key in obj) {
                    const val = removeUndefined(obj[key]);
                    if (val !== undefined && val !== null) {
                        result[key] = val;
                    } else if (val === null) {
                        // Explicitly set null to preserve field if that's desired, or skip for undefined?
                        // Firestore supports null.
                        result[key] = null;
                    }
                }
                return result;
            }
            return obj;
        };

        // ... inside syncOrdersFromGasToFirestore ...

        // 3. Save to Firestore (Parallel Writes)
        const promises: Promise<void>[] = [];
        const timestamp = Timestamp.now();

        // Save Dated Orders
        for (const [date, orders] of ordersByDate.entries()) {
            const docRef = doc(db, COLLECTION_NAME, date);
            const sanitizedOrders = removeUndefined(orders);
            promises.push(setDoc(docRef, {
                date,
                orders: sanitizedOrders,
                updatedAt: timestamp
            }));
        }

        // Save Undated Orders (if any)
        if (noDateOrders.length > 0) {
            const docRef = doc(db, COLLECTION_NAME, 'no_date');
            const sanitizedOrders = removeUndefined(noDateOrders);
            promises.push(setDoc(docRef, {
                date: 'no_date',
                orders: sanitizedOrders,
                updatedAt: timestamp
            }));
        }

        await Promise.all(promises);

        return { success: true, count: rawOrders.length };

    } catch (error: any) {
        console.error("Sync Orders Error:", error);
        return { success: false, count: 0, error: error.message };
    }
}

/**
 * Retrieves orders for a specific date from Firestore.
 */
export async function getDailyOrdersFromFirestore(date: Date): Promise<WithId<Order>[]> {
    try {
        const db = getDb();
        const dateKey = format(date, 'yyyy-MM-dd');
        const docRef = doc(db, COLLECTION_NAME, dateKey);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
            const data = snapshot.data() as DailyOrdersDocument;
            return data.orders || [];
        }

        return [];
    } catch (error) {
        console.error(`Failed to get orders for ${date}:`, error);
        return [];
    }
}

/**
 * Retrieves "Unassigned" (No Date) orders from Firestore.
 */
export async function getNoDateOrdersFromFirestore(): Promise<WithId<Order>[]> {
    try {
        const db = getDb();
        const docRef = doc(db, COLLECTION_NAME, 'no_date');
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            const data = snapshot.data() as DailyOrdersDocument;
            return data.orders || [];
        }
        return [];
    } catch (e) {
        console.warn("Failed to get no_date orders", e);
        return [];
    }
}
