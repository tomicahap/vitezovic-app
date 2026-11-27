import { MemberRepository } from '../repositories/member-repository';
import { computeMemberStates, StatusSettings } from '@/lib/member-status';
import { inspectMemberDate } from '@/lib/date-validation';
import { hashPassword, isHashedPassword } from '@/lib/password-hash';

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
    const {
      password: _secretPassword,
      data_form_session_nonce: _secretNonce,
      dataFormSessionNonce: _secretCamelNonce,
      invitation_token: _secretInviteToken,
      invitationToken: _secretInviteCamelToken,
      ...safeMember
    } = m;
    const name = safeMember.name || '';
    const initials = name
      .split(/\s+/)
      .map((n: string) => n[0])
      .filter(Boolean)
      .join('')
      .toUpperCase();

    return {
      ...safeMember,
      initials,
      functions: this.safeParse(safeMember.functions, []),
      personal_todos: this.safeParse(safeMember.personalTodos || safeMember.personal_todos, []),
      researchAreas: this.safeParse(safeMember.researchAreas || safeMember.research_areas, []),
      accessRights: this.safeParse(
        safeMember.accessRights && safeMember.accessRights !== '{}' && safeMember.accessRights !== 'null'
          ? safeMember.accessRights
          : (safeMember.access_rights || safeMember.accessRights),
        null
      ),
      payments: this.safeParse(safeMember.payments, []),
      allPayments: this.safeParse(safeMember.allPayments || safeMember.all_payments, []),
      // Booleans
      honorary: safeMember.honorary === 1 || safeMember.honorary === true,
      exemptFromPayment: safeMember.exemptFromPayment === 1 || safeMember.exemptFromPayment === true,
      expelled: safeMember.expelled === 1 || safeMember.expelled === true,
      deceased: safeMember.deceased === 1 || safeMember.deceased === true,
      invitationSent: safeMember.invitationSent === 1 || safeMember.invitationSent === true,
      invitationSentAt: safeMember.invitationSentAt || safeMember.invitation_sent_at || null,
      hasPassword: Boolean(_secretPassword && String(_secretPassword).trim()),
      lastLoginAt: safeMember.lastLoginAt || safeMember.last_login_at || null,
      isTempPassword:
        (safeMember.is_temp_password ?? safeMember.isTempPassword) === 1 ||
        (safeMember.is_temp_password ?? safeMember.isTempPassword) === true,
      // Map schema keys to frontend keys
      personal_notes: safeMember.personalNotes || safeMember.personal_notes || '',
      status_clana: safeMember.statusClana || safeMember.status_clana,
      datum_zadnje_uplate: safeMember.datumZadnjeUplate || safeMember.datum_zadnje_uplate,
      lastPaymentReminderAt: safeMember.lastPaymentReminderAt || safeMember.last_payment_reminder_at,
      lastBirthdayEmailAt: safeMember.lastBirthdayEmailAt || safeMember.last_birthday_email_at || null,
      lastMissingDataEmailAt: safeMember.lastMissingDataEmailAt || safeMember.last_missing_data_email_at || null,
      dataFormToken: safeMember.dataFormToken || safeMember.data_form_token || null,
      dataFormViewedAt: safeMember.dataFormViewedAt || safeMember.data_form_viewed_at || null,
      dataFormSubmittedAt: safeMember.dataFormSubmittedAt || safeMember.data_form_submitted_at || null,
      dataFormUpdatedFields: this.safeParse(safeMember.dataFormUpdatedFields || safeMember.data_form_updated_fields, []),
      dataFormSingleUse:
        (safeMember.data_form_single_use ?? safeMember.dataFormSingleUse) === 1 ||
        (safeMember.data_form_single_use ?? safeMember.dataFormSingleUse) === true,
      maidenName: safeMember.maidenName ?? safeMember.maiden_name ?? '',
      oib: safeMember.oib ?? '',
      birthPlace: safeMember.birthPlace ?? safeMember.birth_place ?? '',
      birthCountry: safeMember.birthCountry ?? safeMember.birth_country ?? '',
      landlinePhone: safeMember.landlinePhone ?? safeMember.landline_phone ?? '',
      occupation: safeMember.occupation ?? '',
      workExperience: safeMember.workExperience ?? safeMember.work_experience ?? '',
      hobbiesSkills: safeMember.hobbiesSkills ?? safeMember.hobbies_skills ?? '',
      foreignLanguages: safeMember.foreignLanguages ?? safeMember.foreign_languages ?? '',
      doNotContact:
        (safeMember.do_not_contact ?? safeMember.doNotContact) === 1 ||
        (safeMember.do_not_contact ?? safeMember.doNotContact) === true,
      doNotContactDate: safeMember.do_not_contact_date ?? safeMember.doNotContactDate ?? '',
      doNotContactNote: safeMember.do_not_contact_note ?? safeMember.doNotContactNote ?? '',
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

    const normalizeDateField = (val: any): any => {
      if (val === undefined) return undefined;
      if (val === null || val === '') return val;
      const inspected = inspectMemberDate(val);
      if (inspected.status === 'empty') return '';
      return inspected.isoDate || val;
    };

    const normalizedPayments = Array.isArray(m.payments)
      ? m.payments.map((p: any) => {
          if (!p || typeof p !== 'object') return p;
          if (p.date === undefined || p.date === null || p.date === '') return p;
          const inspected = inspectMemberDate(p.date);
          if (inspected.status === 'empty') return { ...p, date: '' };
          return inspected.isoDate ? { ...p, date: inspected.isoDate } : p;
        })
      : m.payments;

    const rawJoinDate = isUpdate ? m.joinDate : (m.joinDate || new Date().toISOString().split('T')[0]);

    // Map frontend/legacy keys to schema keys
    const payload: any = {
      name: m.name,
      email: m.email,
      initials: computedInitials,
      phone: m.phone,
      birthDate: normalizeDateField(m.birthDate),
      address: m.address,
      membershipNumber: m.membershipNumber,
      registryNumber: m.registryNumber,
      status: isUpdate ? m.status : (m.status || 'active'),
      paymentStatus: isUpdate ? m.paymentStatus : (m.paymentStatus || 'paid'),
      joinDate: normalizeDateField(rawJoinDate),
      researchAreas: m.researchAreas ?? m.research_areas,
      research_areas: m.researchAreas ?? m.research_areas,
      additionalAreas: isUpdate ? m.additionalAreas : (m.additionalAreas ?? 0),
      functions: m.functions,
      note: m.note,
      avatar: isUpdate ? m.avatar : (m.avatar || '/placeholder.svg'),
      invitationSent: m.invitationSent,
      invitation_sent_at: m.invitationSentAt ?? m.invitation_sent_at,
      invitation_token: m.invitationToken !== undefined ? m.invitationToken : m.invitation_token,
      invitation_token_expires_at:
        m.invitationTokenExpiresAt !== undefined
          ? m.invitationTokenExpiresAt
          : m.invitation_token_expires_at,
      role: isUpdate ? m.role : (m.role || 'member'),
      password:
        typeof m.password === 'string' && m.password.trim()
          ? isHashedPassword(m.password)
            ? m.password
            : hashPassword(m.password)
          : isUpdate
          ? undefined
          : m.password,
      personalNotes: m.personalNotes ?? m.personal_notes,
      personalTodos: m.personalTodos ?? m.personal_todos,
      statusClana: m.statusClana ?? m.status_clana,
      datumZadnjeUplate: normalizeDateField(m.datumZadnjeUplate ?? m.datum_zadnje_uplate),
      honorary: m.honorary,
      exemptFromPayment: m.exemptFromPayment,
      expelled: m.expelled,
      expulsionDate: normalizeDateField(m.expulsionDate),
      expulsionReason: m.expulsionReason,
      deceased: m.deceased,
      deathDate: normalizeDateField(m.deathDate),
      lastPayment: m.lastPayment,
      expiry: m.expiry,
      payments: normalizedPayments,
      allPayments: m.allPayments ?? m.all_payments,
      notes: m.notes,
      accessRights: m.accessRights ?? m.access_rights,
      access_rights: m.accessRights ?? m.access_rights,
      is_temp_password: m.isTempPassword ?? m.is_temp_password,
      last_payment_reminder_at: m.lastPaymentReminderAt !== undefined ? m.lastPaymentReminderAt : m.last_payment_reminder_at,
      last_birthday_email_at: m.lastBirthdayEmailAt !== undefined ? m.lastBirthdayEmailAt : m.last_birthday_email_at,
      last_missing_data_email_at: m.lastMissingDataEmailAt !== undefined ? m.lastMissingDataEmailAt : m.last_missing_data_email_at,
      data_form_token: m.dataFormToken !== undefined ? m.dataFormToken : m.data_form_token,
      data_form_viewed_at: m.dataFormViewedAt !== undefined ? m.dataFormViewedAt : m.data_form_viewed_at,
      data_form_submitted_at: m.dataFormSubmittedAt !== undefined ? m.dataFormSubmittedAt : m.data_form_submitted_at,
      data_form_updated_fields: m.dataFormUpdatedFields !== undefined ? m.dataFormUpdatedFields : m.data_form_updated_fields,
      data_form_single_use: m.dataFormSingleUse !== undefined ? m.dataFormSingleUse : m.data_form_single_use,
      data_form_session_nonce: m.dataFormSessionNonce !== undefined ? m.dataFormSessionNonce : m.data_form_session_nonce,
      maiden_name: m.maidenName ?? m.maiden_name,
      oib: m.oib,
      birth_place: m.birthPlace ?? m.birth_place,
      birth_country: m.birthCountry ?? m.birth_country,
      landline_phone: m.landlinePhone ?? m.landline_phone,
      occupation: m.occupation,
      work_experience: m.workExperience ?? m.work_experience,
      hobbies_skills: m.hobbiesSkills ?? m.hobbies_skills,
      foreign_languages: m.foreignLanguages ?? m.foreign_languages,
      do_not_contact: m.doNotContact ?? m.do_not_contact,
      do_not_contact_date: normalizeDateField(m.doNotContactDate ?? m.do_not_contact_date),
      do_not_contact_note: m.doNotContactNote ?? m.do_not_contact_note,
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
      'do_not_contact',
      'data_form_single_use',
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
        const dateKeys = ['joinDate', 'birthDate', 'expulsionDate', 'deathDate', 'doNotContactDate'] as const;
        for (const key of dateKeys) {
          const check = inspectMemberDate(member[key]);
          if (check.status === 'convertible' && check.isoDate) {
            updates[key] = check.isoDate;
          } else if (check.status === 'empty' && member[key] && String(member[key]).trim() !== '') {
            updates[key] = '';
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
            if (check.status === 'empty' && p.date && String(p.date).trim() !== '') {
              paymentsChanged = true;
              return { ...p, date: '' };
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
