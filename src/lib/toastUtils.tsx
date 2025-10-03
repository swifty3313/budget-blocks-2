import { toast } from "sonner";

/**
 * Centralized toast utilities for consistent messaging across the app
 */

// Toast duration constants
export const TOAST_DURATION = {
  SHORT: 3000,      // Quick confirmations
  MEDIUM: 5000,     // Standard messages
  LONG: 7000,       // Delete actions with Undo
  PERSISTENT: 10000 // Important warnings
} as const;

// Standardized toast messages
export const TOAST_MESSAGES = {
  // Create actions
  CREATED: (type: string) => `${type} created`,
  
  // Update actions
  UPDATED: (type: string) => `${type} updated`,
  SAVED: (type: string) => `${type} saved`,
  
  // Delete actions (use showUndoToast from undoToast.tsx instead)
  DELETED: (type: string) => `${type} deleted`,
  
  // Bulk actions
  BULK_DELETED: (count: number, type: string) => `Deleted ${count} ${type}(s)`,
  
  // Error messages
  ERROR_REQUIRED: (field: string) => `Please enter ${field}`,
  ERROR_INVALID: (field: string) => `Invalid ${field}`,
  ERROR_GENERIC: "Something went wrong",
  
  // Success messages
  SUCCESS_COPIED: "Copied to clipboard",
  SUCCESS_DUPLICATED: (type: string) => `${type} duplicated`,
  SUCCESS_RESTORED: "Restored successfully",
  
  // Info messages
  INFO_NO_CHANGES: "No changes to save",
  INFO_ALREADY_EXISTS: (type: string) => `${type} already exists`,
} as const;

/**
 * Show a success toast with standard duration
 */
export function showSuccessToast(message: string, duration: number = TOAST_DURATION.MEDIUM) {
  toast.success(message, { duration });
}

/**
 * Show an error toast with standard duration
 */
export function showErrorToast(message: string, duration: number = TOAST_DURATION.MEDIUM) {
  toast.error(message, { duration });
}

/**
 * Show an info toast with standard duration
 */
export function showInfoToast(message: string, duration: number = TOAST_DURATION.MEDIUM) {
  toast.info(message, { duration });
}

/**
 * Show a warning toast with longer duration
 */
export function showWarningToast(message: string, duration: number = TOAST_DURATION.PERSISTENT) {
  toast.warning(message, { duration });
}

/**
 * Show a create success toast
 */
export function showCreateToast(type: string) {
  showSuccessToast(TOAST_MESSAGES.CREATED(type), TOAST_DURATION.SHORT);
}

/**
 * Show an update success toast
 */
export function showUpdateToast(type: string) {
  showSuccessToast(TOAST_MESSAGES.UPDATED(type), TOAST_DURATION.SHORT);
}

/**
 * Show a save success toast
 */
export function showSaveToast(type: string) {
  showSuccessToast(TOAST_MESSAGES.SAVED(type), TOAST_DURATION.SHORT);
}
