export interface NumberedMemberLike {
  id?: number
  name?: string | null
  email?: string | null
  role?: string | null
  membershipNumber?: string | null
  registryNumber?: string | null
  joinDate?: string | null
}

export interface DuplicateMemberNumberGroup {
  number: number
  formatted: string
  members: Array<{
    id: number
    name: string
    membershipNumber: string
    registryNumber: string
    joinDate?: string
  }>
}

export interface MismatchedMemberNumberEntry {
  id: number
  name: string
  membershipNumber: string
  registryNumber: string
  reason: string
}

export interface MissingMemberNumberEntry {
  id: number
  name: string
  email?: string
  joinDate?: string
}

export interface MemberNumberingAudit {
  totalMembers: number
  maxNumber: number
  nextNumber: number
  nextFormatted: string
  duplicates: DuplicateMemberNumberGroup[]
  mismatches: MismatchedMemberNumberEntry[]
  missing: MissingMemberNumberEntry[]
  gaps: Array<{ number: number; formatted: string }>
  issueMemberIds: Set<number>
  memberIssueLabels: Map<number, string[]>
  totalIssuesCount: number
  hasErrors: boolean
}

export function isAdminLike(m?: NumberedMemberLike | null): boolean {
  if (!m) return false
  const r = String(m.role || '').trim().toLowerCase()
  const e = String(m.email || '').trim().toLowerCase()
  const n = String(m.name || '').trim().toLowerCase()
  return r === 'admin' || e === 'admin' || n === 'administrator' || n === 'rezervni administrator'
}

export function isBlankMemberCode(value?: string | null): boolean {
  if (value === undefined || value === null) return true
  const trimmed = String(value).trim()
  return !trimmed || trimmed === '-' || trimmed === '—'
}

export function parseUnifiedMemberNumber(value?: string | null): number | null {
  if (isBlankMemberCode(value)) return null
  const trimmed = String(value).trim()
  if (!/^\d+$/.test(trimmed)) return null
  const num = parseInt(trimmed, 10)
  if (!Number.isInteger(num) || num < 1) return null
  return num
}

export function formatUnifiedMemberNumber(num: number): string {
  return String(Math.trunc(num)).padStart(3, '0')
}

export function getNextSequentialMemberNumber(members: NumberedMemberLike[]): {
  maxNumber: number
  nextNumber: number
  formatted: string
} {
  let maxNumber = 0
  for (const m of members) {
    if (isAdminLike(m)) continue
    const gNum = parseUnifiedMemberNumber(m.registryNumber)
    const mNum = parseUnifiedMemberNumber(m.membershipNumber)
    if (gNum !== null && gNum > maxNumber) maxNumber = gNum
    if (mNum !== null && mNum > maxNumber) maxNumber = mNum
  }
  const nextNumber = maxNumber + 1
  return {
    maxNumber,
    nextNumber,
    formatted: formatUnifiedMemberNumber(nextNumber),
  }
}

