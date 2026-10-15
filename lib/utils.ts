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
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
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
    return new Date(y, m - 1, d).toLocaleDateString("en-GB");
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

/**
 * Provjerava je li funkcija/mandat člana još uvijek aktivan.
 * Podržava godinu (npr. "2026"), hrvatski datum ("15.10.2026", "15.10.2026."),
 * ili ISO datum ("2026-10-15").
 * Ako je vrijednost prazna, mandat se smatra aktivnim (u tijeku).
 */
export function isMandateActive(toYearOrDate?: string | null): boolean {
  if (!toYearOrDate || !toYearOrDate.trim()) return true;
  const val = toYearOrDate.trim();

  // Hrvatski format: DD.MM.YYYY ili DD.MM.YYYY.
  const dotParts = val.replace(/\.+$/, "").split(".");
  if (dotParts.length === 3) {
    const d = parseInt(dotParts[0], 10);
    const m = parseInt(dotParts[1], 10);
    const y = parseInt(dotParts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const mandateEnd = new Date(y, m - 1, d, 23, 59, 59);
      return mandateEnd.getTime() >= Date.now();
    }
  }

  // ISO format: YYYY-MM-DD
  const dashParts = val.split("-");
  if (dashParts.length === 3) {
    const y = parseInt(dashParts[0], 10);
    const m = parseInt(dashParts[1], 10);
    const d = parseInt(dashParts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const mandateEnd = new Date(y, m - 1, d, 23, 59, 59);
      return mandateEnd.getTime() >= Date.now();
    }
  }

  // 4-znamenkasta godina unutar teksta
  const yearMatch = val.match(/\b(19\d\d|20\d\d)\b/);
  if (yearMatch) {
    const y = parseInt(yearMatch[1], 10);
    return y >= new Date().getFullYear();
  }

  // Fallback
  const parsed = parseInt(val, 10);
  if (!isNaN(parsed) && parsed > 1900) {
    return parsed >= new Date().getFullYear();
  }

  return true;
}

/**
 * Parsira godinu ili datum u timestamp za potrebe sortiranja.
 */
export function parseDateOrYearToTimestamp(val?: string | null): number {
  if (!val || !val.trim()) return 0;
  const s = val.trim();

  // DD.MM.YYYY
  const dotParts = s.replace(/\.+$/, "").split(".");
  if (dotParts.length === 3) {
    const d = parseInt(dotParts[0], 10);
    const m = parseInt(dotParts[1], 10);
    const y = parseInt(dotParts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m - 1, d).getTime();
    }
  }

  // YYYY-MM-DD
  const dashParts = s.split("-");
  if (dashParts.length === 3) {
    const y = parseInt(dashParts[0], 10);
    const m = parseInt(dashParts[1], 10);
    const d = parseInt(dashParts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m - 1, d).getTime();
    }
  }

  // 4-digit year
  const match = s.match(/\b(19\d\d|20\d\d)\b/);
  if (match) {
    return new Date(parseInt(match[1], 10), 0, 1).getTime();
  }

  return 0;
}

/**
 * Formatira raspon mandata (od – do).
 */
export function formatMandatePeriod(from?: string | null, to?: string | null): string {
  const fromText = from && from.trim() ? from.trim() : "—";
  const toText = to && to.trim() ? to.trim() : "danas";
  return `${fromText} – ${toText}`;
}

/**
 * Provjerava je li član dio Upravnog odbora / ima aktivnu funkciju.
 */
export function isBoardMember(member?: { functions?: any[] | null } | null): boolean {
  if (!member || !member.functions) return false;
  let fns = member.functions;
  if (typeof fns === 'string') {
    try {
      fns = JSON.parse(fns);
      if (typeof fns === 'string') fns = JSON.parse(fns);
    } catch {
      return false;
    }
  }
  if (!Array.isArray(fns)) return false;
  return fns.some(f => isMandateActive(f?.toYear));
}


