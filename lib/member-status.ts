export interface MemberPayment {
  id: string
  date: string
  amount: number
  note?: string
  forYear?: number
}

export interface Member {
  id: number
  name: string
  joinDate: string
  payments: MemberPayment[]
  deceased?: boolean
  expelled?: boolean
  honorary?: boolean
  exemptFromPayment?: boolean
  status: 'active' | 'expired' | 'pending'
  paymentStatus: 'paid' | 'overdue' | 'pending'
  status_clana?: 'AKTIVAN' | 'DUG' | 'ISPISAN'
  datum_zadnje_uplate?: string | null
}

export interface StatusSettings {
  overdueAfterDays: number
  expiredAfterDays: number
  requirePaymentToBeActive?: boolean
}

function parseDateStr(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  
  // Handle DD.MM.YYYY. or D.M.YYYY. or DD/MM/YYYY
  if (/^\d{1,2}[./]\s?\d{1,2}[./]\s?\d{4}\.?$/.test(trimmed)) {
    const parts = trimmed.split(/[./]/).map(p => p.trim()).filter(Boolean);
    if (parts.length === 3) {
      // Ensure DD and MM are 2 digits
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      return new Date(`${y}-${m}-${d}T12:00:00`);
    }
  }
  
  // Try default parse (YYYY-MM-DD or standard)
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  return d;
}

function getEffectivePaymentDate(payment: MemberPayment): Date | null {
  if (payment.forYear !== undefined && payment.forYear !== null && String(payment.forYear).trim() !== '') {
    const yr = Number(payment.forYear);
    if (Number.isInteger(yr) && yr >= 1900 && yr <= 2100) {
      return new Date(`${yr}-01-01T12:00:00`);
    }
  }
  return parseDateStr(payment.date);
}

export function computeMemberStates(
  member: Partial<Member> & { datum_zadnje_uplate?: string | null, payments?: MemberPayment[] },
  settings: StatusSettings
): { status: Member['status']; paymentStatus: Member['paymentStatus']; status_clana: 'AKTIVAN' | 'DUG' | 'ISPISAN'; datum_zadnje_uplate: string | null } {
  let lastPaymentDate: Date | null = null;
  let effectivePaymentDate: Date | null = null;
  let maxExplicitForYear: number | null = null;
  
  if (member.payments && member.payments.length > 0) {
    const sorted = [...member.payments].sort((a,b) => {
      const dA = parseDateStr(a.date)?.getTime() || 0;
      const dB = parseDateStr(b.date)?.getTime() || 0;
      return dB - dA;
    });
    lastPaymentDate = parseDateStr(sorted[0].date);

    // Za izračun statusa uzimamo najnoviji datum pokrića (ako uplata ima definiranu godinu 'forYear', vrijedi od 01.01. te godine; postojeće uplate bez 'forYear' računaju se po datumu uplate)
    for (const p of member.payments) {
      const yr = p.forYear !== undefined && p.forYear !== null && String(p.forYear).trim() !== '' ? Number(p.forYear) : NaN;
      if (Number.isInteger(yr) && yr >= 1900 && yr <= 2100) {
        if (maxExplicitForYear === null || yr > maxExplicitForYear) {
          maxExplicitForYear = yr;
        }
      }
      const eff = getEffectivePaymentDate(p);
      if (eff && (!effectivePaymentDate || eff.getTime() > effectivePaymentDate.getTime())) {
        effectivePaymentDate = eff;
      }
    }
  } else if (member.datum_zadnje_uplate) {
    lastPaymentDate = parseDateStr(member.datum_zadnje_uplate);
    effectivePaymentDate = lastPaymentDate;
  }
  
  const datum_zadnje_uplate = lastPaymentDate ? lastPaymentDate.toISOString().split('T')[0] : null;

  let isExpelled = member.expelled || member.deceased;

  let membershipStatus: 'active' | 'expired' = 'active';
  let finStatus: 'paid' | 'overdue' | 'pending' = 'paid';

  if (isExpelled) {
    membershipStatus = 'expired';
    finStatus = 'pending'; // Više se financijski ne kontrolira
  } else if (member.honorary || member.exemptFromPayment) {
    membershipStatus = 'active';
    finStatus = 'paid';
  } else if (settings.requirePaymentToBeActive && !lastPaymentDate) {
    // Ako je uključeno pravilo da član bez ijedne uplate ne može biti aktivan (osim počasnih i oslobođenih)
    membershipStatus = 'expired';
    finStatus = 'overdue';
  } else if (!member.joinDate && !lastPaymentDate) {
    // Dok nema ni datuma upisa ni uplata (npr. prilikom čišćenja baze), član ostaje aktivan bez duga
    membershipStatus = 'active';
    finStatus = 'pending';
  } else if (maxExplicitForYear !== null && new Date().getFullYear() <= maxExplicitForYear) {
    // Članarina je unaprijed ili pravodobno podmirena za tekuću ili buduću kalendarsku godinu
    membershipStatus = 'active';
    finStatus = 'paid';
  } else {
    let refDate: Date;
    if (!member.joinDate) {
      const baseDate = effectivePaymentDate || lastPaymentDate!;
      refDate = new Date(`${baseDate.getFullYear()}-01-01T00:00:00`);
    } else if (effectivePaymentDate || lastPaymentDate) {
      refDate = (effectivePaymentDate || lastPaymentDate)!;
    } else {
      refDate = parseDateStr(member.joinDate) || new Date();
    }

    const now = new Date();
    const diffDays = Math.floor((now.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));

    const period_aktivnosti = settings.overdueAfterDays || 365;
    const total_ispis_days = settings.expiredAfterDays || 730;

    if (diffDays <= period_aktivnosti) {
      membershipStatus = 'active';
      finStatus = 'paid';
    } else if (diffDays <= total_ispis_days) {
      membershipStatus = 'active'; // Članstvo je i dalje AKTIVAN
      finStatus = 'overdue';     // Financijski je DUG
    } else {
      membershipStatus = 'expired'; // Članstvo je ISPISAN
      finStatus = 'overdue';      // Financijski je DUG
    }
  }

  // Generate legacy outputs for backwards compat, mapping them to the old constants
  const status_clana = membershipStatus === 'active' ? (finStatus === 'paid' ? 'AKTIVAN' : 'DUG') : 'ISPISAN';

  return { 
    status: membershipStatus, 
    paymentStatus: finStatus, 
    status_clana: status_clana, // keep just for any residual logic temporarily
    datum_zadnje_uplate 
  };
}
