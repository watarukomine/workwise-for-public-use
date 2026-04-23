
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { firebaseConfig } from '../src/firebase/config.ts';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkAttendanceData() {
    console.log("Checking daily_attendance collection...");
    const q = query(collection(db, 'daily_attendance'), orderBy('id', 'desc'), limit(10));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
        console.log("No data found in daily_attendance.");
        return;
    }

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`Date: ${doc.id}`);
        console.log(`- staffIds: ${JSON.stringify(data.staffIds || [])}`);
        console.log(`- scheduledStaffIds: ${JSON.stringify(data.scheduledStaffIds || [])}`);
        console.log(`- updatedAt: ${data.updatedAt?.toDate?.() || data.updatedAt}`);
        console.log("-------------------");
    });
}

checkAttendanceData().catch(console.error);