export function auditMemberNumbering(members: NumberedMemberLike[]): MemberNumberingAudit {
  const validMembers = (members || []).filter((m) => !isAdminLike(m))
  const byNumber = new Map<
    number,
    Array<{
      id: number
      name: string
      membershipNumber: string
      registryNumber: string
      joinDate?: string
    }>
  >()
  const mismatches: MismatchedMemberNumberEntry[] = []
  const missing: MissingMemberNumberEntry[] = []
  const issueMemberIds = new Set<number>()
  const memberIssueLabels = new Map<number, string[]>()

  const addIssueLabel = (memberId: number, label: string) => {
    issueMemberIds.add(memberId)
    const prev = memberIssueLabels.get(memberId) || []
    if (!prev.includes(label)) {
      prev.push(label)
      memberIssueLabels.set(memberId, prev)
    }
  }

  let maxNumber = 0

  for (const m of validMembers) {
    const id = Number(m.id || 0)
    const name = String(m.name || `Član #${id}`).trim()
    const mRaw = isBlankMemberCode(m.membershipNumber) ? '' : String(m.membershipNumber).trim()
    const gRaw = isBlankMemberCode(m.registryNumber) ? '' : String(m.registryNumber).trim()

    if (!mRaw && !gRaw) {
      missing.push({
        id,
        name,
        email: m.email ? String(m.email) : undefined,
        joinDate: m.joinDate ? String(m.joinDate) : undefined,
      })
      addIssueLabel(id, 'Nedostaje redni broj upisa i broj matice')
      continue
    }

    const mNum = parseUnifiedMemberNumber(mRaw)
    const gNum = parseUnifiedMemberNumber(gRaw)

    const recordMismatch = (reason: string) => {
      mismatches.push({
        id,
        name,
        membershipNumber: mRaw,
        registryNumber: gRaw,
        reason,
      })
      addIssueLabel(id, reason)
    }

    if ((mRaw && mNum === null) || (gRaw && gNum === null)) {
      recordMismatch('Neispravan (nenumerički) format broja')
    } else if (!mRaw) {
      recordMismatch(`Nedostaje Br. prijavnice (Br. matice: ${gRaw})`)
    } else if (!gRaw) {
      recordMismatch(`Nedostaje Br. matice (Br. prijavnice: ${mRaw})`)
    } else if (mNum !== gNum) {
      recordMismatch(`Br. prijavnice (${mRaw}) nije jednak Br. matice (${gRaw})`)
    } else if (mNum !== null && (mRaw !== formatUnifiedMemberNumber(mNum) || gRaw !== formatUnifiedMemberNumber(mNum))) {
      recordMismatch(`Format broja treba biti ${formatUnifiedMemberNumber(mNum)}`)
    }

    const memberEntry = {
      id,
      name,
      membershipNumber: mRaw,
      registryNumber: gRaw,
      joinDate: m.joinDate ? String(m.joinDate) : undefined,
    }

    const memberNums = new Set<number>()
    if (gNum !== null) memberNums.add(gNum)
    if (mNum !== null) memberNums.add(mNum)

    for (const num of memberNums) {
      if (num > maxNumber) maxNumber = num
      const list = byNumber.get(num) || []
      list.push(memberEntry)
      byNumber.set(num, list)
    }
  }

  const duplicates: DuplicateMemberNumberGroup[] = []
  for (const [num, list] of byNumber.entries()) {
    if (list.length > 1) {
      const formatted = formatUnifiedMemberNumber(num)
      duplicates.push({
        number: num,
        formatted,
        members: list.slice().sort((a, b) => a.name.localeCompare(b.name, 'hr-HR')),
      })
      for (const item of list) {
        addIssueLabel(item.id, `Duplikat broja ${formatted}`)
      }
    }
  }
  duplicates.sort((a, b) => a.number - b.number)

  const gaps: Array<{ number: number; formatted: string }> = []
  for (let n = 1; n <= maxNumber; n++) {
    if (!byNumber.has(n)) {
      gaps.push({ number: n, formatted: formatUnifiedMemberNumber(n) })
    }
  }

  missing.sort((a, b) => a.name.localeCompare(b.name, 'hr-HR'))
  mismatches.sort((a, b) => a.name.localeCompare(b.name, 'hr-HR'))

  const nextNumber = maxNumber + 1
  const totalIssuesCount = duplicates.length + mismatches.length + missing.length + gaps.length

  return {
    totalMembers: validMembers.length,
    maxNumber,
    nextNumber,
    nextFormatted: formatUnifiedMemberNumber(nextNumber),
    duplicates,
    mismatches,
    missing,
    gaps,
    issueMemberIds,
    memberIssueLabels,
    totalIssuesCount,
    hasErrors: totalIssuesCount > 0,
  }
}

export type MemberNumberValidationCode =
  | 'UNIFIED_NUMBER_MISMATCH'
  | 'INVALID_MEMBER_NUMBER'
  | 'EMPTY_MEMBER_NUMBER'
  | 'DUPLICATE_MEMBER_NUMBER'
  | 'SEQUENCE_GAP_NOT_ALLOWED'
  | 'SEQUENCE_ORDER_REQUIRED'

