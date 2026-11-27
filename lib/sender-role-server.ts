import 'server-only'
import { getAppDb, DatabaseService } from '@/lib/database'
import type { SenderIdentityInput } from '@/lib/hrd-email-system'
import {
  getMemberActiveFunctions,
  isGenericSystemRoleLabel,
  normalizePersonName,
} from '@/lib/utils'

function isGenericActorName(value?: string | null): boolean {
  const norm = normalizePersonName(value)
  return (
    norm === '' ||
    norm === 'administrator' ||
    norm === 'rezervni administrator' ||
    norm === 'admin'
  )
}

function areNamesTokenEquivalent(aNorm: string, bNorm: string): boolean {
  if (!aNorm || !bNorm) return false
  if (aNorm === bNorm) return true
  const aTokens = aNorm.split(' ').filter(Boolean).sort()
  const bTokens = bNorm.split(' ').filter(Boolean).sort()
  if (aTokens.length < 2 || aTokens.length !== bTokens.length) return false
  return aTokens.every((t, i) => t === bTokens[i])
}

/**
 * Pronalazi zapis člana Društva za prijavljenog korisnika ili Administratora u SQLite bazi
 * (po ID-u, e-mailu, rezervnom admin e-mailu ili normaliziranom imenu i prezimenu).
 */
export function findMatchingMemberForActor(
  db: ReturnType<typeof getAppDb>,
  actor: {
    id?: string | number | null
    name?: string | null
    email?: string | null
    role?: string | null
  },
  settings?: any
): any | null {
  const roleLower = String(actor?.role || '').trim().toLowerCase()
  if (roleLower === 'external') return null

  const numericId = Number(actor?.id)
  if (Number.isFinite(numericId) && numericId > 0 && numericId !== 2579) {
    try {
      const byId = db
        .prepare('SELECT id, name, email, role, functions, honorary FROM members WHERE id = ? LIMIT 1')
        .get(numericId)
      if (byId) return byId
    } catch {}
  }

  const emailCandidates = [
    String(actor?.email || '').trim().toLowerCase(),
    roleLower === 'admin' && settings?.adminBackupEmail
      ? String(settings.adminBackupEmail).trim().toLowerCase()
      : '',
  ].filter((e) => Boolean(e) && e !== 'admin' && e.includes('@'))

  for (const em of emailCandidates) {
    try {
      const byEmail = db
        .prepare(
          'SELECT id, name, email, role, functions, honorary FROM members WHERE lower(trim(email)) = ? LIMIT 1'
        )
        .get(em)
      if (byEmail) return byEmail
    } catch {}
  }

  const nameCandidates = [
    actor?.name,
    roleLower === 'admin' ? settings?.adminName : '',
  ]
    .map((n) => normalizePersonName(n))
    .filter((n) => Boolean(n) && !isGenericActorName(n))

  if (nameCandidates.length > 0) {
    try {
      const allMembers = db
        .prepare('SELECT id, name, email, role, functions, honorary FROM members')
        .all() as any[]

      for (const candidate of nameCandidates) {
        const exact = allMembers.find((m) => normalizePersonName(m?.name) === candidate)
        if (exact) return exact

        const tokenMatch = allMembers.find((m) =>
          areNamesTokenEquivalent(normalizePersonName(m?.name), candidate)
        )
        if (tokenMatch) return tokenMatch
      }
    } catch {}
  }

  return null
}

/**
 * Rješava identitet i funkciju pošiljatelja na poslužitelju:
 * aktivna funkcija u Društvu (npr. Predsjednik/ca izvršnog odbora) UVIJEK ima prednost
 * ispred uloge „Administrator”. Uloga „Administrator” koristi se samo ako osoba nema
 * aktivnu funkciju u Društvu.
 */
export function resolveServerSenderIdentity(
  senderInput?: SenderIdentityInput | null,
  settingsInput?: any
): SenderIdentityInput | undefined {
  if (!senderInput) return undefined

  const userIdStr = senderInput.userId !== undefined ? String(senderInput.userId).trim() : ''
  if (userIdStr.toLowerCase() === 'system') {
    return senderInput
  }

  const settings =
    settingsInput ||
    (() => {
      try {
        return DatabaseService.getSettings()
      } catch {
        return null
      }
    })()

  const roleLower = String(senderInput.userRole || '').trim().toLowerCase()
  const rawInputName = String(senderInput.userName || '').trim()
  const adminSettingName = settings?.adminName ? String(settings.adminName).trim() : ''

  let matchedMember: any = null
  try {
    const db = getAppDb()
    matchedMember = findMatchingMemberForActor(
      db,
      {
        id: senderInput.userId,
        name: rawInputName || adminSettingName,
        email: senderInput.userEmail,
        role: senderInput.userRole,
      },
      settings
    )
  } catch {}

  const activeFns = matchedMember ? getMemberActiveFunctions(matchedMember) : []

  let resolvedFunction = ''
  if (activeFns.length > 0) {
    resolvedFunction = activeFns.join(', ')
  } else if (
    senderInput.societyRole &&
    !isGenericSystemRoleLabel(senderInput.societyRole)
  ) {
    resolvedFunction = String(senderInput.societyRole).trim()
  } else if (
    senderInput.userFunction &&
    !isGenericSystemRoleLabel(senderInput.userFunction)
  ) {
    resolvedFunction = String(senderInput.userFunction).trim()
  } else if (matchedMember && (matchedMember.honorary === 1 || matchedMember.honorary === true)) {
    resolvedFunction = 'Počasni član'
  } else if (roleLower === 'external') {
    resolvedFunction = 'Vanjski suradnik'
  } else if (roleLower === 'admin') {
    resolvedFunction = 'Administrator'
  } else if (roleLower === 'moderator') {
    resolvedFunction = 'Moderator'
  } else {
    resolvedFunction = 'Član Društva'
  }

  const resolvedName =
    rawInputName && !isGenericActorName(rawInputName)
      ? rawInputName
      : adminSettingName && !isGenericActorName(adminSettingName)
      ? adminSettingName
      : String(matchedMember?.name || rawInputName || 'Administrator')
          .replace(/\s+/g, ' ')
          .trim()

  return {
    ...senderInput,
    userName: resolvedName,
    userFunction: resolvedFunction,
    societyRole: activeFns.length > 0 ? activeFns.join(', ') : senderInput.societyRole,
  }
}
