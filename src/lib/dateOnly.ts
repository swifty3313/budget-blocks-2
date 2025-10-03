/**
 * Date-only utilities for handling calendar dates without time/timezone concerns.
 * 
 * Pay period bands are date-only concepts - they represent calendar days, not timestamps.
 * Using full Date objects with UTC conversions causes off-by-one errors in many timezones.
 * 
 * This module provides utilities to work with dates as simple 'YYYY-MM-DD' strings.
 */

export type DateOnly = string; // 'YYYY-MM-DD' format

/**
 * Convert a Date object to a date-only string (YYYY-MM-DD) in local time.
 * Uses the date's local year, month, and day - no timezone conversion.
 */
export function toDateOnly(d: Date): DateOnly {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Create a Date object from a date-only string at local midnight.
 * No timezone conversion - the string '2025-10-10' becomes October 10, 2025 at midnight local time.
 */
export function fromDateOnly(s: DateOnly): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d); // Creates date in local timezone
}

/**
 * Parse a date input string to date-only format, handling both native date inputs
 * and Date objects safely in local time.
 */
export function parseDateInput(input: string | Date): DateOnly {
  if (typeof input === 'string') {
    // If already in YYYY-MM-DD format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      return input;
    }
    // Otherwise parse as Date and convert
    const [y, m, d] = input.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return toDateOnly(date);
  }
  return toDateOnly(input);
}

/**
 * Get today's date in date-only format (local time).
 */
export function today(): DateOnly {
  return toDateOnly(new Date());
}

/**
 * Compare two date-only strings.
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareDateOnly(a: DateOnly, b: DateOnly): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Check if a date falls within a range (inclusive).
 */
export function isWithinRange(date: DateOnly, start: DateOnly, end: DateOnly): boolean {
  return date >= start && date <= end;
}