export function validateMemberNumberChange(params: {
  mode: 'add' | 'update'
  membershipNumber?: string | null
  registryNumber?: string | null
  existingMembers: NumberedMemberLike[]
  currentMemberId?: number
  currentMember?: NumberedMemberLike | null
}): {
  ok: boolean
  normalized?: string
  error?: string
  code?: MemberNumberValidationCode
} {
  const { mode, membershipNumber, registryNumber, existingMembers, currentMemberId, currentMember } = params

  const hasMemProp = membershipNumber !== undefined
  const hasRegProp = registryNumber !== undefined

  if (mode === 'update' && !hasMemProp && !hasRegProp) {
    return { ok: true }
  }

  const otherMembers = (existingMembers || []).filter(
    (m) => !isAdminLike(m) && (currentMemberId === undefined || Number(m.id) !== Number(currentMemberId))
  )

  const { maxNumber: maxOther, nextNumber: nextExpected, formatted: nextExpectedFormatted } =
    getNextSequentialMemberNumber(otherMembers)

  const mTrimmed = isBlankMemberCode(membershipNumber) ? '' : String(membershipNumber).trim()
  const gTrimmed = isBlankMemberCode(registryNumber) ? '' : String(registryNumber).trim()

  if (mode === 'add') {
    if (!mTrimmed && !gTrimmed) {
      return { ok: true, normalized: nextExpectedFormatted }
    }

    const mNum = mTrimmed ? parseUnifiedMemberNumber(mTrimmed) : null
    const gNum = gTrimmed ? parseUnifiedMemberNumber(gTrimmed) : null

    if (mTrimmed && mNum === null) {
      return {
        ok: false,
        code: 'INVALID_MEMBER_NUMBER',
        error: `Redni broj upisa (Br. prijavnice) mora biti pozitivan cijeli broj (npr. ${nextExpectedFormatted}).`,
      }
    }
    if (gTrimmed && gNum === null) {
      return {
        ok: false,
        code: 'INVALID_MEMBER_NUMBER',
        error: `Broj u matici (Br. matice) mora biti pozitivan cijeli broj (npr. ${nextExpectedFormatted}).`,
      }
    }

    if (mNum !== null && gNum !== null && mNum !== gNum) {
      return {
        ok: false,
        code: 'UNIFIED_NUMBER_MISMATCH',
        error: 'Redni broj upisa (Br. prijavnice) i broj u matici (Br. matice) moraju biti identični (unificirani broj).',
      }
    }

    const targetNum = (gNum ?? mNum)!
    const targetFormatted = formatUnifiedMemberNumber(targetNum)

    const holder = otherMembers.find(
      (m) =>
        parseUnifiedMemberNumber(m.registryNumber) === targetNum ||
        parseUnifiedMemberNumber(m.membershipNumber) === targetNum
    )
    if (holder) {
      return {
        ok: false,
        code: 'DUPLICATE_MEMBER_NUMBER',
        error: `Broj ${targetFormatted} već je dodijeljen članu ${holder.name || `#${holder.id}`}. Duplikati rednog broja upisa i broja matice nisu dopušteni.`,
      }
    }

    if (targetNum > nextExpected) {
      return {
        ok: false,
        code: 'SEQUENCE_GAP_NOT_ALLOWED',
        error: `Nije dopušteno preskakanje brojeva u sljednosti. Najveći postojeći broj je ${formatUnifiedMemberNumber(maxOther)}, stoga sljedeći redni broj za novi upis mora biti ${nextExpectedFormatted}.`,
      }
    }
    if (targetNum < nextExpected) {
      return {
        ok: false,
        code: 'SEQUENCE_ORDER_REQUIRED',
        error: `Za nove upise obvezna je sljednost iza zadnjeg upisanog člana. Sljedeći redni broj mora biti ${nextExpectedFormatted}.`,
      }
    }

    return { ok: true, normalized: targetFormatted }
  }

  // mode === 'update'
  const curMemRaw = isBlankMemberCode(currentMember?.membershipNumber)
    ? ''
    : String(currentMember?.membershipNumber).trim()
  const curRegRaw = isBlankMemberCode(currentMember?.registryNumber)
    ? ''
    : String(currentMember?.registryNumber).trim()

  const effectiveMemRaw = hasMemProp ? mTrimmed : curMemRaw
  const effectiveRegRaw = hasRegProp ? gTrimmed : curRegRaw

  // Ne blokiraj spremanje nepovezanih polja (npr. telefon, bilješke, uplate) ako korisnik nije mijenjao brojeve
  if (effectiveMemRaw === curMemRaw && effectiveRegRaw === curRegRaw) {
    return { ok: true }
  }

  if (!effectiveMemRaw && !effectiveRegRaw) {
    if (curMemRaw || curRegRaw) {
      return {
        ok: false,
        code: 'EMPTY_MEMBER_NUMBER',
        error: 'Redni broj upisa i broj matice ne mogu se obrisati nakon što su dodijeljeni članu.',
      }
    }
    return { ok: true }
  }

  // Ako je jedno polje namjerno obrisano dok je drugo ostalo nepromijenjeno, uzmi promijenjeno polje ako je jedino promijenjeno, inače zabrani
  const memChanged = hasMemProp && mTrimmed !== curMemRaw
  const regChanged = hasRegProp && gTrimmed !== curRegRaw

  const mNum = effectiveMemRaw ? parseUnifiedMemberNumber(effectiveMemRaw) : null
  const gNum = effectiveRegRaw ? parseUnifiedMemberNumber(effectiveRegRaw) : null

  if (effectiveMemRaw && mNum === null) {
    return {
      ok: false,
      code: 'INVALID_MEMBER_NUMBER',
      error: `Redni broj upisa (Br. prijavnice) mora biti pozitivan cijeli broj (npr. ${nextExpectedFormatted}).`,
    }
  }
  if (effectiveRegRaw && gNum === null) {
    return {
      ok: false,
      code: 'INVALID_MEMBER_NUMBER',
      error: `Broj u matici (Br. matice) mora biti pozitivan cijeli broj (npr. ${nextExpectedFormatted}).`,
    }
  }

  if (memChanged && regChanged && mNum !== gNum) {
    return {
      ok: false,
      code: 'UNIFIED_NUMBER_MISMATCH',
      error: 'Redni broj upisa (Br. prijavnice) i broj u matici (Br. matice) moraju biti identični (unificirani broj).',
    }
  }

  if (memChanged && !regChanged && !effectiveMemRaw) {
    return {
      ok: false,
      code: 'EMPTY_MEMBER_NUMBER',
      error: 'Redni broj upisa i broj matice moraju biti ispunjeni i identični.',
    }
  }
  if (regChanged && !memChanged && !effectiveRegRaw) {
    return {
      ok: false,
      code: 'EMPTY_MEMBER_NUMBER',
      error: 'Redni broj upisa i broj matice moraju biti ispunjeni i identični.',
    }
  }

  if (!memChanged || !regChanged) {
    // Jedno polje je promijenjeno, drugo nije (npr. API update s jednim poljem) -> preuzmi novo ako su oba prisutna ili ako se razlikuju samo od starog
    if (memChanged && mNum !== null && gNum !== null && mNum !== gNum) {
      // Ako je korisnik u sučelju promijenio samo jedno polje, a poslao oba stara/nova
      const targetNum = mNum
      const targetFormatted = formatUnifiedMemberNumber(targetNum)
      return validateSingleTargetUpdate(targetNum, targetFormatted, otherMembers, maxOther, nextExpected, nextExpectedFormatted)
    }
    if (regChanged && gNum !== null && mNum !== null && mNum !== gNum) {
      const targetNum = gNum
      const targetFormatted = formatUnifiedMemberNumber(targetNum)
      return validateSingleTargetUpdate(targetNum, targetFormatted, otherMembers, maxOther, nextExpected, nextExpectedFormatted)
    }
  }

  if (mNum !== null && gNum !== null && mNum !== gNum) {
    return {
      ok: false,
      code: 'UNIFIED_NUMBER_MISMATCH',
      error: 'Redni broj upisa (Br. prijavnice) i broj u matici (Br. matice) moraju biti identični (unificirani broj).',
    }
  }

  const targetNum = (regChanged ? gNum : memChanged ? mNum : gNum ?? mNum)!
  const targetFormatted = formatUnifiedMemberNumber(targetNum)
  return validateSingleTargetUpdate(targetNum, targetFormatted, otherMembers, maxOther, nextExpected, nextExpectedFormatted)
}

