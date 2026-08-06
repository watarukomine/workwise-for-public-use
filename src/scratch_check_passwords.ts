import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
    initializeApp({
        projectId: 'workwise-general-v2-kp'
    });
}
const db = getFirestore();

async function checkUserPasswords() {
    console.log("Checking password fields in Firestore 'users'...");
    const snapshot = await db.collection('users').get();
    
    snapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        console.log(`DocID: ${doc.id} | Email: ${data.email} | PassFieldExists: ${!!data.password || !!data.pass} | PassVal: "${data.password || data.pass || ''}"`);
    });
}

checkUserPasswords().catch(console.error);
