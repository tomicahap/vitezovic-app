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
 * Izvlači godinu i timestamp iz zadanog datuma/niza za usporedbu mandata.
 */
export function parseYearAndTimestamp(dateVal?: any): { year: number; timestamp: number } {
  if (!dateVal) {
    const now = new Date();
    return { year: now.getFullYear(), timestamp: now.getTime() };
  }
  if (dateVal instanceof Date) {
    return { year: dateVal.getFullYear(), timestamp: dateVal.getTime() };
  }
  if (typeof dateVal === 'number') {
    if (dateVal > 1900 && dateVal < 2200) {
      return { year: dateVal, timestamp: new Date(dateVal, 0, 1).getTime() };
    }
    const d = new Date(dateVal);
    return { year: d.getFullYear(), timestamp: dateVal };
  }
  const s = String(dateVal).trim();
  if (!s) {
    const now = new Date();
    return { year: now.getFullYear(), timestamp: now.getTime() };
  }
  const slashParts = s.split("/");
  if (slashParts.length === 3) {
    const d = parseInt(slashParts[0], 10);
    const m = parseInt(slashParts[1], 10);
    const y = parseInt(slashParts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return { year: y, timestamp: new Date(y, m - 1, d, 23, 59, 59).getTime() };
    }
  }
  const dotParts = s.replace(/\.+$/, "").split(".");
  if (dotParts.length === 3) {
    const d = parseInt(dotParts[0], 10);
    const m = parseInt(dotParts[1], 10);
    const y = parseInt(dotParts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return { year: y, timestamp: new Date(y, m - 1, d, 23, 59, 59).getTime() };
    }
  }
  const dashParts = s.split("-");
  if (dashParts.length === 3) {
    const y = parseInt(dashParts[0], 10);
    const m = parseInt(dashParts[1], 10);
    const d = parseInt(dashParts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return { year: y, timestamp: new Date(y, m - 1, d, 23, 59, 59).getTime() };
    }
  }
  const yearMatch = s.match(/\b(19\d\d|20\d\d)\b/);
  if (yearMatch) {
    const y = parseInt(yearMatch[1], 10);
    return { year: y, timestamp: new Date(y, 0, 1).getTime() };
  }
  const parsed = new Date(s).getTime();
  if (!isNaN(parsed)) {
    return { year: new Date(parsed).getFullYear(), timestamp: parsed };
  }
  const now = new Date();
  return { year: now.getFullYear(), timestamp: now.getTime() };
}

/**
 * Čisti formatirani naziv funkcije od oznaka mandata poput (?-?) ili (2025-?).
 */