function validateSingleTargetUpdate(
  targetNum: number,
  targetFormatted: string,
  otherMembers: NumberedMemberLike[],
  maxOther: number,
  nextExpected: number,
  nextExpectedFormatted: string
): {
  ok: boolean
  normalized?: string
  error?: string
  code?: MemberNumberValidationCode
} {
  const holder = otherMembers.find(
    (m) =>
      parseUnifiedMemberNumber(m.registryNumber) === targetNum ||
      parseUnifiedMemberNumber(m.membershipNumber) === targetNum
  )
  if (holder) {
    return {
      ok: false,
      code: 'DUPLICATE_MEMBER_NUMBER',
      error: `Broj ${targetFormatted} već je dodijeljen članu ${holder.name || `#${holder.id}`}. Duplikati rednog broja upisa i broja matice nisu dopušteni.`,
    }
  }

  if (targetNum > nextExpected) {
    return {
      ok: false,
      code: 'SEQUENCE_GAP_NOT_ALLOWED',
      error: `Nije dopušteno preskakanje brojeva u sljednosti (najveći drugi broj je ${formatUnifiedMemberNumber(maxOther)}). Možete upisati postojeći slobodni broj (rupu) ili sljedeći u nizu (${nextExpectedFormatted}).`,
    }
  }

  return { ok: true, normalized: targetFormatted }
}
