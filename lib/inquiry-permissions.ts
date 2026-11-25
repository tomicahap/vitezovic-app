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
  hasAssignedAccess: boolean;
}

export interface InquiryCaseCapabilities {
  isAdmin: boolean;
  isModerator: boolean;
  isAssignedResearcher: boolean;
  isClosedLocked: boolean;
  category: InquiryStatusCategory;
  perms: InquiryPermissions;
  hasStageView: boolean;
  hasStageEdit: boolean;
  canView: boolean;
  canEdit: boolean;
  canUploadFiles: boolean;
  canCloseCase: boolean;
  canReopenCase: boolean;
  canReassign: boolean;
  canSendOfficialEmail: boolean;
  canDeleteCase: boolean;
}

/**
 * Provjerava je li istraživački predmet dodijeljen navedenom korisniku (istraživaču).
 * Primarno uspoređuje numerički `assigned_to_id`, a fallback po imenu koristi samo
 * kada `assigned_to_id` nije postavljen u bazi.
 */
export function isInquiryAssignedToUser(inquiry?: any, user?: any): boolean {
  if (!inquiry || !user) return false;
  const userId = Number(user.id);
  const rawAssignedId = inquiry.assigned_to_id;
  const hasAssignedId =
    rawAssignedId !== null &&
    rawAssignedId !== undefined &&
    String(rawAssignedId).trim() !== '' &&
    Number(rawAssignedId) > 0;

  if (hasAssignedId) {
    return Number.isFinite(userId) && userId > 0 && Number(rawAssignedId) === userId;
  }

  const assignedName = String(inquiry.assigned_to_name || '').trim().toLowerCase();
  const userName = String(user.name || '').trim().toLowerCase();
  return Boolean(assignedName && userName && assignedName === userName);
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
      hasAssignedAccess: false,
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
      hasAssignedAccess: false,
    };
  }

  const hasAssignedAccess = Boolean(user.hasAssignedInquiries);
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
      canViewAny: zaprimljeno.view || uradu.view || zavrseno.view || hasAssignedAccess,
      canEditAny: zaprimljeno.edit || uradu.edit || zavrseno.edit,
      hasAssignedAccess,
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
      canViewAny: legacyView || hasAssignedAccess,
      canEditAny: legacyEdit,
      hasAssignedAccess,
    };
  }

  return {
    zaprimljeno: { view: false, edit: false },
    uradu: { view: false, edit: false },
    zavrseno: { view: false, edit: false },
    canViewAny: hasAssignedAccess,
    canEditAny: false,
    hasAssignedAccess,
  };
}

/**
 * Određuje stvarne ovlasti nad pojedinim istraživačkim predmetom.
 * Dodijeljeni istraživač automatski ima pravo pregleda, dopune bilješki/rezultata,
 * dodavanja datoteka te zatvaranja i ponovnog otvaranja svog predmeta.
 */
