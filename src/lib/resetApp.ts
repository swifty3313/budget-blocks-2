import { useStore } from './store';

/**
 * Completely resets the application state by:
 * 1. Clearing localStorage (app-specific keys)
 * 2. Deleting IndexedDB database
 * 3. Resetting in-memory Zustand state
 */
export async function resetApp(): Promise<void> {
  // 1) Clear localStorage keys for this app
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      // Match app-specific storage keys
      if (
        key.startsWith('budget-blocks-') ||
        key === 'budget-blocks-storage' ||
        key.startsWith('bb.') ||
        key.startsWith('budgetBlocks.')
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (e) {
    console.warn('localStorage clear failed', e);
    // Continue with other cleanup steps
  }

  // 2) Clear IndexedDB (Dexie database)
  try {
    const dbName = 'BudgetBlocksDB';
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        console.warn('IndexedDB deletion blocked, but continuing');
        resolve(); // Don't hang on blocked
      };
    });
  } catch (e) {
    console.warn('IndexedDB clear failed', e);
    // Continue with other cleanup steps
  }

  // 3) Reset in-memory Zustand store state
  try {
    useStore.getState().clearAll();
  } catch (e) {
    console.error('Store reset failed', e);
    throw new Error('Failed to reset application state');
  }
}
