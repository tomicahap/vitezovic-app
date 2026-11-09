import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Univerzalni formater datuma u format DD/MM/YYYY.
 * Podržava ISO (YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss), hrvatske datume (DD.MM.YYYY),
 * već formatirane DD/MM/YYYY, Date objekte i timestampove.
 */
export function formatDateDMY(input: any, fallback = "—"): string {
  if (input === undefined || input === null) return fallback;
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return fallback;
    const d = String(input.getDate()).padStart(2, "0");
    const m = String(input.getMonth() + 1).padStart(2, "0");
    const y = input.getFullYear();
    return `${d}/${m}/${y}`;
  }
  if (typeof input === "number") {
    const dt = new Date(input);
    if (isNaN(dt.getTime())) return fallback;
    const d = String(dt.getDate()).padStart(2, "0");
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const y = dt.getFullYear();
    return `${d}/${m}/${y}`;
  }

  const raw = String(input).trim();
  if (!raw || raw === "—" || raw === "-") return fallback;

  // 1. YYYY-MM-DD na početku stringa (uključuje ISO s vremenom)
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, "0");
    const d = isoMatch[3].padStart(2, "0");
    return `${d}/${m}/${y}`;
  }

  // 2. DD/MM/YYYY ili D/M/YYYY
  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const d = slashMatch[1].padStart(2, "0");
    const m = slashMatch[2].padStart(2, "0");
    const y = slashMatch[3];
    return `${d}/${m}/${y}`;
  }

  // 3. DD.MM.YYYY ili DD. MM. YYYY.
  const dotMatch = raw.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?/);
  if (dotMatch) {
    const d = dotMatch[1].padStart(2, "0");
    const m = dotMatch[2].padStart(2, "0");
    const y = dotMatch[3];
    return `${d}/${m}/${y}`;
  }

  // 4. Samo 4-znamenkasta godina (npr. "2024")
  if (/^\d{4}$/.test(raw)) {
    return raw;
  }

  // 5. Fallback na Date parser (npr. RFC2822 iz e-mailova)
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, "0");
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const y = parsed.getFullYear();
    return `${d}/${m}/${y}`;
  }

  return raw;
}

/**
 * Univerzalni formater datuma i vremena u format DD/MM/YYYY HH:mm (ili s sekundama ako je includeSeconds=true).
 */
export function formatDateTimeDMY(input: any, fallback = "—", includeSeconds = false): string {
  if (input === undefined || input === null) return fallback;
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return fallback;
    const d = String(input.getDate()).padStart(2, "0");
    const m = String(input.getMonth() + 1).padStart(2, "0");
    const y = input.getFullYear();
    const hh = String(input.getHours()).padStart(2, "0");
    const mm = String(input.getMinutes()).padStart(2, "0");
    const ss = String(input.getSeconds()).padStart(2, "0");
    return includeSeconds ? `${d}/${m}/${y} ${hh}:${mm}:${ss}` : `${d}/${m}/${y} ${hh}:${mm}`;
  }

  const raw = String(input).trim();
  if (!raw || raw === "—" || raw === "-") return fallback;

  // Ako je samo YYYY-MM-DD bez vremena
  const pureIsoDate = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (pureIsoDate) {
    return `${pureIsoDate[3].padStart(2, "0")}/${pureIsoDate[2].padStart(2, "0")}/${pureIsoDate[1]}`;
  }

  // Ako je SQLite/ISO string oblika YYYY-MM-DD HH:mm(:ss) bez timezone oznake
  const sqliteMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (sqliteMatch) {
    const d = sqliteMatch[3].padStart(2, "0");
    const m = sqliteMatch[2].padStart(2, "0");
    const y = sqliteMatch[1];
    const hh = sqliteMatch[4].padStart(2, "0");
    const mm = sqliteMatch[5];
    const ss = sqliteMatch[6] || "00";
    return includeSeconds ? `${d}/${m}/${y} ${hh}:${mm}:${ss}` : `${d}/${m}/${y} ${hh}:${mm}`;
  }

  const parsed = new Date(raw.includes(" ") && !raw.includes("T") && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.replace(" ", "T") : raw);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, "0");
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const y = parsed.getFullYear();
    const hh = String(parsed.getHours()).padStart(2, "0");
    const mm = String(parsed.getMinutes()).padStart(2, "0");
    const ss = String(parsed.getSeconds()).padStart(2, "0");
    return includeSeconds ? `${d}/${m}/${y} ${hh}:${mm}:${ss}` : `${d}/${m}/${y} ${hh}:${mm}`;
  }

  return formatDateDMY(raw, fallback);
}

