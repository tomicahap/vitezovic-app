export interface MemberPayment {
  id: string
  date: string
  amount: number
  note?: string
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
}

function parseDateStr(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  
  // Handle DD.MM.YYYY. or D.M.YYYY. (common in hr-HR)
  if (/^\d{1,2}\.\s?\d{1,2}\.\s?\d{4}\.?$/.test(trimmed)) {
    const parts = trimmed.split('.').map(p => p.trim()).filter(Boolean);
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

export function computeMemberStates(
  member: Partial<Member> & { datum_zadnje_uplate?: string | null, payments?: MemberPayment[] },
  settings: StatusSettings
): { status: Member['status']; paymentStatus: Member['paymentStatus']; status_clana: 'AKTIVAN' | 'DUG' | 'ISPISAN'; datum_zadnje_uplate: string | null } {
  let lastPaymentDate: Date | null = null;
  
  if (member.payments && member.payments.length > 0) {
    const sorted = [...member.payments].sort((a,b) => {
      const dA = parseDateStr(a.date)?.getTime() || 0;
      const dB = parseDateStr(b.date)?.getTime() || 0;
      return dB - dA;
    });
    lastPaymentDate = parseDateStr(sorted[0].date);
  } else if (member.datum_zadnje_uplate) {
    lastPaymentDate = parseDateStr(member.datum_zadnje_uplate);
  }
  
  const datum_zadnje_uplate = lastPaymentDate ? lastPaymentDate.toISOString().split('T')[0] : null;

  let refDate: Date;
  if (!member.joinDate) {
    if (lastPaymentDate) {
      refDate = new Date(`${lastPaymentDate.getFullYear()}-01-01T00:00:00`);
    } else {
      refDate = new Date(0); // extremely old
    }
  } else {
    if (lastPaymentDate) {
      refDate = lastPaymentDate;
    } else {
      refDate = parseDateStr(member.joinDate) || new Date(0);
    }
  }

  const now = new Date();
  const diffDays = Math.floor((now.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));

  const period_aktivnosti = settings.overdueAfterDays || 365;
  const total_ispis_days = settings.expiredAfterDays || 730;

  // Status članstva se može staviti ISPISAN ručno!
  let isExpelled = member.expelled || member.deceased;

  let membershipStatus: 'active' | 'expired' = 'active';
  let finStatus: 'paid' | 'overdue' | 'pending' = 'paid';

  if (isExpelled) {
    membershipStatus = 'expired';
    finStatus = 'pending'; // Više se financijski ne kontrolira
  } else if (member.honorary || member.exemptFromPayment) {
    membershipStatus = 'active';
    finStatus = 'paid';
  } else {
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
