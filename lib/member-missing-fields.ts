export interface MemberFieldCheckDef {
  key: string
  label: string
  defaultChecked: boolean
}

export const MEMBER_CHECKABLE_FIELDS: MemberFieldCheckDef[] = [
  { key: 'maidenName', label: 'Djevojačko prezime (ako je primjenjivo)', defaultChecked: false },
  { key: 'oib', label: 'OIB', defaultChecked: true },
  { key: 'birthDate', label: 'Datum rođenja', defaultChecked: true },
  { key: 'birthPlace', label: 'Mjesto rođenja', defaultChecked: true },
  { key: 'birthCountry', label: 'Zemlja rođenja', defaultChecked: true },
  { key: 'phone', label: 'Mobitel', defaultChecked: true },
  { key: 'landlinePhone', label: 'Telefon (fiksni)', defaultChecked: false },
  { key: 'address', label: 'Adresa prebivališta', defaultChecked: true },
  { key: 'occupation', label: 'Zvanje i zanimanje', defaultChecked: true },
  { key: 'workExperience', label: 'Radno iskustvo', defaultChecked: true },
  { key: 'hobbiesSkills', label: 'Hobi / vještine i znanja', defaultChecked: true },
  { key: 'foreignLanguages', label: 'Strani jezici', defaultChecked: true },
  { key: 'researchAreas', label: 'Lokacije i prezimena koja istražuje', defaultChecked: true },
  { key: 'joinDate', label: 'Datum upisa u društvo', defaultChecked: true },
]

export const DEFAULT_MISSING_FIELD_KEYS = MEMBER_CHECKABLE_FIELDS
  .filter((f) => f.defaultChecked)
  .map((f) => f.key)

export function isMemberFieldMissing(member: any, key: string): boolean {
  if (!member) return true
  if (key === 'researchAreas') {
    const arr = Array.isArray(member.researchAreas)
      ? member.researchAreas
      : typeof member.researchAreas === 'string'
      ? member.researchAreas.split(/[;,]/).map((s: string) => s.trim()).filter(Boolean)
      : []
    return arr.length === 0
  }
  const val = member[key]
  if (val === null || val === undefined) return true
  return String(val).trim().length === 0
}

export function getMissingMemberFields(
  member: any,
  selectedKeys?: string[]
): Array<{ key: string; label: string }> {
  const activeSet =
    Array.isArray(selectedKeys) && selectedKeys.length > 0
      ? new Set(selectedKeys)
      : new Set(DEFAULT_MISSING_FIELD_KEYS)

  return MEMBER_CHECKABLE_FIELDS.filter(
    (def) => activeSet.has(def.key) && isMemberFieldMissing(member, def.key)
  ).map((def) => ({ key: def.key, label: def.label }))
}

export function formatMissingFieldsBullets(missing: Array<{ key: string; label: string }>): string {
  if (missing.length === 0) {
    return '- (Svi traženi podaci su već evidentirani; molimo provjerite priloženi PDF za eventualne ispravke.)'
  }
  return missing.map((f) => `- ${f.label}`).join('\n')
}

export const DEFAULT_MISSING_DATA_EMAIL_BODY =
  'Poštovani/a {{name}},\n\nU tijeku je ažuriranje službene matične knjige Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović”. U privitku ove poruke šaljemo Vam Vaš trenutni evidencijski list u PDF formatu kako biste imali uvid u podatke koje trenutno imamo zabilježene.\n\nZa potpunu evidenciju u našem kartonu trenutno nam nedostaju sljedeći podaci:\n{{missingFields}}\n\nPodatke možete najbrže dopuniti i provjeriti klikom na Vašu osobnu jednokratnu poveznicu:\n{{formLink}}\n\nVAŽNA NAPOMENA: Poveznica za dopunu podataka ograničena je na samo jedan (1) pristup. Svaki sljedeći pristup putem iste poveznice nije legalan niti dopušten, a nakon predaje podataka poveznica se trajno poništava. Molimo pripremite potrebne podatke prije otvaranja poveznice.\n\nAlternativno, možete nam odgovoriti i na ovu poruku. Unaprijed zahvaljujemo na suradnji!'

export const SINGLE_USE_LINK_EMAIL_NOTICE_PLAIN =
  'VAŽNA NAPOMENA (jednokratni pristup): Vaša osobna poveznica za dopunu podataka ograničena je na samo jedan (1) pristup. Svaki sljedeći pristup putem iste poveznice nije legalan niti dopušten, a nakon otvaranja i predaje podataka poveznica se trajno poništava te naknadne izmjene putem iste poveznice više nisu moguće. Molimo pripremite potrebne podatke prije otvaranja obrasca.'

export const SINGLE_USE_LINK_EMAIL_NOTICE_HTML =
  '<div style="margin-top: 10px; padding: 10px 12px; background-color: #FEF2F2; border-left: 3px solid #B91C1C; color: #7F1D1D; font-size: 13px; line-height: 1.5;"><strong>VAŽNA NAPOMENA — JEDNOKRATNI PRISTUP:</strong> Vaša osobna poveznica za dopunu podataka ograničena je na <strong>samo jedan (1) pristup</strong>. Svaki sljedeći pristup putem iste poveznice nije legalan niti dopušten, a nakon otvaranja i predaje podataka poveznica se trajno poništava i naknadne izmjene putem ove poveznice više nisu moguće. Molimo pripremite podatke prije otvaranja poveznice.</div>'

export function ensureSingleUseNoticeInBody(text: string): string {
  const normalized = String(text || '').trim()
  const lower = normalized.toLowerCase()
  if (lower.includes('jednokrat') && (lower.includes('jedan') || lower.includes('1 pristup'))) {
    return normalized
  }
  return normalized
    ? `${normalized}\n\n${SINGLE_USE_LINK_EMAIL_NOTICE_PLAIN}`
    : SINGLE_USE_LINK_EMAIL_NOTICE_PLAIN
}
