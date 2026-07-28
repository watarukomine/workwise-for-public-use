import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'workwise-general-v2-kp'
    });
}
const db = admin.firestore();

async function checkUserPasswords() {
    console.log("Checking password fields in Firestore 'users'...");
    const snapshot = await db.collection('users').get();
    
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`DocID: ${doc.id} | Email: ${data.email} | PassFieldExists: ${!!data.password || !!data.pass} | PassVal: "${data.password || data.pass || ''}"`);
    });
}

checkUserPasswords().catch(console.error);
