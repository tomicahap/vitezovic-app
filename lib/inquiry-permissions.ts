export type InquiryStatusCategory = 'zaprimljeno' | 'uradu' | 'zavrseno';

/**
 * Određuje kategoriju statusa za istraživački upit:
 * - unassigned / pending -> zaprimljeno
 * - active -> uradu
 * - completed / rejected -> zavrseno
 */
export function getInquiryStatusCategory(status?: string): InquiryStatusCategory {
  if (status === 'active') return 'uradu';
  if (status === 'completed' || status === 'rejected') return 'zavrseno';
  return 'zaprimljeno';
}

export interface InquiryPermissions {
  zaprimljeno: { view: boolean; edit: boolean };
  uradu: { view: boolean; edit: boolean };
  zavrseno: { view: boolean; edit: boolean };
  canViewAny: boolean;
  canEditAny: boolean;
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

  const ar = user.accessRights || {};
  const base = ar.research_inquiries || {};

  // Provjeri specifična prava za svaku razinu, uz fallback na opće research_inquiries pravo
  const zapView =
    ar.research_inquiries_zaprimljeno?.view ??
    base.zaprimljeno?.view ??
    (base.view !== undefined ? base.view : true);
  const zapEdit =
    ar.research_inquiries_zaprimljeno?.edit ??
    base.zaprimljeno?.edit ??
    (base.edit === true);

  const uraduView =
    ar.research_inquiries_uradu?.view ??
    base.uradu?.view ??
    (base.view !== undefined ? base.view : true);
  const uraduEdit =
    ar.research_inquiries_uradu?.edit ??
    base.uradu?.edit ??
    (base.edit === true);

  const zavView =
    ar.research_inquiries_zavrseno?.view ??
    base.zavrseno?.view ??
    (base.view !== undefined ? base.view : true);
  const zavEdit =
    ar.research_inquiries_zavrseno?.edit ??
    base.zavrseno?.edit ??
    (base.edit === true);

  const zaprimljeno = { view: Boolean(zapView), edit: Boolean(zapEdit) };
  const uradu = { view: Boolean(uraduView), edit: Boolean(uraduEdit) };
  const zavrseno = { view: Boolean(zavView), edit: Boolean(zavEdit) };

  return {
    zaprimljeno,
    uradu,
    zavrseno,
    canViewAny: zaprimljeno.view || uradu.view || zavrseno.view,
    canEditAny: zaprimljeno.edit || uradu.edit || zavrseno.edit,
  };
}
