import 'server-only'
import { getAppDb } from '@/lib/database'
import { formatDateDMY } from '@/lib/utils'

export interface DoNotContactMemberInfo {
  id: number
  name: string
  email: string
  doNotContactDate: string
  doNotContactNote: string
}

export class DoNotContactBlockedError extends Error {
  readonly statusCode = 403
  readonly blockedMembers: DoNotContactMemberInfo[]

  constructor(message: string, blockedMembers: DoNotContactMemberInfo[] = []) {
    super(message)
    this.name = 'DoNotContactBlockedError'
    this.blockedMembers = blockedMembers
  }
}

export function extractEmailAddresses(
  input: string | string[] | null | undefined
): string[] {
  if (!input) return []
  const rawItems = Array.isArray(input) ? input : [input]
  const out = new Set<string>()

  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'string') continue
    const parts = raw.split(/[,;\n\r]+/)
    for (const part of parts) {
      const trimmed = part.trim()
      if (!trimmed) continue
      const angleMatch = trimmed.match(/<([^<>@\s]+@[^<>@\s]+\.[^<>@\s]+)>/)
      const candidate = (angleMatch ? angleMatch[1] : trimmed)
        .replace(/^["'<]+|[>"']+$/g, '')
        .trim()
        .toLowerCase()
      if (candidate && candidate.includes('@')) {
        out.add(candidate)
      }
    }
  }

  return Array.from(out)
}

export function getDoNotContactMembers(): DoNotContactMemberInfo[] {
  try {
    const db = getAppDb()
    const rows = db
      .prepare(
        `SELECT
          id,
          name,
          COALESCE(email, '') AS email,
          COALESCE(do_not_contact_date, '') AS doNotContactDate,
          COALESCE(do_not_contact_note, '') AS doNotContactNote
         FROM members
         WHERE COALESCE(do_not_contact, 0) = 1`
      )
      .all() as any[]

    return (rows || []).map((r) => ({
      id: Number(r.id),
      name: String(r.name || ''),
      email: String(r.email || '').trim(),
      doNotContactDate: String(r.doNotContactDate || '').trim(),
      doNotContactNote: String(r.doNotContactNote || '').trim(),
    }))
  } catch {
    return []
  }
}

export function getDoNotContactEmailSet(): Set<string> {
  const blocked = getDoNotContactMembers()
  const set = new Set<string>()
  for (const m of blocked) {
    const email = m.email.trim().toLowerCase()
    if (email && email.includes('@')) {
      set.add(email)
    }
  }
  return set
}

export function findBlockedDoNotContactMembers(
  ...recipientFields: Array<string | string[] | null | undefined>
): DoNotContactMemberInfo[] {
  const targetEmails = new Set<string>()
  for (const field of recipientFields) {
    for (const addr of extractEmailAddresses(field)) {
      targetEmails.add(addr)
    }
  }
  if (targetEmails.size === 0) return []

  const blockedMembers = getDoNotContactMembers()
  const matched: DoNotContactMemberInfo[] = []
  const seenIds = new Set<number>()

  for (const m of blockedMembers) {
    const key = m.email.trim().toLowerCase()
    if (key && targetEmails.has(key) && !seenIds.has(m.id)) {
      seenIds.add(m.id)
      matched.push(m)
    }
  }

  return matched
}

export function formatDoNotContactError(
  blocked: DoNotContactMemberInfo[]
): string {
  if (!blocked || blocked.length === 0) {
    return 'Slanje nije dopušteno: član je na izričitu napomenu zatražio da ga se ne kontaktira.'
  }

  if (blocked.length === 1) {
    const b = blocked[0]
    const emailPart = b.email ? ` (${b.email})` : ''
    const formattedDate = b.doNotContactDate
      ? formatDateDMY(b.doNotContactDate, b.doNotContactDate)
      : ''
    const datePart = formattedDate ? ` [zahtjev od ${formattedDate}]` : ''
    const notePart = b.doNotContactNote ? ` Napomena: ${b.doNotContactNote}` : ''
    return `Slanje nije dopušteno: član ${b.name}${emailPart} je na izričitu napomenu zatražio da ga se ne kontaktira${datePart}.${notePart}`
  }

  const list = blocked
    .map((b) => (b.email ? `${b.name} (${b.email})` : b.name))
    .join(', ')
  return `Slanje nije dopušteno: sljedeći članovi su na izričitu napomenu zatražili da ih se ne kontaktira: ${list}.`
}

export function assertEmailsAllowedToContact(
  ...recipientFields: Array<string | string[] | null | undefined>
): void {
  const blocked = findBlockedDoNotContactMembers(...recipientFields)
  if (blocked.length > 0) {
    throw new DoNotContactBlockedError(formatDoNotContactError(blocked), blocked)
  }
}