/**
 * Safely formats a date string in DD/MM/YYYY format across the application.
 */
export function formatDateLong(dateStr: string | null | undefined): string {
  if (!dateStr) return "Nepoznat datum";
  return formatDateDMY(dateStr, "Nepoznat datum");
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "Nepoznat datum";
  return formatDateDMY(dateStr, "Nepoznat datum");
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
export function isMandateActive(toYearOrDate?: any): boolean {
  try {
    if (toYearOrDate === undefined || toYearOrDate === null) return true;
    const val = String(toYearOrDate).trim();
    if (!val) return true;

    // Format: DD/MM/YYYY
    const slashParts = val.split("/");
    if (slashParts.length === 3) {
      const d = parseInt(slashParts[0], 10);
      const m = parseInt(slashParts[1], 10);
      const y = parseInt(slashParts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const mandateEnd = new Date(y, m - 1, d, 23, 59, 59);
        return mandateEnd.getTime() >= Date.now();
      }
    }

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
  } catch {
    return true;
  }
}

/**
 * Parsira godinu ili datum u timestamp za potrebe sortiranja.
 */
export function parseDateOrYearToTimestamp(val?: any): number {
  try {
    if (val === undefined || val === null) return 0;
    const s = String(val).trim();
    if (!s) return 0;

    // DD/MM/YYYY
    const slashParts = s.split("/");
    if (slashParts.length === 3) {
      const d = parseInt(slashParts[0], 10);
      const m = parseInt(slashParts[1], 10);
      const y = parseInt(slashParts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m - 1, d).getTime();
      }
    }

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
  } catch {
    return 0;
  }
}

/**
 * Formatira raspon mandata (od – do) u formatu DD/MM/YYYY ili godine YYYY.
 */
export function formatMandatePeriod(from?: any, to?: any): string {
  const fromRaw = from !== undefined && from !== null && String(from).trim() ? String(from).trim() : "";
  const toRaw = to !== undefined && to !== null && String(to).trim() ? String(to).trim() : "";
  const fromText = fromRaw ? formatDateDMY(fromRaw, "—") : "—";
  const toText = toRaw ? formatDateDMY(toRaw, "danas") : "danas";
  return `${fromText} – ${toText}`;
}

/**
 * Provjerava je li pojedina funkcija trenutno aktivna.
 */
export function isFunctionActive(f?: any): boolean {
  try {
    if (!f) return false;
    if (typeof f === 'string') return true;
    if (typeof f !== 'object') return false;

    // Ako je toYear eksplicitno postavljen
    if (f.toYear !== undefined && f.toYear !== null && String(f.toYear).trim() !== '') {
      return isMandateActive(f.toYear);
    }

    // Ako toYear nije postavljen, provjeri ima li naziv funkcije završnu godinu poput (2018-2024)
    if (f.functionName && typeof f.functionName === 'string') {
      const match = f.functionName.match(/\((\d{4})\s*[-–]\s*(\d{4})\)/);
      if (match) {
        const endYear = parseInt(match[2], 10);
        if (!isNaN(endYear)) {
          return endYear >= new Date().getFullYear();
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Vraća listu naziva svih trenutno aktivnih funkcija/dužnosti člana.
 */
export function getMemberActiveFunctions(member?: any): string[] {
  try {
    if (!member || !member.functions) return [];
    let fns = member.functions;
    if (typeof fns === 'string') {
      try {
        fns = JSON.parse(fns);
        if (typeof fns === 'string') fns = JSON.parse(fns);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(fns)) return [];

    return fns
      .filter(f => isFunctionActive(f))
      .map(f => {
        if (typeof f === 'string') return f.trim();
        return (f.functionName || '').trim();
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Vraća tekstualni prikaz uloge za člana:
 * Ako obnaša aktivnu dužnost, vraća nazive tih dužnosti.
 * Ako ne, vraća ulogu u sustavu ('Administrator', 'Moderator' ili 'Član').
 */
export function getMemberDisplayRole(member?: any): string {
  try {
    if (!member) return 'Član';
    const activeFns = getMemberActiveFunctions(member);
    if (activeFns.length > 0) {
      return activeFns.map(fn => fn.replace(/\s*\(\?-\?\)/g, '').trim()).join(', ');
    }
    if (member.role === 'admin') return 'Administrator';
    if (member.role === 'moderator') return 'Moderator';
    return 'Član';
  } catch {
    return 'Član';
  }
}

/**
 * Provjerava je li član dio Upravnog odbora / ima aktivnu funkciju.
 */
export function isBoardMember(member?: any): boolean {
  try {
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
    return fns.some(f => isFunctionActive(f));
  } catch {
    return false;
  }
}


