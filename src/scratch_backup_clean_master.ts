import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
    initializeApp({
        projectId: 'workwise-general-v2-kp'
    });
}
const db = getFirestore();

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxAsSaNs4MO_ekVuq73N_-OioXBREtbwrNA4mkU6RkGU2hgCZYciav1QiFhVgJxRc_VkQ/exec';

async function backupCleanMasterToSheets() {
    console.log("Fetching all clean valid orders from Firestore for dual-spreadsheet backup...");
    const snapshot = await db.collection('orders').get();
    
    // Filter to only valid orders (exclude generic tasks and guest test submissions)
    const cleanOrders = snapshot.docs.filter((doc: any) => {
        const data = doc.data();
        const docId = doc.id;
        const type = data._type;
        const userCode = String(data.customerCode || data.userCode || '').trim();
        const storeName = String(data.customerName || data.storeName || '').trim();

        const isTask = type === 'task' || docId.startsWith('task-') || docId.startsWith('trip-') || docId.startsWith('generic-');
        if (isTask) return false;
        if (userCode === 'guest' || userCode === '' || !storeName) return false;

        return true;
    });

    console.log(`Found ${cleanOrders.length} valid master orders to backup to both Google Spreadsheets.`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < cleanOrders.length; i++) {
        const docSnapshot = cleanOrders[i];
        const data = docSnapshot.data();
        const systemId = data.systemId || data.id || docSnapshot.id;
        
        const payload = {
            gasUrl: GAS_URL,
            action: 'createOrder',
            systemId: systemId,
            // Spread all remaining order fields; explicit overrides keep default values if needed
            ...data
        };

        try {
            const res = await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (json.status === 'success') {
                successCount++;
            } else {
                failCount++;
            }
        } catch (err: any) {
            failCount++;
        }

        if ((i + 1) % 100 === 0 || i + 1 === cleanOrders.length) {
            console.log(`Backup Progress: ${i + 1} / ${cleanOrders.length} orders processed... (Success: ${successCount}, Fail: ${failCount})`);
        }
    }

    console.log(`\n=== Dual Spreadsheet Master Backup Complete ===`);
    console.log(`Total Valid Orders: ${cleanOrders.length}`);
    console.log(`Successfully Backed Up: ${successCount}`);
    console.log(`Failed: ${failCount}`);
}

backupCleanMasterToSheets().catch(console.error);
