export type InquiryStatusCategory = 'zaprimljeno' | 'uradu' | 'zavrseno';

/**
 * Određuje kategoriju statusa za istraživački upit:
 * - unassigned / pending -> zaprimljeno
 * - active -> uradu
 * - completed / rejected -> zavrseno
 */
export function getInquiryStatusCategory(status?: string): InquiryStatusCategory {
  const s = (status || '').trim().toLowerCase();
  if (s === 'active' || s === 'u_radu' || s === 'uradu') return 'uradu';
  if (s === 'completed' || s === 'rejected' || s === 'zavrseno' || s === 'done') return 'zavrseno';
  return 'zaprimljeno';
}

export interface InquiryPermissions {
  zaprimljeno: { view: boolean; edit: boolean };
  uradu: { view: boolean; edit: boolean };
  zavrseno: { view: boolean; edit: boolean };
  canViewAny: boolean;
  canEditAny: boolean;
}

export function parseAccessRights(raw: any): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string') {
        return parseAccessRights(parsed);
      }
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

/**
 * Vraća sigurno parsirana prava pristupa korisnika (spaja accessRights i access_rights).
 */
export function getUserAccessRights(user?: any): Record<string, any> {
  if (!user) return {};
  const raw = user.accessRights !== undefined && user.accessRights !== null
    ? user.accessRights
    : user.access_rights;
  const parsed = parseAccessRights(raw);
  if (user.access_rights && user.access_rights !== raw) {
    const fallbackParsed = parseAccessRights(user.access_rights);
    return { ...fallbackParsed, ...parsed };
  }
  return parsed;
}

/**
 * Vraća prava pristupa korisnika za 3 razine upita i istraživanja:
 * - ZAPRIMLJENO (pogled, uređivanje)
 * - U RADU (pogled, uređivanje)
 * - ZAVRŠENO (pogled, uređivanje)
 */
export function getInquiryPermissions(user?: any): InquiryPermissions {
  if (!user) {
    return {
      zaprimljeno: { view: false, edit: false },
      uradu: { view: false, edit: false },
      zavrseno: { view: false, edit: false },
      canViewAny: false,
      canEditAny: false,
    };
  }

  // Administrator i Moderator imaju pune ovlasti nad svim razinama
  if (user.role === 'admin' || user.role === 'moderator') {
    return {
      zaprimljeno: { view: true, edit: true },
      uradu: { view: true, edit: true },
      zavrseno: { view: true, edit: true },
      canViewAny: true,
      canEditAny: true,
    };
  }

  const ar = getUserAccessRights(user);
  const hasGranularKeys =
    ar.research_inquiries_zaprimljeno !== undefined ||
    ar.research_inquiries_uradu !== undefined ||
    ar.research_inquiries_zavrseno !== undefined;

  if (hasGranularKeys) {
    const zapEdit = ar.research_inquiries_zaprimljeno?.edit === true;
    const zapView = ar.research_inquiries_zaprimljeno?.view === true || zapEdit;

    const uraduEdit = ar.research_inquiries_uradu?.edit === true;
    const uraduView = ar.research_inquiries_uradu?.view === true || uraduEdit;

    const zavEdit = ar.research_inquiries_zavrseno?.edit === true;
    const zavView = ar.research_inquiries_zavrseno?.view === true || zavEdit;

    const zaprimljeno = { view: zapView, edit: zapEdit };
    const uradu = { view: uraduView, edit: uraduEdit };
    const zavrseno = { view: zavView, edit: zavEdit };

    return {
      zaprimljeno,
      uradu,
      zavrseno,
      canViewAny: zaprimljeno.view || uradu.view || zavrseno.view,
      canEditAny: zaprimljeno.edit || uradu.edit || zavrseno.edit,
    };
  }

  // Fallback ako su postavljena samo stara zbirna research_inquiries prava
  const base = ar.research_inquiries;
  if (base && typeof base === 'object') {
    const legacyEdit = base.edit === true;
    const legacyView = base.view === true || legacyEdit;
    return {
      zaprimljeno: { view: legacyView, edit: legacyEdit },
      uradu: { view: legacyView, edit: legacyEdit },
      zavrseno: { view: legacyView, edit: legacyEdit },
      canViewAny: legacyView,
      canEditAny: legacyEdit,
    };
  }

  return {
    zaprimljeno: { view: false, edit: false },
    uradu: { view: false, edit: false },
    zavrseno: { view: false, edit: false },
    canViewAny: false,
    canEditAny: false,
  };
}

/**
 * Pravila za Funkcije u društvu:
 * - Vidjeti mogu po defaultu svi koji se prijave u sustav, osim ako im nije eksplicitno isključeno (view === false)
 * - Uređivati mogu admin, moderator ili član kojem je uključeno edit === true
 */
export function getFunctionsPermissions(user?: any): { view: boolean; edit: boolean } {
  if (!user) return { view: false, edit: false };
  if (user.role === 'admin' || user.role === 'moderator') {
    return { view: true, edit: true };
  }
  const ar = getUserAccessRights(user);
  const fnRight = ar.functions;
  const edit = fnRight?.edit === true;
  const view = fnRight?.view !== false || edit;
  return { view, edit };
}
