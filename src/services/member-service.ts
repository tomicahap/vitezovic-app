import { MemberRepository } from '../repositories/member-repository';

export function isAdminRecord(m: any): boolean {
  if (!m) return false;
  const role = String(m.role || '').trim().toLowerCase();
  const email = String(m.email || '').trim().toLowerCase();
  const name = String(m.name || '').trim().toLowerCase();
  return (
    role === 'admin' ||
    email === 'admin' ||
    name === 'administrator' ||
    name === 'rezervni administrator'
  );
}

export class MemberService {
  private repo: MemberRepository;

  constructor() {
    this.repo = new MemberRepository();
  }

  private safeParse(value: any, fallback: any = []): any {
    if (!value) return fallback;
    if (typeof value !== 'string') return value;

    try {
      const parsed = JSON.parse(value);
      // Handle double-encoded strings recursively
      if (typeof parsed === 'string') {
        return this.safeParse(parsed, fallback);
      }
      return parsed || fallback;
    } catch (e) {
      console.warn('Failed to parse JSON field:', value);
      return fallback;
    }
  }

  private parseMember(m: any) {
    if (!m) return m;
    const name = m.name || '';
    const initials = name
      .split(/\s+/)
      .map((n: string) => n[0])
      .filter(Boolean)
      .join('')
      .toUpperCase();

    return {
      ...m,
      initials,
      functions: this.safeParse(m.functions, []),
      personal_todos: this.safeParse(m.personalTodos || m.personal_todos, []),
      researchAreas: this.safeParse(m.researchAreas || m.research_areas, []),
      accessRights: this.safeParse(
        m.accessRights && m.accessRights !== '{}' && m.accessRights !== 'null'
          ? m.accessRights
          : (m.access_rights || m.accessRights),
        null
      ),
      payments: this.safeParse(m.payments, []),
      allPayments: this.safeParse(m.allPayments || m.all_payments, []),
      // Booleans
      honorary: m.honorary === 1 || m.honorary === true,
      exemptFromPayment: m.exemptFromPayment === 1 || m.exemptFromPayment === true,
      expelled: m.expelled === 1 || m.expelled === true,
      deceased: m.deceased === 1 || m.deceased === true,
      invitationSent: m.invitationSent === 1 || m.invitationSent === true,
      invitationSentAt: m.invitationSentAt || m.invitation_sent_at || null,
      isTempPassword:
        (m.is_temp_password ?? m.isTempPassword) === 1 ||
        (m.is_temp_password ?? m.isTempPassword) === true,
      // Map schema keys to frontend keys
      personal_notes: m.personalNotes || m.personal_notes || '',
      status_clana: m.statusClana || m.status_clana,
      datum_zadnje_uplate: m.datumZadnjeUplate || m.datum_zadnje_uplate,
      lastPaymentReminderAt: m.lastPaymentReminderAt || m.last_payment_reminder_at,
    };
  }

