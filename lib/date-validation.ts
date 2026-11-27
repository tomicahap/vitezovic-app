export type DateInspectionStatus = 'empty' | 'valid_iso' | 'convertible' | 'invalid';

export interface DateInspectionResult {
  status: DateInspectionStatus;
  raw: string;
  isoDate?: string;
  reason?: string;
}

export interface MemberDateIssue {
  field: 'joinDate' | 'birthDate' | 'expulsionDate' | 'deathDate' | 'payment';
  label: string;
  raw: string;
  status: 'convertible' | 'invalid';
  reason: string;
  isoDate?: string;
  paymentId?: string;
}

/**
 * Provjerava je li trojka (godina, mjesec, dan) valjan kalendarski datum.
 */
export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1800 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;

  const daysInMonth = new Date(year, month, 0).getDate();
  return day <= daysInMonth;
}

function toIso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Analizira vrijednost datuma iz baze i vraća status valjanosti formata.
 */
export function inspectMemberDate(value: unknown): DateInspectionResult {
  if (value === undefined || value === null) {
    return { status: 'empty', raw: '' };
  }
  const raw = String(value).trim();
  if (!raw || raw === '-' || raw === '—') {
    return { status: 'empty', raw };
  }

  // 1. Strogi ISO YYYY-MM-DD
  const strictIso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (strictIso) {
    const y = Number(strictIso[1]);
    const m = Number(strictIso[2]);
    const d = Number(strictIso[3]);
    if (isValidCalendarDate(y, m, d)) {
      return { status: 'valid_iso', raw, isoDate: raw };
    }
    return { status: 'invalid', raw, reason: 'Nepostojeći kalendarski datum' };
  }

  // 2. ISO s vremenom (YYYY-MM-DDTHH:mm...) ili YYYY-M-D
  const looseIso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (looseIso) {
    const y = Number(looseIso[1]);
    const m = Number(looseIso[2]);
    const d = Number(looseIso[3]);
    if (isValidCalendarDate(y, m, d)) {
      return {
        status: 'convertible',
        raw,
        isoDate: toIso(y, m, d),
        reason: 'Nestandardni ISO zapis (s vremenom ili bez vodećih nula)',
      };
    }
    return { status: 'invalid', raw, reason: 'Nepostojeći ISO datum' };
  }

  // 3. Hrvatski / europski format s točkama: DD.MM.YYYY. ili D.M.YYYY
  const dotMatch = raw.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?$/);
  if (dotMatch) {
    const d = Number(dotMatch[1]);
    const m = Number(dotMatch[2]);
    const y = Number(dotMatch[3]);
    if (isValidCalendarDate(y, m, d)) {
      return {
        status: 'convertible',
        raw,
        isoDate: toIso(y, m, d),
        reason: 'Zapis s točkama (nije standardni YYYY-MM-DD)',
      };
    }
    return { status: 'invalid', raw, reason: 'Neispravan datum (npr. zamijenjen dan/mjesec)' };
  }

  // 3b. Stari uvezeni zapis datuma uplate s priloženim iznosom (npr. "16. 09. 2025.: 10€")
  const dotWithAmountMatch = raw.match(
    /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?\s*:\s*\d+(?:[.,]\d+)?\s*(?:€|eur|kn|hrk)?$/i
  );
  if (dotWithAmountMatch) {
    const d = Number(dotWithAmountMatch[1]);
    const m = Number(dotWithAmountMatch[2]);
    const y = Number(dotWithAmountMatch[3]);
    if (isValidCalendarDate(y, m, d)) {
      return {
        status: 'convertible',
        raw,
        isoDate: toIso(y, m, d),
        reason: 'Zapis datuma s priloženim iznosom (nije standardni YYYY-MM-DD)',
      };
    }
    return { status: 'invalid', raw, reason: 'Neispravan datum (npr. zamijenjen dan/mjesec)' };
  }

  // 4. Format s kosim crtama: DD/MM/YYYY ili D/M/YYYY
  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const d = Number(slashMatch[1]);
    const m = Number(slashMatch[2]);
    const y = Number(slashMatch[3]);
    if (isValidCalendarDate(y, m, d)) {
      return {
        status: 'convertible',
        raw,
        isoDate: toIso(y, m, d),
        reason: 'Zapis s kosim crtama (nije standardni YYYY-MM-DD)',
      };
    }
    return { status: 'invalid', raw, reason: 'Neispravan datum (mogući MM/DD/YYYY format)' };
  }

  // 5. Samo godina ili tekstualni/nepoznati format
  if (/^\d{4}$/.test(raw)) {
    return { status: 'invalid', raw, reason: 'Samo godina bez dana i mjeseca' };
  }

  return { status: 'invalid', raw, reason: 'Neprepoznatljiv format datuma' };
}

/**
 * Vraća sve probleme s formatom datuma na pojedinom članu.
 */
export function getMemberDateIssues(member: {
  joinDate?: string | null;
  birthDate?: string | null;
  expulsionDate?: string | null;
  deathDate?: string | null;
  payments?: Array<{ id?: string; date?: string }>;
}): MemberDateIssue[] {
  const issues: MemberDateIssue[] = [];

  const fields: Array<{ key: 'joinDate' | 'birthDate' | 'expulsionDate' | 'deathDate'; label: string; val?: string | null }> = [
    { key: 'joinDate', label: 'Datum upisa', val: member.joinDate },
    { key: 'birthDate', label: 'Datum rođenja', val: member.birthDate },
    { key: 'expulsionDate', label: 'Datum ispisa', val: member.expulsionDate },
    { key: 'deathDate', label: 'Datum smrti', val: member.deathDate },
  ];

  for (const f of fields) {
    const res = inspectMemberDate(f.val);
    if (res.status === 'invalid' || res.status === 'convertible') {
      issues.push({
        field: f.key,
        label: f.label,
        raw: res.raw,
        status: res.status,
        reason: res.reason || 'Neispravan format',
        isoDate: res.isoDate,
      });
    }
  }

  for (const p of member.payments || []) {
    const res = inspectMemberDate(p.date);
    if (res.status === 'invalid' || res.status === 'convertible') {
      issues.push({
        field: 'payment',
        label: 'Datum uplate',
        raw: res.raw,
        status: res.status,
        reason: res.reason || 'Neispravan format',
        isoDate: res.isoDate,
        paymentId: p.id,
      });
    }
  }

  return issues;
}

/**
 * Pretvara bilo koji prepoznatljiv datum člana u strogi ISO format YYYY-MM-DD,
 * a prazne/placeholder vrijednosti ("-", "—") u prazan string "".
 */
export function normalizeMemberDateToIso(value: unknown): string {
  if (value === undefined || value === null) return '';
  const inspected = inspectMemberDate(value);
  if (inspected.status === 'empty') return '';
  if (inspected.isoDate) return inspected.isoDate;
  return String(value).trim();
}