export function cleanFunctionName(name: string): string {
  if (!name) return "";
  return String(name)
    .replace(/\s*\(\?-\?\)/g, "")
    .replace(/\s*\(\d{4}\s*[-–]\s*(\?|\d{4}|danas)?\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Provjerava je li funkcija/mandat člana još uvijek aktivan (na zadani datum ili danas).
 * Podržava godinu (npr. "2026"), hrvatski datum ("15.10.2026", "15.10.2026."),
 * ili ISO datum ("2026-10-15").
 * Ako je vrijednost prazna, mandat se smatra aktivnim (u tijeku).
 */
export function isMandateActive(toYearOrDate?: any, atDate?: any): boolean {
  try {
    if (toYearOrDate === undefined || toYearOrDate === null) return true;
    const val = String(toYearOrDate).trim();
    if (!val || val === "?" || val === "—") return true;

    const target = parseYearAndTimestamp(atDate);

    // Format: DD/MM/YYYY
    const slashParts = val.split("/");
    if (slashParts.length === 3) {
      const d = parseInt(slashParts[0], 10);
      const m = parseInt(slashParts[1], 10);
      const y = parseInt(slashParts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const mandateEnd = new Date(y, m - 1, d, 23, 59, 59).getTime();
        return mandateEnd >= target.timestamp;
      }
    }

    // Hrvatski format: DD.MM.YYYY ili DD.MM.YYYY.
    const dotParts = val.replace(/\.+$/, "").split(".");
    if (dotParts.length === 3) {
      const d = parseInt(dotParts[0], 10);
      const m = parseInt(dotParts[1], 10);
      const y = parseInt(dotParts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const mandateEnd = new Date(y, m - 1, d, 23, 59, 59).getTime();
        return mandateEnd >= target.timestamp;
      }
    }

    // ISO format: YYYY-MM-DD
    const dashParts = val.split("-");
    if (dashParts.length === 3) {
      const y = parseInt(dashParts[0], 10);
      const m = parseInt(dashParts[1], 10);
      const d = parseInt(dashParts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const mandateEnd = new Date(y, m - 1, d, 23, 59, 59).getTime();
        return mandateEnd >= target.timestamp;
      }
    }

    // 4-znamenkasta godina unutar teksta
    const yearMatch = val.match(/\b(19\d\d|20\d\d)\b/);
    if (yearMatch) {
      const y = parseInt(yearMatch[1], 10);
      return y >= target.year;
    }

    // Fallback
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 1900) {
      return parsed >= target.year;
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
 * Provjerava je li pojedina funkcija aktivna (na zadani datum ili danas).
 */
export function isFunctionActive(f?: any, atDate?: any): boolean {
  try {
    if (!f) return false;
    const target = parseYearAndTimestamp(atDate);

    if (typeof f === 'string') {
      const match = f.match(/\((\d{4})\s*[-–]\s*(\d{4}|\?|danas)?\)/i);
      if (match) {
        const startYear = parseInt(match[1], 10);
        const endPart = match[2];
        if (!isNaN(startYear) && target.year < startYear) return false;
        if (endPart && endPart !== "?" && endPart.toLowerCase() !== "danas") {
          const endYear = parseInt(endPart, 10);
          if (!isNaN(endYear) && target.year > endYear) return false;
        }
      }
      return true;
    }

    if (typeof f !== 'object') return false;

    // Ako je toYear postavljen, provjeri završetak mandata
    if (f.toYear !== undefined && f.toYear !== null && String(f.toYear).trim() !== '') {
      if (!isMandateActive(f.toYear, atDate)) return false;
    }

    // Ako je fromYear postavljen, provjeri početak mandata
    if (f.fromYear !== undefined && f.fromYear !== null && String(f.fromYear).trim() !== '') {
      const fromTarget = parseYearAndTimestamp(f.fromYear);
      if (target.year < fromTarget.year) return false;
    }

    // Provjeri ima li naziv funkcije raspon godina npr. (2018-2024) ili (2025-?)
    const fName = f.functionName || f.name || f.naziv;
    if (fName && typeof fName === 'string') {
      const match = fName.match(/\((\d{4})\s*[-–]\s*(\d{4}|\?|danas)?\)/i);
      if (match) {
        const startYear = parseInt(match[1], 10);
        const endPart = match[2];
        if (!isNaN(startYear) && target.year < startYear) return false;
        if (endPart && endPart !== "?" && endPart.toLowerCase() !== "danas") {
          const endYear = parseInt(endPart, 10);
          if (!isNaN(endYear) && target.year > endYear) return false;
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Vraća listu naziva svih aktivnih funkcija/dužnosti člana na zadani datum (ili danas).
 */
export function getMemberActiveFunctions(member?: any, atDate?: any): string[] {
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
      .filter(f => isFunctionActive(f, atDate))
      .map(f => {
        if (typeof f === 'string') return cleanFunctionName(f);
        const raw = f.functionName || f.name || f.naziv || '';
        return cleanFunctionName(String(raw));
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Vraća tekstualni prikaz uloge za člana na zadani datum (ili danas):
 * Uključuje sve aktivne dužnosti, oznaku počasnog člana (ako je ima) te ulogu u sustavu.
 */
export function getMemberDisplayRole(member?: any, atDate?: any): string {
  try {
    if (!member) return 'Član';
    const roles: string[] = [...getMemberActiveFunctions(member, atDate)];
    const isHonorary =
      member.membershipStatus === 'honorary' ||
      member.status_clana === 'honorary' ||
      member.honorary === true ||
      member.honorary === 1;

    if (isHonorary && !roles.some(r => r.toLowerCase() === 'počasni član')) {
      roles.push('Počasni član');
    }

    if (member.role === 'admin') {
      roles.push('Administrator');
    } else if (member.role === 'moderator') {
      roles.push('Moderator');
    }

    if (roles.length > 0) {
      return roles.join(', ');
    }
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

function escapeSignoffHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizePersonName(value?: string | null): string {
  return String(value || '')
    .replace(/\(\s*(?:administrator|admin|rezervni\s+administrator)\s*\)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function isGenericSystemRoleLabel(value?: string | null): boolean {
  const norm = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return (
    norm === '' ||
    norm === 'administrator' ||
    norm === 'rezervni administrator' ||
    norm === 'admin' ||
    norm === 'moderator' ||
    norm === 'moderator (tijelo društva)' ||
    norm === 'moderator (tijelo drustva)' ||
    norm === 'član društva' ||
    norm === 'clan drustva' ||
    norm === 'član' ||
    norm === 'clan' ||
    norm === 'član tijela društva' ||
    norm === 'clan tijela drustva'
  );
}

function isGenericPersonName(value?: string | null): boolean {
  const norm = normalizePersonName(value);
  return norm === '' || norm === 'administrator' || norm === 'rezervni administrator' || norm === 'admin';
}

function areNormalizedNamesTokenEquivalent(aNorm: string, bNorm: string): boolean {
  if (!aNorm || !bNorm) return false;
  if (aNorm === bNorm) return true;
  const aTokens = aNorm.split(' ').filter(Boolean).sort();
  const bTokens = bNorm.split(' ').filter(Boolean).sort();
  if (aTokens.length < 2 || aTokens.length !== bTokens.length) return false;
  return aTokens.every((t, i) => t === bTokens[i]);
}

/**
 * Pronalazi zapis člana Društva za prijavljenog korisnika (uključujući i Administratora
 * povezanog po ID-u, e-mailu ili imenu i prezimenu, uključujući i settings.adminName).
 */
export function matchMemberForUser(
  user: any,
  members?: any[],
  fallbackAdminName?: string | null
): any | undefined {
  const list = Array.isArray(members) ? members : [];
  if (list.length === 0) return undefined;

  const uid = Number(user?.id);
  if (Number.isFinite(uid) && uid > 0 && uid !== 2579) {
    const byId = list.find((m) => Number(m?.id) === uid);
    if (byId) return byId;
  }

  const emailLower = String(user?.email || user?.userEmail || '').trim().toLowerCase();
  if (emailLower && emailLower !== 'admin') {
    const byEmail = list.find((m) => String(m?.email || '').trim().toLowerCase() === emailLower);
    if (byEmail) return byEmail;
  }

  const nameCandidates = [user?.name, user?.userName, fallbackAdminName]
    .map((n) => normalizePersonName(n))
    .filter((n) => Boolean(n) && !isGenericPersonName(n));

  for (const candidate of nameCandidates) {
    const exactMatch = list.find((m) => normalizePersonName(m?.name) === candidate);
    if (exactMatch) return exactMatch;

    const tokenMatch = list.find((m) =>
      areNormalizedNamesTokenEquivalent(normalizePersonName(m?.name), candidate)
    );
    if (tokenMatch) return tokenMatch;
  }

  return undefined;
}

/**
 * Određuje prikaznu funkciju/ulogu prijavljenog korisnika u Društvu:
 * aktivna funkcija u Društvu UVIJEK ima prednost ispred uloge „Administrator”.
 */
export function resolveUserSocietyRoleLabel(
  user: any,
  members?: any[],
  fallbackAdminName?: string | null
): string {
  if (!user) return 'Član Društva';
  const role = String(user.role || user.userRole || '').trim().toLowerCase();
  if (role === 'external') {
    const org = String(user.organization || '').trim();
    return org ? `Vanjski suradnik (${org})` : 'Vanjski suradnik';
  }

  const matchedMember = matchMemberForUser(user, members, fallbackAdminName);

  if (matchedMember) {
    const activeFns = getMemberActiveFunctions(matchedMember);
    if (activeFns.length > 0) {
      return activeFns.join(', ');
    }
  }

  const presetSocietyRole = String(user.societyRole || user.userFunction || '').trim();
  if (presetSocietyRole && !isGenericSystemRoleLabel(presetSocietyRole)) {
    return presetSocietyRole;
  }

  if (matchedMember) {
    const isHonorary =
      matchedMember.membershipStatus === 'honorary' ||
      matchedMember.status_clana === 'honorary' ||
      matchedMember.honorary === true ||
      matchedMember.honorary === 1;
    if (isHonorary) {
      return 'Počasni član';
    }
  }

  if (role === 'admin') return 'Administrator';
  if (role === 'moderator') return 'Moderator';
  return 'Član Društva';
}

/**
 * Gradi osobni potpis pošiljatelja e-pošte s punim imenom i prezimenom te funkcijom u Društvu.
 */
export function resolveSenderSignoff(
  user: any,
  members?: any[],
  fallbackAdminName?: string | null
): { fullName: string; roleLabel: string; html: string; plainText: string } {
  const matchedMember = matchMemberForUser(user, members, fallbackAdminName);
  const rawUserName = String(user?.name || user?.userName || '').trim();
  const cleanAdminName = String(fallbackAdminName || '').trim();
  const fullName =
    rawUserName && !isGenericPersonName(rawUserName)
      ? rawUserName
      : cleanAdminName && !isGenericPersonName(cleanAdminName)
      ? cleanAdminName
      : String(matchedMember?.name || rawUserName || '').replace(/\s+/g, ' ').trim();

  const roleLabel = resolveUserSocietyRoleLabel(user, members, fallbackAdminName);

  if (!fullName) {
    return { fullName: '', roleLabel, html: '', plainText: '' };
  }

  const html = `<div data-hrd-sender-signoff="true" style="margin-bottom:8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#1F2937;"><strong style="color:#1E3A5F;">${escapeSignoffHtml(fullName)}</strong><br/><span style="color:#475569;font-size:12px;">${escapeSignoffHtml(roleLabel)}</span></div>`;
  const plainText = `${fullName}\n${roleLabel}`;

  return { fullName, roleLabel, html, plainText };
}

/**
 * Gradi standardizirani objekt pošiljatelja na klijentu za sve e-mail modale i API pozive.
 */
export function buildClientSenderIdentity(
  user: any,
  members?: any[],
  settings?: any
):
  | {
      userId: string | number;
      userName: string;
      userEmail?: string;
      userRole?: string;
      userFunction: string;
    }
  | undefined {
  if (!user) return undefined;
  const fallbackAdminName = settings?.adminName ? String(settings.adminName).trim() : '';
  const signoff = resolveSenderSignoff(user, members, fallbackAdminName);
  const resolvedName =
    signoff.fullName ||
    fallbackAdminName ||
    String(user.name || '').trim() ||
    'Administrator';
  return {
    userId: user.id ?? 'admin',
    userName: resolvedName,
    userEmail: user.email || '',
    userRole: user.role || 'member',
    userFunction: signoff.roleLabel,
  };
}


