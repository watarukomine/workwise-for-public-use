import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'workwise-general-v2-kp'
    });
}
const db = admin.firestore();

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxAsSaNs4MO_ekVuq73N_-OioXBREtbwrNA4mkU6RkGU2hgCZYciav1QiFhVgJxRc_VkQ/exec';

async function pushFirestoreToSheets() {
    console.log("Fetching clean orders from Firestore...");
    const snapshot = await db.collection('orders').get();
    console.log(`Found ${snapshot.docs.length} orders in Firestore to push to Sheets.`);

    let successCount = 0;
    let failCount = 0;

    for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const systemId = data.systemId || data.id || docSnapshot.id;
        
        const payload = {
            gasUrl: GAS_URL,
            action: 'createOrder',
            systemId: systemId,
            displayId: data.displayId || '',
            userCode: data.customerCode || data.userCode || 'guest',
            storeName: data.customerName || data.storeName || '',
            workType: data.workType || '通常作業',
            scheduledDate: data.scheduledDate || '',
            scheduledTime: data.scheduledTime || '',
            picName: data.picName || '',
            orderNo: data.orderNo || '',
            comment: data.comment || '',
            carName: data.carName || '',
            regNo: data.regNo || '',
            status: data.status || '未割当',
            tireNumber: data.tireNumber || '',
            tireSize: data.tireSize || '',
            productName: data.productName || '',
            quantity: String(data.quantity || ''),
            sensor: data.sensor || '',
            arrangement: data.arrangement || '',
            disposal: data.disposal || '',
            contact: data.contact || '',
            specialNotes: data.specialNotes || '',
            submitter: data.submitter || ''
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

        if ((successCount + failCount) % 100 === 0) {
            console.log(`Progress: ${successCount + failCount} / ${snapshot.docs.length} processed...`);
        }
    }

    console.log(`\n=== Push to Sheets Complete ===`);
    console.log(`Total: ${snapshot.docs.length}`);
    console.log(`Success: ${successCount}`);
    console.log(`Fail: ${failCount}`);
}

pushFirestoreToSheets().catch(console.error);
