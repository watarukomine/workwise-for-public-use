'use server';

// This file acts as a temporary re-export to bridge the gap during refactoring.
// It imports the function from its new location and exports it from the old path.
// This resolves the "Module not found" error without needing to change every import statement immediately.
export { updateSheetStatus } from './gas-actions';
