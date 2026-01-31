import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date string (likely from Supabase) to the user's local timezone.
 * Handles cases where the source string is UTC but missing the 'Z' suffix.
 */
export function formatMatchDate(dateString: string, options?: Intl.DateTimeFormatOptions): string {
  if (!dateString) return '';

  // Ensure parsing as UTC if it looks like an ISO string without timezone
  // Supabase timestamptz usually returns ISO 8601.
  // If it's missing Z or offset, append Z to force UTC interpretation.
  let safeDateString = dateString;
  if (dateString.includes('T') && !dateString.endsWith('Z') && !dateString.includes('+')) {
    safeDateString = dateString + 'Z';
  }

  const date = new Date(safeDateString);

  // Verify date is valid
  if (isNaN(date.getTime())) return dateString;

  return date.toLocaleString(undefined, options || {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}
