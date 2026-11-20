export interface ArchiveContactResultOption {
  value: string
  label: string
  tone: 'none' | 'success' | 'emerald' | 'amber' | 'blue' | 'slate' | 'red'
}

export const ARCHIVE_CONTACT_RESULTS: ArchiveContactResultOption[] = [
  { value: '', label: '— Odaberi rezultat —', tone: 'none' },
  { value: 'grada_dogovorena', label: 'Građa dogovorena', tone: 'amber' },
  { value: 'grada_preuzeta', label: 'Građa preuzeta', tone: 'emerald' },
  { value: 'dogovor_u_tijeku', label: 'Dogovor u tijeku', tone: 'blue' },
  { value: 'kontaktirana_obitelj', label: 'Kontaktirana obitelj / nasljednici', tone: 'blue' },
  { value: 'nema_grade', label: 'Nema arhivske građe', tone: 'slate' },
  { value: 'nedostupan', label: 'Nedostupan / bez odgovora', tone: 'slate' },
  { value: 'odbijeno', label: 'Odbijeno / ne želi predati', tone: 'red' },
  { value: 'ostalo', label: 'Ostalo (vidi napomenu)', tone: 'slate' },
]

export function getArchiveResultLabel(value?: string | null): string {
  const clean = String(value || '').trim()
  if (!clean) return '—'
  return ARCHIVE_CONTACT_RESULTS.find((o) => o.value === clean)?.label || clean
}

export interface ArchiveMemberItem {
  memberId: number
  name: string
  email: string
  phone: string
  landlinePhone: string
  address: string
  deceased: boolean
  deathDate: string
  contacted: boolean
  contactedAt: string
  contactResult: string
  note: string
  updatedByName: string
  updatedAt: string
}