  private serializeMember(m: any, isUpdate = false) {
    if (!m) return m;

    const computedInitials =
      m.initials !== undefined
        ? m.initials
        : m.name
        ? m.name
            .split(/\s+/)
            .map((n: string) => n[0])
            .filter(Boolean)
            .join('')
            .toUpperCase()
        : isUpdate
        ? undefined
        : '';

    // Map frontend/legacy keys to schema keys
    const payload: any = {
      name: m.name,
      email: m.email,
      initials: computedInitials,
      phone: m.phone,
      birthDate: m.birthDate,
      address: m.address,
      membershipNumber: m.membershipNumber,
      registryNumber: m.registryNumber,
      status: isUpdate ? m.status : (m.status || 'active'),
      paymentStatus: isUpdate ? m.paymentStatus : (m.paymentStatus || 'paid'),
      joinDate: isUpdate ? m.joinDate : (m.joinDate || new Date().toISOString().split('T')[0]),
      researchAreas: m.researchAreas ?? m.research_areas,
      research_areas: m.researchAreas ?? m.research_areas,
      additionalAreas: isUpdate ? m.additionalAreas : (m.additionalAreas ?? 0),
      functions: m.functions,
      note: m.note,
      avatar: isUpdate ? m.avatar : (m.avatar || '/placeholder.svg'),
      invitationSent: m.invitationSent,
      invitation_sent_at: m.invitationSentAt ?? m.invitation_sent_at,
      role: isUpdate ? m.role : (m.role || 'member'),
      password: m.password,
      personalNotes: m.personalNotes ?? m.personal_notes,
      personalTodos: m.personalTodos ?? m.personal_todos,
      statusClana: m.statusClana ?? m.status_clana,
      datumZadnjeUplate: m.datumZadnjeUplate ?? m.datum_zadnje_uplate,
      honorary: m.honorary,
      exemptFromPayment: m.exemptFromPayment,
      expelled: m.expelled,
      expulsionDate: m.expulsionDate,
      expulsionReason: m.expulsionReason,
      deceased: m.deceased,
      deathDate: m.deathDate,
      lastPayment: m.lastPayment,
      expiry: m.expiry,
      payments: m.payments,
      allPayments: m.allPayments ?? m.all_payments,
      notes: m.notes,
      accessRights: m.accessRights ?? m.access_rights,
      access_rights: m.accessRights ?? m.access_rights,
      is_temp_password: m.isTempPassword ?? m.is_temp_password,
      last_payment_reminder_at: m.lastPaymentReminderAt ?? m.last_payment_reminder_at,
    };

    // Ensure we only stringify if it's not already a string
    const jsonFields = [
      'functions',
      'personalTodos',
      'personal_todos',
      'researchAreas',
      'research_areas',
      'accessRights',
      'access_rights',
      'payments',
      'allPayments',
    ];
    jsonFields.forEach((field) => {
      if (payload[field] !== undefined && payload[field] !== null && typeof payload[field] !== 'string') {
        payload[field] = JSON.stringify(payload[field]);
      }
    });

    // Booleans to integers for SQLite
    const booleanFields = [
      'honorary',
      'exemptFromPayment',
      'expelled',
      'deceased',
      'invitationSent',
      'is_temp_password',
    ];
    booleanFields.forEach((field) => {
      if (payload[field] !== undefined && payload[field] !== null) {
        payload[field] = payload[field] ? 1 : 0;
      }
    });

    // Remove undefined fields to let defaults work or avoid overwriting on partial update
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    return payload;
  }

  async getAllMembers() {
    const rows = await this.repo.findAll();
    const validRows: any[] = [];
    for (const r of rows) {
      if (isAdminRecord(r)) {
        // Automatski obriši ako se u bazi zatekao zapis administratora
        try {
          await this.repo.delete(r.id);
        } catch {}
        continue;
      }
      validRows.push(this.parseMember(r));
    }
    return validRows;
  }

  async getMember(id: number) {
    const row = await this.repo.findById(id);
    if (!row || isAdminRecord(row)) return null;
    return this.parseMember(row);
  }

  async createMember(data: any) {
    // Administrator se nikada ne smije upisati kao član
    if (isAdminRecord(data)) {
      return 0;
    }
    if (data.email) {
      const existing = await this.repo.findByEmail(data.email);
      if (existing) return existing.id;
    }
    const serialized = this.serializeMember(data, false);
    try {
      return await this.repo.insert(serialized);
    } catch (error) {
      console.error('Error in MemberService.createMember:', error);
      throw error;
    }
  }

  async updateMember(id: number, data: any) {
    if (isAdminRecord(data)) {
      return null;
    }
    const serialized = this.serializeMember(data, true);
    if (Object.keys(serialized).length === 0) return null;
    return await this.repo.update(id, serialized);
  }

  async deleteMember(id: number) {
    return await this.repo.delete(id);
  }
}
