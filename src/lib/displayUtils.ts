/**
 * Utility functions for displaying user-facing data.
 * Ensures internal IDs never leak into the UI.
 */

// UUID pattern matcher
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if a string looks like a UUID
 */
export function isUUID(str: string): boolean {
  return UUID_PATTERN.test(str);
}

/**
 * Filter out UUID-like strings from an array
 * Used to prevent internal IDs from appearing in user-facing lists
 */
export function filterUUIDs(items: string[]): string[] {
  return items.filter(item => !isUUID(item));
}

/**
 * Get display value for a field, returning placeholder if it's a UUID
 */
export function getDisplayValue(value: string | undefined, placeholder: string = '—'): string {
  if (!value) return placeholder;
  if (isUUID(value)) return placeholder;
  return value;
}

/**
 * Safely join array of strings, filtering out UUIDs and empty values
 */
export function joinDisplayValues(items: (string | undefined)[], separator: string = ', '): string {
  const filtered = items
    .filter((item): item is string => Boolean(item))
    .filter(item => !isUUID(item));
  return filtered.length > 0 ? filtered.join(separator) : '—';
}
