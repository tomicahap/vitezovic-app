export interface DuplicateCandidateInput {
  id?: number
  name?: string | null
  email?: string | null
  oib?: string | null
  registryNumber?: string | null
  membershipNumber?: string | null
}

export interface DuplicateMatch<T extends DuplicateCandidateInput = any> {
  member: T
  reasons: string[]
}

export function normalizePersonName(name?: string | null): string {
  if (!name) return ''
  return String(name)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getSortedNameKey(name?: string | null): string {
  const norm = normalizePersonName(name)
  if (!norm) return ''
  const tokens = norm.split(' ').filter(Boolean)
  if (tokens.length === 0) return ''
  return tokens.slice().sort().join(' ')
}

export function normalizeMemberCode(value?: string | null): string {
  if (!value) return ''
  const trimmed = String(value).trim().toLowerCase()
  if (!trimmed || trimmed === '-' || trimmed === '—') return ''
  if (/^\d+$/.test(trimmed)) {
    return String(parseInt(trimmed, 10))
  }
  return trimmed
}

export function findPotentialDuplicateMembers<T extends DuplicateCandidateInput>(
  candidate: DuplicateCandidateInput,
  existingMembers: T[],
  excludeId?: number
): DuplicateMatch<T>[] {
  const candNormName = normalizePersonName(candidate.name)
  const candSortedName = getSortedNameKey(candidate.name)
  const candEmail = String(candidate.email || '').trim().toLowerCase()
  const candOib = String(candidate.oib || '').trim()
  const candReg = normalizeMemberCode(candidate.registryNumber)
  const candMem = normalizeMemberCode(candidate.membershipNumber)

  const matches: DuplicateMatch<T>[] = []

  for (const m of existingMembers) {
    if (excludeId !== undefined && Number(m.id) === Number(excludeId)) continue

    const reasons: string[] = []

    const mNormName = normalizePersonName(m.name)
    const mSortedName = getSortedNameKey(m.name)
    if (candNormName.length >= 3 && mNormName.length >= 3) {
      if (candNormName === mNormName) {
        reasons.push('Isto ime i prezime')
      } else if (candSortedName && candSortedName === mSortedName) {
        reasons.push('Isto ime i prezime (drugi redoslijed riječi)')
      }
    }

    const mEmail = String(m.email || '').trim().toLowerCase()
    if (candEmail && mEmail && candEmail === mEmail) {
      reasons.push('Ista e-mail adresa')
    }

    const mOib = String(m.oib || '').trim()
    if (candOib && mOib && candOib === mOib) {
      reasons.push('Isti OIB')
    }

    const mReg = normalizeMemberCode(m.registryNumber)
    if (candReg && mReg && candReg === mReg) {
      reasons.push(`Isti broj matice (${m.registryNumber})`)
    }

    const mMem = normalizeMemberCode(m.membershipNumber)
    if (candMem && mMem && candMem === mMem) {
      reasons.push(`Isti broj prijavnice (${m.membershipNumber})`)
    }

    if (reasons.length > 0) {
      matches.push({ member: m, reasons })
    }
  }

  return matches
}

export function findDuplicateMemberIds<T extends DuplicateCandidateInput>(members: T[]): Set<number> {
  const dupIds = new Set<number>()
  const byName = new Map<string, number[]>()
  const byReg = new Map<string, number[]>()
  const byOib = new Map<string, number[]>()
  const byEmail = new Map<string, number[]>()

  const pushMap = (map: Map<string, number[]>, key: string, id?: number) => {
    if (!key || id === undefined) return
    const list = map.get(key) || []
    list.push(id)
    map.set(key, list)
  }

  for (const m of members) {
    if (m.id === undefined) continue
    const nameKey = getSortedNameKey(m.name)
    if (nameKey.length >= 3) pushMap(byName, nameKey, Number(m.id))
    const regKey = normalizeMemberCode(m.registryNumber)
    if (regKey) pushMap(byReg, regKey, Number(m.id))
    const oibKey = String(m.oib || '').trim()
    if (oibKey) pushMap(byOib, oibKey, Number(m.id))
    const emailKey = String(m.email || '').trim().toLowerCase()
    if (emailKey && !emailKey.startsWith('no-email-')) pushMap(byEmail, emailKey, Number(m.id))
  }

  for (const map of [byName, byReg, byOib, byEmail]) {
    for (const ids of map.values()) {
      if (ids.length > 1) {
        for (const id of ids) dupIds.add(id)
      }
    }
  }

  return dupIds
}