export function getInquiryCaseCapabilities(inquiry?: any, user?: any): InquiryCaseCapabilities {
  const perms = getInquiryPermissions(user);
  const category = getInquiryStatusCategory(inquiry?.status);
  const rawStatus = String(inquiry?.status || '').trim().toLowerCase();
  const isClosedLocked = category === 'zavrseno' && rawStatus !== 'rejected';
  const isAdmin = user?.role === 'admin';
  const isModerator = user?.role === 'moderator';
  const isAssignedResearcher = isInquiryAssignedToUser(inquiry, user);

  const hasStageView = Boolean(isAdmin || isModerator || perms[category]?.view);
  const hasStageEdit = Boolean(isAdmin || isModerator || perms[category]?.edit);

  const canView = Boolean(hasStageView || isAssignedResearcher);
  const canEdit = isClosedLocked ? false : Boolean(hasStageEdit || isAssignedResearcher);

  return {
    isAdmin,
    isModerator,
    isAssignedResearcher,
    isClosedLocked,
    category,
    perms,
    hasStageView,
    hasStageEdit,
    canView,
    canEdit,
    canUploadFiles: canEdit,
    canCloseCase: isClosedLocked ? false : Boolean(isAdmin || isModerator || perms.zavrseno.edit || isAssignedResearcher),
    canReopenCase: false,
    canReassign: isClosedLocked ? false : hasStageEdit,
    canSendOfficialEmail: isClosedLocked ? false : hasStageEdit,
    canDeleteCase: isClosedLocked ? Boolean(isAdmin) : hasStageEdit,
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

export type MemberActionPermissionKey =
  | 'member_action_zatrazi_dopunu'
  | 'member_action_posalji_pozivnicu'
  | 'member_action_rodjendanske_cestitke'
  | 'member_action_duplikati'
  | 'member_action_krivi_datumi'
  | 'member_action_ciscenje_datuma_uplata'
  | 'member_action_dopuna_podataka'
  | 'member_action_uvezi_clanove'
  | 'member_action_obavijesti_za_placanje'
  | 'member_action_obavijest_tijelima';

export interface MemberActionPermissionItem {
  key: MemberActionPermissionKey;
  prop:
    | 'zatrazi_dopunu'
    | 'posalji_pozivnicu'
    | 'rodjendanske_cestitke'
    | 'duplikati'
    | 'krivi_datumi'
    | 'ciscenje_datuma_uplata'
    | 'dopuna_podataka'
    | 'uvezi_clanove'
    | 'obavijesti_za_placanje'
    | 'obavijest_tijelima';
  label: string;
  description: string;
}

export const MEMBER_ACTION_PERMISSIONS_LIST: MemberActionPermissionItem[] = [
  {
    key: 'member_action_zatrazi_dopunu',
    prop: 'zatrazi_dopunu',
    label: 'Zatraži dopunu',
    description: 'Slanje personalizirane zamolbe za dopunu podataka iz kartona pojedinog člana',
  },
  {
    key: 'member_action_posalji_pozivnicu',
    prop: 'posalji_pozivnicu',
    label: 'Pošalji pozivnicu',
    description: 'Slanje pozivnice s korisničkim podacima i lozinkom članu',
  },
  {
    key: 'member_action_rodjendanske_cestitke',
    prop: 'rodjendanske_cestitke',
    label: 'Pošalji rođendanske čestitke',
    description: 'Pregled i slanje rođendanske čestitke članovima',
  },
  {
    key: 'member_action_duplikati',
    prop: 'duplikati',
    label: 'Duplikati',
    description: 'Filter i provjera potencijalno duplih zapisa članova u registru',
  },
  {
    key: 'member_action_krivi_datumi',
    prop: 'krivi_datumi',
    label: 'Krivi datumi',
    description: 'Filter, oznake pogrešnog formata datuma i brzi ispravak datuma upisa',
  },
  {
    key: 'member_action_ciscenje_datuma_uplata',
    prop: 'ciscenje_datuma_uplata',
    label: 'Čišćenje datuma i uplata',
    description: 'Alat za skupno usklađivanje datuma rođenja, upisa i uplata članarina',
  },
  {
    key: 'member_action_dopuna_podataka',
    prop: 'dopuna_podataka',
    label: 'Dopuna podataka (Link + PDF)',
    description: 'Masovno slanje poveznice i PDF kartona za dopunu podataka na popisu članova',
  },
  {
    key: 'member_action_uvezi_clanove',
    prop: 'uvezi_clanove',
    label: 'Uvezi članove',
    description: 'Uvoz članova iz Excel / CSV tablica u sustav',
  },
  {
    key: 'member_action_obavijesti_za_placanje',
    prop: 'obavijesti_za_placanje',
    label: 'Obavijesti za plaćanje',
    description: 'Skupno i pojedinačno slanje podsjetnika za plaćanje članarine',
  },
  {
    key: 'member_action_obavijest_tijelima',
    prop: 'obavijest_tijelima',
    label: 'Obavijest članovima tijela',
    description: 'Slanje unificiranih službenih e-mail obavijesti trenutnom sastavu tijela društva (uklj. testni mail)',
  },
];

export interface MemberActionPermissions {
  zatrazi_dopunu: boolean;
  posalji_pozivnicu: boolean;
  rodjendanske_cestitke: boolean;
  duplikati: boolean;
  krivi_datumi: boolean;
  ciscenje_datuma_uplata: boolean;
  dopuna_podataka: boolean;
  uvezi_clanove: boolean;
  obavijesti_za_placanje: boolean;
  obavijest_tijelima: boolean;
  hasAnyMemberAction: boolean;
}

/**
 * Granularne ovlasti za alate i akcije nad članovima:
 * - Administrator (role === 'admin') ima potpuna prava na sve (sve true).
 * - Svi ostali korisnici dobivaju pristup samo za one funkcije koje su im pojedinačno odobrene.
 */
export function getMemberActionPermissions(user?: any): MemberActionPermissions {
  if (!user) {
    return {
      zatrazi_dopunu: false,
      posalji_pozivnicu: false,
      rodjendanske_cestitke: false,
      duplikati: false,
      krivi_datumi: false,
      ciscenje_datuma_uplata: false,
      dopuna_podataka: false,
      uvezi_clanove: false,
      obavijesti_za_placanje: false,
      obavijest_tijelima: false,
      hasAnyMemberAction: false,
    };
  }

  if (user.role === 'admin') {
    return {
      zatrazi_dopunu: true,
      posalji_pozivnicu: true,
      rodjendanske_cestitke: true,
      duplikati: true,
      krivi_datumi: true,
      ciscenje_datuma_uplata: true,
      dopuna_podataka: true,
      uvezi_clanove: true,
      obavijesti_za_placanje: true,
      obavijest_tijelima: true,
      hasAnyMemberAction: true,
    };
  }

  const ar = getUserAccessRights(user);
  const hasKey = (key: MemberActionPermissionKey): boolean => {
    const entry = ar[key];
    if (entry === true) return true;
    return Boolean(entry?.edit === true || entry?.view === true);
  };

  const perms = {
    zatrazi_dopunu: hasKey('member_action_zatrazi_dopunu'),
    posalji_pozivnicu: hasKey('member_action_posalji_pozivnicu'),
    rodjendanske_cestitke: hasKey('member_action_rodjendanske_cestitke'),
    duplikati: hasKey('member_action_duplikati'),
    krivi_datumi: hasKey('member_action_krivi_datumi'),
    ciscenje_datuma_uplata: hasKey('member_action_ciscenje_datuma_uplata'),
    dopuna_podataka: hasKey('member_action_dopuna_podataka'),
    uvezi_clanove: hasKey('member_action_uvezi_clanove'),
    obavijesti_za_placanje: hasKey('member_action_obavijesti_za_placanje'),
    obavijest_tijelima: hasKey('member_action_obavijest_tijelima'),
  };

  return {
    ...perms,
    hasAnyMemberAction: Object.values(perms).some(Boolean),
  };
}

export type AppModulePermissionKey =
  | 'members'
  | 'functions'
  | 'finances'
  | 'meetings'
  | 'polls'
  | 'projects'
  | 'research_inquiries_zaprimljeno'
  | 'research_inquiries_uradu'
  | 'research_inquiries_zavrseno'
  | 'lectures'
  | 'library'
  | 'gmail'
  | 'notifications'
  | 'contacts'
  | 'archive'
  | 'drive'
  | 'links'
  | 'reports'
  | 'chronicle'
  | 'logs';

export type AppModuleGroupId =
  | 'clanstvo'
  | 'projekti_istrazivanja'
  | 'komunikacija_arhiv'
  | 'izvjesca_nadzor';

export interface AppModulePermissionItem {
  key: AppModulePermissionKey;
  label: string;
  description: string;
  group: AppModuleGroupId;
  defaultView?: boolean;
}

export const APP_MODULE_GROUPS: Array<{ id: AppModuleGroupId; title: string }> = [
  { id: 'clanstvo', title: 'Članstvo i upravljanje društvom' },
  { id: 'projekti_istrazivanja', title: 'Projekti, istraživanja i program' },
  { id: 'komunikacija_arhiv', title: 'Komunikacija, kontakti i arhiv' },
  { id: 'izvjesca_nadzor', title: 'Izvješća, ljetopis i nadzor' },
];

export const APP_MODULE_PERMISSIONS_LIST: AppModulePermissionItem[] = [
  {
    key: 'members',
    label: 'Članovi',
    description: 'Pristup matičnoj knjizi članova, osobnim podacima i statusima',
    group: 'clanstvo',
  },
  {
    key: 'functions',
    label: 'Funkcije u društvu',
    description: 'Pregled i uređivanje ustroja tijela društva i aktivnih mandata',
    group: 'clanstvo',
    defaultView: true,
  },
  {
    key: 'finances',
    label: 'Financije i članarine',
    description: 'Uvid u godišnje uplate članarina, dugovanja i blagajničke zapise',
    group: 'clanstvo',
  },
  {
    key: 'meetings',
    label: 'Sjednice',
    description: 'Dnevni redovi, zapisnici, prisutnost i odluke sjednica odbora',
    group: 'clanstvo',
  },
  {
    key: 'polls',
    label: 'Glasovanja i ankete',
    description: 'Kreiranje i upravljanje elektroničkim glasovanjima i anketama',
    group: 'clanstvo',
  },
  {
    key: 'projects',
    label: 'Projekti',
    description: 'Radni zadaci, projektni timovi, doprinositelji i tijek projekata',
    group: 'projekti_istrazivanja',
  },
  {
    key: 'research_inquiries_zaprimljeno',
    label: 'Istraživanja: Zaprimljeno',
    description: 'Novi i nedodijeljeni rodoslovni upiti građana na čekanju',
    group: 'projekti_istrazivanja',
  },
  {
    key: 'research_inquiries_uradu',
    label: 'Istraživanja: U radu',
    description: 'Aktivna istraživanja, slanje provjera statusa i kronološki odgovori',
    group: 'projekti_istrazivanja',
  },
  {
    key: 'research_inquiries_zavrseno',
    label: 'Istraživanja: Završeno',
    description: 'Dovršeni i arhivirani istraživački predmeti te rezultati obrade',
    group: 'projekti_istrazivanja',
  },
  {
    key: 'lectures',
    label: 'Predavanja i druženja',
    description: 'Organizacija predavanja, tribina, najava i popratne dokumentacije',
    group: 'projekti_istrazivanja',
  },
  {
    key: 'library',
    label: 'Knjižnica',
    description: 'Katalog knjiga, časopisa, status digitalizacije i autorska prava',
    group: 'projekti_istrazivanja',
  },
  {
    key: 'gmail',
    label: 'Inbox (Gmail)',
    description: 'Čitanje i odgovaranje na službenu e-poštu društva iz Inboxa',
    group: 'komunikacija_arhiv',
  },
  {
    key: 'notifications',
    label: 'Obavijesti (E-pošta)',
    description: 'Slanje službenih obavijesti, poziva na sjednice i predavanja',
    group: 'komunikacija_arhiv',
  },
  {
    key: 'contacts',
    label: 'Adresar',
    description: 'Kontakti ustanova, arhiva, župa, suradnika i institucija',
    group: 'komunikacija_arhiv',
  },
  {
    key: 'archive',
    label: 'Arhiv',
    description: 'Inline popis svih članova (uklj. preminule) s kontaktima i evidencijom prikupljanja arhivske građe',
    group: 'komunikacija_arhiv',
  },
  {
    key: 'drive',
    label: 'Google Drive',
    description: 'Pregled i preuzimanje povezanih dokumenata iz oblaka društva',
    group: 'komunikacija_arhiv',
  },
  {
    key: 'links',
    label: 'Korisni linkovi',
    description: 'Baza provjerenih rodoslovnih poveznica i istraživačkih izvora',
    group: 'komunikacija_arhiv',
  },
  {
    key: 'reports',
    label: 'Izvješća',
    description: 'Statistike i generiranje PDF izvješća o radu za Skupštinu',
    group: 'izvjesca_nadzor',
  },
  {
    key: 'chronicle',
    label: 'Ljetopis društva',
    description: 'Uređivanje i pregled povijesnog ljetopisa i kronike događaja',
    group: 'izvjesca_nadzor',
  },
  {
    key: 'logs',
    label: 'Dnevnik rada (Logovi)',
    description: 'Pregled evidencije aktivnosti korisnika, prijava i poslanih mailova',
    group: 'izvjesca_nadzor',
  },
];

export function getEffectiveModuleRight(
  rights: Record<string, any> | undefined,
  key: AppModulePermissionKey
): { view: boolean; edit: boolean } {
  const safeRights = rights || {};
  const existing = safeRights[key];
  if (existing && typeof existing === 'object') {
    const edit = existing.edit === true;
    const view =
      key === 'functions'
        ? existing.view !== false || edit
        : existing.view === true || edit;
    return { view, edit };
  }
  return key === 'functions' ? { view: true, edit: false } : { view: false, edit: false };
}
