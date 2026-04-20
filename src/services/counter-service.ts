import { initializeFirebase } from '@/firebase';
import { doc, runTransaction, getDoc } from 'firebase/firestore';

export const CounterService = {
  /**
   * Safe counter increment using a Firestore transaction.
   * Ensures that even with multiple concurrent users, IDs are unique and sequential.
   */
  async getNextOrderId(): Promise<number> {
    const { firestore } = initializeFirebase();
    const counterRef = doc(firestore, 'counters', 'orders');

    try {
      return await runTransaction(firestore, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        
        if (!counterDoc.exists()) {
          // Initialize if it doesn't exist. 
          // Note: In production, we'll initialize this with the current max ID from migration.
          const initialId = 1;
          transaction.set(counterRef, { lastId: initialId });
          return initialId;
        }

        const nextId = (counterDoc.data().lastId || 0) + 1;
        transaction.update(counterRef, { lastId: nextId });
        return nextId;
      });
    } catch (error) {
      console.error('Failed to increment order counter:', error);
      throw error;
    }
  },

  /**
   * Sets the counter to a specific value.
   * Useful during initial migration to set it to the current maximum spreadsheet ID.
   */
  async setCounter(value: number): Promise<void> {
    const { firestore } = initializeFirebase();
    const counterRef = doc(firestore, 'counters', 'orders');
    
    // We don't necessarily need a transaction for a manual set, but it's safer.
    await runTransaction(firestore, async (transaction) => {
      transaction.set(counterRef, { lastId: value }, { merge: true });
    });
    console.log(`Counter 'orders' set to ${value}`);
  }
};
