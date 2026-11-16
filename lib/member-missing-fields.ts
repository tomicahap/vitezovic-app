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
