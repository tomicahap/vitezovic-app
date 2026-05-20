import { MemberRepository } from '../repositories/member-repository';

export class MemberService {
  private repo: MemberRepository;

  constructor() {
    this.repo = new MemberRepository();
  }

  private safeParse(value: any, fallback: any = []) {
    if (!value) return fallback;
    if (typeof value !== 'string') return value;
    
    try {
      let parsed = JSON.parse(value);
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
    const initials = name.split(/\s+/).map((n: string) => n[0]).filter(Boolean).join('').toUpperCase();
    
    return {
      ...m,
      initials,
      functions: this.safeParse(m.functions, []),
      personal_todos: this.safeParse(m.personalTodos || m.personal_todos, []),
      researchAreas: this.safeParse(m.researchAreas || m.research_areas, []),
      accessRights: this.safeParse(m.accessRights, null),
      payments: this.safeParse(m.payments, []),
      allPayments: this.safeParse(m.allPayments || m.all_payments, []),
      // Booleans
      honorary: m.honorary === 1 || m.honorary === true,
      exemptFromPayment: m.exemptFromPayment === 1 || m.exemptFromPayment === true,
      expelled: m.expelled === 1 || m.expelled === true,
      deceased: m.deceased === 1 || m.deceased === true,
      invitationSent: m.invitationSent === 1 || m.invitationSent === true,
      isTempPassword: (m.is_temp_password ?? m.isTempPassword) === 1 || (m.is_temp_password ?? m.isTempPassword) === true,
      // Map schema keys to frontend keys
      personal_notes: m.personalNotes || m.personal_notes || '',
      status_clana: m.statusClana || m.status_clana,
      datum_zadnje_uplate: m.datumZadnjeUplate || m.datum_zadnje_uplate,
      lastPaymentReminderAt: m.lastPaymentReminderAt || m.last_payment_reminder_at,
    };
  }

  private serializeMember(m: any) {
    if (!m) return m;
    
    // Map frontend/legacy keys to schema keys
    const payload: any = {
      name: m.name,
      email: m.email,
      initials: m.initials || (m.name ? m.name.split(/\s+/).map((n: string) => n[0]).filter(Boolean).join('').toUpperCase() : ''),
      phone: m.phone,
      birthDate: m.birthDate,
      address: m.address,
      membershipNumber: m.membershipNumber,
      registryNumber: m.registryNumber,
      status: m.status || 'active',
      paymentStatus: m.paymentStatus || 'paid',
      joinDate: m.joinDate || new Date().toISOString().split('T')[0],
      researchAreas: m.researchAreas || m.research_areas,
      research_areas: m.researchAreas || m.research_areas, // For safety if schema uses snake_case
      additionalAreas: m.additionalAreas || 0,
      functions: m.functions,
      note: m.note,
      avatar: m.avatar || '/placeholder.svg',
      invitationSent: m.invitationSent,
      role: m.role || 'member',
      password: m.password,
      personalNotes: m.personalNotes || m.personal_notes,
      personalTodos: m.personalTodos || m.personal_todos,
      statusClana: m.statusClana || m.status_clana,
      datumZadnjeUplate: m.datumZadnjeUplate || m.datum_zadnje_uplate,
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
      allPayments: m.allPayments || m.all_payments,
      notes: m.notes,
      accessRights: m.accessRights,
      is_temp_password: m.isTempPassword ?? m.is_temp_password,
      last_payment_reminder_at: m.lastPaymentReminderAt ?? m.last_payment_reminder_at,
    };
    
    // Ensure we only stringify if it's not already a string
    const jsonFields = ['functions', 'personalTodos', 'researchAreas', 'research_areas', 'accessRights', 'payments', 'allPayments'];
    jsonFields.forEach(field => {
      if (payload[field] !== undefined && payload[field] !== null && typeof payload[field] !== 'string') {
        payload[field] = JSON.stringify(payload[field]);
      }
    });
    
    // Booleans to integers for SQLite
    const booleanFields = ['honorary', 'exemptFromPayment', 'expelled', 'deceased', 'invitationSent', 'is_temp_password'];
    booleanFields.forEach(field => {
      if (payload[field] !== undefined && payload[field] !== null) {
        payload[field] = payload[field] ? 1 : 0;
      }
    });

    // Remove undefined fields to let defaults work or avoid SQLite issues
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    return payload;
  }

  async getAllMembers() {
    const rows = await this.repo.findAll();
    return rows.map(r => this.parseMember(r));
  }

  async getMember(id: number) {
    const row = await this.repo.findById(id);
    return this.parseMember(row);
  }

  async createMember(data: any) {
    if (data.email) {
      const existing = await this.repo.findByEmail(data.email);
      if (existing) return existing.id;
    }
    const serialized = this.serializeMember(data);
    try {
      return await this.repo.insert(serialized);
    } catch (error) {
      console.error('Error in MemberService.createMember:', error);
      throw error;
    }
  }

  async updateMember(id: number, data: any) {
    const serialized = this.serializeMember(data);
    return await this.repo.update(id, serialized);
  }

  async deleteMember(id: number) {
    return await this.repo.delete(id);
  }
}
