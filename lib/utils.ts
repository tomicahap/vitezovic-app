import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely formats a YYYY-MM-DD date string for display in hr-HR locale.
 * Uses local time parsing to avoid timezone-related day shifts.
 */
export function formatDateLong(dateStr: string | null | undefined): string {
  if (!dateStr) return "Nepoznat datum";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    return new Date(y, m - 1, d).toLocaleDateString("hr-HR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "Nepoznat datum";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    return new Date(y, m - 1, d).toLocaleDateString("hr-HR");
  } catch {
    return dateStr;
  }
}

export function generateId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (e) {}
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
