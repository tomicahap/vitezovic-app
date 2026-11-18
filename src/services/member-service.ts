import { MemberRepository } from '../repositories/member-repository';
import { computeMemberStates, StatusSettings } from '@/lib/member-status';
import { inspectMemberDate } from '@/lib/date-validation';

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
      lastBirthdayEmailAt: m.lastBirthdayEmailAt || m.last_birthday_email_at || null,
      lastMissingDataEmailAt: m.lastMissingDataEmailAt || m.last_missing_data_email_at || null,
      dataFormToken: m.dataFormToken || m.data_form_token || null,
      dataFormViewedAt: m.dataFormViewedAt || m.data_form_viewed_at || null,
      dataFormSubmittedAt: m.dataFormSubmittedAt || m.data_form_submitted_at || null,
      dataFormUpdatedFields: this.safeParse(m.dataFormUpdatedFields || m.data_form_updated_fields, []),
      maidenName: m.maidenName ?? m.maiden_name ?? '',
      oib: m.oib ?? '',
      birthPlace: m.birthPlace ?? m.birth_place ?? '',
      birthCountry: m.birthCountry ?? m.birth_country ?? '',
      landlinePhone: m.landlinePhone ?? m.landline_phone ?? '',
      occupation: m.occupation ?? '',
      workExperience: m.workExperience ?? m.work_experience ?? '',
      hobbiesSkills: m.hobbiesSkills ?? m.hobbies_skills ?? '',
      foreignLanguages: m.foreignLanguages ?? m.foreign_languages ?? '',
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
      last_birthday_email_at: m.lastBirthdayEmailAt ?? m.last_birthday_email_at,
      last_missing_data_email_at: m.lastMissingDataEmailAt ?? m.last_missing_data_email_at,
      data_form_token: m.dataFormToken ?? m.data_form_token,
      data_form_viewed_at: m.dataFormViewedAt ?? m.data_form_viewed_at,
      data_form_submitted_at: m.dataFormSubmittedAt ?? m.data_form_submitted_at,
      data_form_updated_fields: m.dataFormUpdatedFields ?? m.data_form_updated_fields,
      maiden_name: m.maidenName ?? m.maiden_name,
      oib: m.oib,
      birth_place: m.birthPlace ?? m.birth_place,
      birth_country: m.birthCountry ?? m.birth_country,
      landline_phone: m.landlinePhone ?? m.landline_phone,
      occupation: m.occupation,
      work_experience: m.workExperience ?? m.work_experience,
      hobbies_skills: m.hobbiesSkills ?? m.hobbies_skills,
      foreign_languages: m.foreignLanguages ?? m.foreign_languages,
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
      'data_form_updated_fields',
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

  async createMember(data: any, options?: { skipExistingEmail?: boolean; allowDuplicateEmail?: boolean }) {
    // Administrator se nikada ne smije upisati kao član
    if (isAdminRecord(data)) {
      return 0;
    }
    if (data.email && !options?.allowDuplicateEmail) {
      const existing = await this.repo.findByEmail(data.email);
      if (existing) {
        if (options?.skipExistingEmail) return existing.id;
        throw new Error(`Član s e-mail adresom "${data.email}" već postoji u bazi (${existing.name}).`);
      }
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

  async bulkCleanup(
    mode: 'clear-payments' | 'clear-join-dates' | 'clear-both' | 'normalize-dates' | 'fill-missing-join-date-2007' | 'recalculate-statuses',
    memberIds?: number[],
    settings?: StatusSettings
  ): Promise<number> {
    const all = await this.getAllMembers();
    const targetSet = Array.isArray(memberIds) && memberIds.length > 0 ? new Set(memberIds) : null;
    const targets = targetSet ? all.filter((m) => targetSet.has(m.id)) : all;
    const effectiveSettings: StatusSettings = settings || { overdueAfterDays: 365, expiredAfterDays: 730 };

    let updatedCount = 0;

    for (const member of targets) {
      const updates: Record<string, any> = {};

      if (mode === 'clear-payments' || mode === 'clear-both') {
        updates.payments = [];
        updates.allPayments = [];
        updates.datum_zadnje_uplate = null;
        updates.lastPayment = '';
        updates.expiry = '';
      }

      if (mode === 'clear-join-dates' || mode === 'clear-both') {
        updates.joinDate = '';
      }

      if (mode === 'fill-missing-join-date-2007') {
        if (!member.joinDate || !String(member.joinDate).trim()) {
          updates.joinDate = '2007-01-01';
        }
      }

      if (mode === 'normalize-dates' || mode === 'recalculate-statuses') {
        const dateKeys = ['joinDate', 'birthDate', 'expulsionDate', 'deathDate'] as const;
        for (const key of dateKeys) {
          const check = inspectMemberDate(member[key]);
          if (check.status === 'convertible' && check.isoDate) {
            updates[key] = check.isoDate;
          }
        }
        if (Array.isArray(member.payments) && member.payments.length > 0) {
          let paymentsChanged = false;
          const nextPayments = member.payments.map((p: any) => {
            const check = inspectMemberDate(p.date);
            if (check.status === 'convertible' && check.isoDate) {
              paymentsChanged = true;
              return { ...p, date: check.isoDate };
            }
            return p;
          });
          if (paymentsChanged) {
            updates.payments = nextPayments;
          }
        }
      }

      const merged = { ...member, ...updates };
      const computed = computeMemberStates(merged, effectiveSettings);

      if (mode === 'recalculate-statuses') {
        const statusChanged =
          member.status !== computed.status ||
          member.paymentStatus !== computed.paymentStatus ||
          member.status_clana !== computed.status_clana ||
          (member.datum_zadnje_uplate ?? null) !== (computed.datum_zadnje_uplate ?? null);
        if (!statusChanged && Object.keys(updates).length === 0) {
          continue;
        }
      } else if (Object.keys(updates).length === 0) {
        continue;
      }

      updates.status = computed.status;
      updates.paymentStatus = computed.paymentStatus;
      updates.status_clana = computed.status_clana;
      updates.datum_zadnje_uplate = computed.datum_zadnje_uplate;

      const serialized = this.serializeMember(updates, true);
      await this.repo.update(member.id, serialized);
      updatedCount++;
    }

    return updatedCount;
  }

  async batchUpdateDates(
    items: Array<{ id: number; joinDate?: string; birthDate?: string; clearPayments?: boolean }>,
    settings?: StatusSettings
  ): Promise<number> {
    const effectiveSettings: StatusSettings = settings || { overdueAfterDays: 365, expiredAfterDays: 730 };
    let updatedCount = 0;

    for (const item of items) {
      const existing = await this.getMember(item.id);
      if (!existing) continue;

      const updates: Record<string, any> = {};
      if (item.joinDate !== undefined) updates.joinDate = item.joinDate;
      if (item.birthDate !== undefined) updates.birthDate = item.birthDate;
      if (item.clearPayments) {
        updates.payments = [];
        updates.allPayments = [];
        updates.datum_zadnje_uplate = null;
        updates.lastPayment = '';
        updates.expiry = '';
      }

      const merged = { ...existing, ...updates };
      const computed = computeMemberStates(merged, effectiveSettings);
      updates.status = computed.status;
      updates.paymentStatus = computed.paymentStatus;
      updates.status_clana = computed.status_clana;
      updates.datum_zadnje_uplate = computed.datum_zadnje_uplate;

      const serialized = this.serializeMember(updates, true);
      await this.repo.update(existing.id, serialized);
      updatedCount++;
    }

    return updatedCount;
  }
}
