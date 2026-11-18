import 'server-only'
import type { NextRequest } from 'next/server'
import { getAppDb, DatabaseService } from './database'
import { db as mailcrawlDb } from './mailcrawl/db'
import { getGoogleWorkspaceClients } from './google-auth'
import { computeMemberStates, type StatusSettings } from './member-status'

export interface TrashActor {
  id: string
  name: string
  role: string
  email?: string
}

export type TrashEntityType =
  | 'member'
  | 'lecture'
  | 'meeting'
  | 'poll'
  | 'project'
  | 'research_inquiry'
  | 'library_book'
  | 'library_journal'
  | 'external_library'
  | 'library_contact_log'
  | 'contact'
  | 'useful_link'
  | 'vault_item'
  | 'mailcrawl_lead'
  | 'drive_file'
  | 'gmail_message'
  | 'gmail_template'
  | 'member_payment'
  | 'member_function'
  | 'project_record'
  | 'project_contributor'
  | 'attachment'
  | 'meeting_agenda_item'
  | 'personal_todo'
  | 'activity_logs_batch'

export interface TrashItem {
  id: number
  entity_type: TrashEntityType
  entity_table: string
  original_id: string
  parent_id: string | null
  title: string
  subtitle: string | null
  data_json: string
  related_json: string | null
  deleted_by_id: string | null
  deleted_by_name: string
  deleted_by_role: string | null
  deleted_by_email: string | null
  deleted_at: string
  status: 'trashed' | 'restored'
  restored_at: string | null
  restored_by_id: string | null
  restored_by_name: string | null
}

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  member: 'Član društva',
  lecture: 'Predavanje / događaj',
  meeting: 'Sjednica',
  poll: 'Glasovanje / anketa',
  project: 'Projekt',
  research_inquiry: 'Upit i istraživanje',
  library_book: 'Knjiga (Knjižnica)',
  library_journal: 'Časopis (Knjižnica)',
  external_library: 'Vanjska knjižnica / ustanova',
  library_contact_log: 'Kontakt s ustanovom',
  contact: 'Kontakt (Adresar)',
  useful_link: 'Koristan link',
  vault_item: 'Trezor lozinki',
  mailcrawl_lead: 'Donacijski kontakt (Mailcrawl)',
  drive_file: 'Google Drive datoteka/mapa',
  gmail_message: 'Inbox e-mail poruka',
  gmail_template: 'Gmail predložak / skica',
  member_payment: 'Uplata članarine',
  member_function: 'Funkcija člana u društvu',
  project_record: 'Bilješka / zapis projekta',
  project_contributor: 'Doprinositelj projekta',
  attachment: 'Prilog / dokument',
  meeting_agenda_item: 'Točka dnevnog reda',
  personal_todo: 'Osobni zadatak (To-Do)',
  activity_logs_batch: 'Arhiva dnevnika aktivnosti',
}

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  const result: Record<string, string> = {}
  if (!cookieHeader) return result
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=')
    if (idx <= 0) continue
    const key = part.slice(0, idx).trim()
    const val = part.slice(idx + 1).trim()
    try {
      result[key] = decodeURIComponent(val)
    } catch {
      result[key] = val
    }
  }
  return result
}

function getCookieValue(request: NextRequest | Request, name: string): string {
  const nextReq = request as NextRequest
  if (nextReq.cookies && typeof nextReq.cookies.get === 'function') {
    const c = nextReq.cookies.get(name)?.value
    if (c) {
      try {
        return decodeURIComponent(c)
      } catch {
        return c
      }
    }
  }
  const parsed = parseCookieHeader(request.headers.get('cookie'))
  return parsed[name] || ''
}

export function extractActor(request: NextRequest | Request, body?: any): TrashActor {
  const explicit = body?.deletedBy || body?.actor || body?.user || body?.sender || null

  const headerId = request.headers.get('x-user-id') || ''
  const headerName = request.headers.get('x-user-name') || ''
  const headerRole = request.headers.get('x-user-role') || ''
  const headerEmail = request.headers.get('x-user-email') || ''

  const cookieId = getCookieValue(request, 'hrd_uid')
  const cookieName = getCookieValue(request, 'hrd_uname')
  const cookieRole = getCookieValue(request, 'hrd_urole')
  const cookieEmail = getCookieValue(request, 'hrd_uemail')

  const authHeader = request.headers.get('Authorization') || ''
  const authRole = authHeader.startsWith('Bearer ')
    ? authHeader.replace('Bearer ', '').trim()
    : ''

  const rawId =
    explicit?.id ??
    explicit?.userId ??
    (headerId || cookieId || 'unknown')

  const rawRole =
    explicit?.role ??
    explicit?.userRole ??
    (headerRole || cookieRole || authRole || 'unknown')

  let rawName =
    explicit?.name ??
    explicit?.userName ??
    (headerName || cookieName || '')

  if (!rawName) {
    if (String(rawRole).toLowerCase() === 'admin') {
      rawName = 'Administrator'
    } else {
      rawName = 'Nepoznati korisnik'
    }
  }

  const rawEmail =
    explicit?.email ??
    explicit?.userEmail ??
    (headerEmail || cookieEmail || '')

  return {
    id: String(rawId),
    name: String(rawName).trim() || 'Nepoznati korisnik',
    role: String(rawRole).trim() || 'unknown',
    email: String(rawEmail).trim(),
  }
}

function safeJsonParse<T>(raw: any, fallback: T): T {
  if (raw === null || raw === undefined) return fallback
  if (typeof raw !== 'string') return raw as T
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'string') return safeJsonParse(parsed, fallback)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function getValidTableColumns(sqliteDb: any, tableName: string): Set<string> {
  const cols = sqliteDb.pragma(`table_info(${tableName})`) as Array<{ name: string }>
  return new Set((cols || []).map((c) => c.name))
}

function insertRowByColumns(sqliteDb: any, tableName: string, rowData: Record<string, any>): void {
  const validCols = getValidTableColumns(sqliteDb, tableName)
  const filtered: Record<string, any> = {}
  for (const [k, v] of Object.entries(rowData)) {
    if (validCols.has(k) && v !== undefined) {
      filtered[k] = v
    }
  }
  const cols = Object.keys(filtered)
  if (cols.length === 0) return
  const placeholders = cols.map((c) => `@${c}`).join(', ')
  sqliteDb.prepare(`INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`).run(filtered)
}

function recordAuditLog(actor: TrashActor, action: string, details: string) {
  try {
    DatabaseService.insertLog({
      userId: actor.id || 'system',
      userName: actor.name || 'Sustav',
      userRole: actor.role || 'admin',
      action,
      details,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('[TrashService] Failed to write activity log:', err)
  }
}

function insertTrashEntry(params: {
  entityType: TrashEntityType
  entityTable: string
  originalId: string | number
  parentId?: string | number | null
  title: string
  subtitle?: string | null
  data: any
  related?: any
  actor: TrashActor
}): number {
  const db = getAppDb()
  const now = new Date().toISOString()
  const res = db
    .prepare(
      `INSERT INTO trash_items (
        entity_type, entity_table, original_id, parent_id, title, subtitle,
        data_json, related_json, deleted_by_id, deleted_by_name, deleted_by_role, deleted_by_email,
        deleted_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'trashed')`
    )
    .run(
      params.entityType,
      params.entityTable,
      String(params.originalId),
      params.parentId !== undefined && params.parentId !== null ? String(params.parentId) : null,
      params.title,
      params.subtitle || null,
      JSON.stringify(params.data),
      params.related ? JSON.stringify(params.related) : null,
      params.actor.id || null,
      params.actor.name || 'Nepoznati korisnik',
      params.actor.role || null,
      params.actor.email || null,
      now
    )

  const label = ENTITY_TYPE_LABELS[params.entityType] || params.entityType
  recordAuditLog(
    params.actor,
    'Premješteno u smeće',
    `[${label}] "${params.title}" premješteno u smeće (obrisao: ${params.actor.name})`
  )

  return Number(res.lastInsertRowid)
}

function getStatusSettings(): StatusSettings {
  const s = DatabaseService.getSettings()
  return {
    overdueAfterDays: s?.overdueAfterDays ?? 365,
    expiredAfterDays: s?.inactiveAfterDays ?? 730,
    requirePaymentToBeActive: s?.requirePaymentToBeActive === 1,
  }
}

export class TrashService {
  static getAll(filters?: { status?: string; entityType?: string; search?: string }): TrashItem[] {
    const db = getAppDb()
    const conditions: string[] = []
    const params: any[] = []

    if (filters?.status && filters.status !== 'all') {
      conditions.push('status = ?')
      params.push(filters.status)
    }
    if (filters?.entityType && filters.entityType !== 'all') {
      conditions.push('entity_type = ?')
      params.push(filters.entityType)
    }
    if (filters?.search && filters.search.trim()) {
      const q = `%${filters.search.trim()}%`
      conditions.push('(title LIKE ? OR subtitle LIKE ? OR deleted_by_name LIKE ? OR data_json LIKE ?)')
      params.push(q, q, q, q)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    return db
      .prepare(`SELECT * FROM trash_items ${where} ORDER BY deleted_at DESC, id DESC`)
      .all(...params) as TrashItem[]
  }

  static getCounts(): { trashed: number; restored: number; byType: Record<string, number> } {
    const db = getAppDb()
    const trashedRow = db
      .prepare("SELECT COUNT(*) as c FROM trash_items WHERE status = 'trashed'")
      .get() as { c: number }
    const restoredRow = db
      .prepare("SELECT COUNT(*) as c FROM trash_items WHERE status = 'restored'")
      .get() as { c: number }
    const typeRows = db
      .prepare("SELECT entity_type, COUNT(*) as c FROM trash_items WHERE status = 'trashed' GROUP BY entity_type")
      .all() as Array<{ entity_type: string; c: number }>

    const byType: Record<string, number> = {}
    for (const r of typeRows) {
      byType[r.entity_type] = r.c
    }

    return {
      trashed: trashedRow?.c || 0,
      restored: restoredRow?.c || 0,
      byType,
    }
  }

  // ── Table row trash methods ──────────────────────────────────────────────

  static trashMember(id: number, actor: TrashActor): { trashedId: number | null; notFound?: boolean } {
    const db = getAppDb()
    const row = db.prepare('SELECT * FROM members WHERE id = ?').get(id) as any
    if (!row) return { trashedId: null, notFound: true }

    const tx = db.transaction(() => {
      const related = {
        payments: db.prepare('SELECT * FROM payments WHERE memberId = ?').all(id),
        attendance: db.prepare('SELECT * FROM attendance WHERE member_id = ?').all(id),
        meeting_participants: db.prepare('SELECT * FROM meeting_participants WHERE member_id = ?').all(id),
        vote_results: db.prepare('SELECT * FROM vote_results WHERE member_id = ?').all(id),
      }
      const trashedId = insertTrashEntry({
        entityType: 'member',
        entityTable: 'members',
        originalId: id,
        title: row.name || `Član #${id}`,
        subtitle: [row.email, row.registryNumber ? `Matica: ${row.registryNumber}` : '']
          .filter(Boolean)
          .join(' • '),
        data: row,
        related,
        actor,
      })
      db.prepare('DELETE FROM members WHERE id = ?').run(id)
      return trashedId
    })

    return { trashedId: tx() }
  }

  static trashLecture(id: number, actor: TrashActor): { trashedId: number | null; notFound?: boolean } {
    const db = getAppDb()
    const row = db.prepare('SELECT * FROM lectures WHERE id = ?').get(id) as any
    if (!row) return { trashedId: null, notFound: true }

    const tx = db.transaction(() => {
      const trashedId = insertTrashEntry({
        entityType: 'lecture',
        entityTable: 'lectures',
        originalId: id,
        title: row.title || `Predavanje #${id}`,
        subtitle: [row.date, row.location || row.city, row.host].filter(Boolean).join(' • '),
        data: row,
        actor,
      })
      db.prepare('DELETE FROM lectures WHERE id = ?').run(id)
      return trashedId
    })

    return { trashedId: tx() }
  }

  static trashMeeting(id: number, actor: TrashActor): { trashedId: number | null; notFound?: boolean } {
    const db = getAppDb()
    const row = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as any
    if (!row) return { trashedId: null, notFound: true }

    const tx = db.transaction(() => {
      const related = {
        attendance: db.prepare('SELECT * FROM attendance WHERE meeting_id = ?').all(id),
        meeting_participants: db.prepare('SELECT * FROM meeting_participants WHERE meeting_id = ?').all(id),
        linked_vote_ids: (db.prepare('SELECT id FROM votes WHERE meeting_id = ?').all(id) as Array<{ id: number }>).map(
          (v) => v.id
        ),
      }
      const trashedId = insertTrashEntry({
        entityType: 'meeting',
        entityTable: 'meetings',
        originalId: id,
        title: row.title || `Sjednica #${id}`,
        subtitle: [row.date, row.type, row.location].filter(Boolean).join(' • '),
        data: row,
        related,
        actor,
      })
      db.prepare('DELETE FROM meetings WHERE id = ?').run(id)
      return trashedId
    })

    return { trashedId: tx() }
  }

  static trashPoll(id: number, actor: TrashActor): { trashedId: number | null; notFound?: boolean } {
    const db = getAppDb()
    const row = db.prepare('SELECT * FROM votes WHERE id = ?').get(id) as any
    if (!row) return { trashedId: null, notFound: true }

    const tx = db.transaction(() => {
      const related = {
        vote_results: db.prepare('SELECT * FROM vote_results WHERE vote_id = ?').all(id),
      }
      const trashedId = insertTrashEntry({
        entityType: 'poll',
        entityTable: 'votes',
        originalId: id,
        parentId: row.meeting_id || null,
        title: row.title || `Glasovanje #${id}`,
        subtitle: row.description || `Status: ${row.status || 'active'}`,
        data: row,
        related,
        actor,
      })
      db.prepare('DELETE FROM vote_results WHERE vote_id = ?').run(id)
      db.prepare('DELETE FROM votes WHERE id = ?').run(id)
      return trashedId
    })

    return { trashedId: tx() }
  }

  static trashProject(id: number, actor: TrashActor): { trashedId: number | null; notFound?: boolean } {
    const db = getAppDb()
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any
    if (!row) return { trashedId: null, notFound: true }

    const tx = db.transaction(() => {
      const trashedId = insertTrashEntry({
        entityType: 'project',
        entityTable: 'projects',
        originalId: id,
        title: row.title || `Projekt #${id}`,
        subtitle: [row.status, row.lead_member_name].filter(Boolean).join(' • '),
        data: row,
        actor,
      })
      db.prepare('DELETE FROM projects WHERE id = ?').run(id)
      return trashedId
    })

    return { trashedId: tx() }
  }

  static trashResearchInquiry(id: number, actor: TrashActor): { trashedId: number | null; notFound?: boolean } {
    const db = getAppDb()
    const row = db.prepare('SELECT * FROM research_inquiries WHERE id = ?').get(id) as any
    if (!row) return { trashedId: null, notFound: true }

    const tx = db.transaction(() => {
      const trashedId = insertTrashEntry({
        entityType: 'research_inquiry',
        entityTable: 'research_inquiries',
        originalId: id,
        parentId: row.project_id || null,
        title: row.subject || `Upit #${id}`,
        subtitle: [row.requester_name, row.requester_email, row.inquiry_date].filter(Boolean).join(' • '),
        data: row,
        actor,
      })
      db.prepare('DELETE FROM research_inquiries WHERE id = ?').run(id)
      return trashedId
    })

    return { trashedId: tx() }
  }

  static trashLibraryBook(id: number, actor: TrashActor): { trashedId: number | null; notFound?: boolean } {
    const db = getAppDb()
    const row = db.prepare('SELECT * FROM library_books WHERE id = ?').get(id) as any
    if (!row) return { trashedId: null, notFound: true }

    const tx = db.transaction(() => {
      const trashedId = insertTrashEntry({
        entityType: 'library_book',
        entityTable: 'library_books',
        originalId: id,
        title: row.naslov || `Knjiga #${id}`,
        subtitle: [row.autor, row.godina, row.signatura].filter(Boolean).join(' • '),
        data: row,
        actor,
      })
      db.prepare('DELETE FROM library_books WHERE id = ?').run(id)
      return trashedId
    })

    return { trashedId: tx() }
  }

  static trashLibraryJournal(id: number, actor: TrashActor): { trashedId: number | null; notFound?: boolean } {
    const db = getAppDb()
    const row = db.prepare('SELECT * FROM library_journals WHERE id = ?').get(id) as any
    if (!row) return { trashedId: null, notFound: true }

    const tx = db.transaction(() => {
      const trashedId = insertTrashEntry({
        entityType: 'library_journal',
        entityTable: 'library_journals',
        originalId: id,
        title: row.naslov || `Časopis #${id}`,
        subtitle: [row.izdavac, row.issn, row.svesci].filter(Boolean).join(' • '),
        data: row,
        actor,
      })
      db.prepare('DELETE FROM library_journals WHERE id = ?').run(id)
      return trashedId
    })

    return { trashedId: tx() }
  }

  static trashExternalLibrary(id: number, actor: TrashActor): { trashedId: number | null; notFound?: boolean } {
    const db = getAppDb()
    const row = db.prepare('SELECT * FROM external_libraries WHERE id = ?').get(id) as any
    if (!row) return { trashedId: null, notFound: true }

    const tx = db.transaction(() => {
      const related = {
        library_contact_logs: db.prepare('SELECT * FROM library_contact_logs WHERE library_id = ?').all(id),
      }
      const trashedId = insertTrashEntry({
        entityType: 'external_library',
        entityTable: 'external_libraries',
        originalId: id,
        title: row.naziv || `Ustanova #${id}`,
        subtitle: [row.mjesto, row.k_kod, row.email_sluzbeni].filter(Boolean).join(' • '),
        data: row,
        related,
        actor,
      })
      db.prepare('DELETE FROM external_libraries WHERE id = ?').run(id)
      return trashedId
    })

    return { trashedId: tx() }
  }

  static trashLibraryContactLog(id: number, actor: TrashActor): { trashedId: number | null; notFound?: boolean } {
    const db = getAppDb()
    const row = db.prepare('SELECT * FROM library_contact_logs WHERE id = ?').get(id) as any
    if (!row) return { trashedId: null, notFound: true }

    const parentLib = db.prepare('SELECT naziv FROM external_libraries WHERE id = ?').get(row.library_id) as any

    const tx = db.transaction(() => {
      const trashedId = insertTrashEntry({
        entityType: 'library_contact_log',
        entityTable: 'library_contact_logs',
        originalId: id,
        parentId: row.library_id,
        title: `Kontakt (${parentLib?.naziv || `Ustanova #${row.library_id}`})`,
        subtitle: [row.contact_date, row.contact_person_name, row.notes].filter(Boolean).join(' • '),
        data: row,
        actor,
      })
      db.prepare('DELETE FROM library_contact_logs WHERE id = ?').run(id)
      return trashedId
    })

    return { trashedId: tx() }
  }

  static trashContact(id: number, actor: TrashActor): { trashedId: number | null; notFound?: boolean } {
    const db = getAppDb()
    const row = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as any
    if (!row) return { trashedId: null, notFound: true }

    const tx = db.transaction(() => {
      const trashedId = insertTrashEntry({
        entityType: 'contact',
        entityTable: 'contacts',
        originalId: id,
        title: row.name || `Kontakt #${id}`,
        subtitle: [row.workplace, row.email, row.phone].filter(Boolean).join(' • '),
        data: row,
        actor,
      })
      db.prepare('DELETE FROM contacts WHERE id = ?').run(id)
      return trashedId
    })

    return { trashedId: tx() }
  }

  static trashUsefulLink(id: number, actor: TrashActor): { trashedId: number | null; notFound?: boolean } {
    const db = getAppDb()
    const row = db.prepare('SELECT * FROM useful_links WHERE id = ?').get(id) as any
    if (!row) return { trashedId: null, notFound: true }

    const tx = db.transaction(() => {
      const trashedId = insertTrashEntry({
        entityType: 'useful_link',
        entityTable: 'useful_links',
        originalId: id,
        title: row.title || `Link #${id}`,
        subtitle: [row.category, row.url].filter(Boolean).join(' • '),
        data: row,
        actor,
      })
      db.prepare('DELETE FROM useful_links WHERE id = ?').run(id)
      return trashedId
    })

    return { trashedId: tx() }
  }

  static trashVaultItem(id: number, actor: TrashActor): { trashedId: number | null; notFound?: boolean } {
    const db = getAppDb()
    const row = db.prepare('SELECT * FROM vault WHERE id = ?').get(id) as any
    if (!row) return { trashedId: null, notFound: true }

    const tx = db.transaction(() => {
      const trashedId = insertTrashEntry({
        entityType: 'vault_item',
        entityTable: 'vault',
        originalId: id,
        title: row.title || `Trezor #${id}`,
        subtitle: [row.category, row.username, row.url].filter(Boolean).join(' • '),
        data: row,
        actor,
      })
      db.prepare('DELETE FROM vault WHERE id = ?').run(id)
      return trashedId
    })

    return { trashedId: tx() }
  }

  static trashMailcrawlLead(id: number | string, actor: TrashActor): { trashedId: number | null; notFound?: boolean } {
    const row = mailcrawlDb.prepare('SELECT * FROM leads WHERE id = ?').get(id) as any
    if (!row) return { trashedId: null, notFound: true }

    const trashedId = insertTrashEntry({
      entityType: 'mailcrawl_lead',
      entityTable: 'mailcrawl.leads',
      originalId: row.id,
      title: row.name || `Subjekt #${id}`,
      subtitle: [row.city, row.email, row.oib ? `OIB: ${row.oib}` : ''].filter(Boolean).join(' • '),
      data: row,
      actor,
    })

    mailcrawlDb.prepare('DELETE FROM leads WHERE id = ?').run(id)
    return { trashedId }
  }

  // ── External service trash tracking (Google Drive / Gmail) ───────────────

  static trashExternalServiceItem(params: {
    entityType: 'drive_file' | 'gmail_message' | 'gmail_template'
    originalId: string
    title: string
    subtitle?: string
    data: any
    actor: TrashActor
  }): number {
    return insertTrashEntry({
      entityType: params.entityType,
      entityTable: params.entityType === 'drive_file' ? 'google_drive' : 'gmail',
      originalId: params.originalId,
      title: params.title,
      subtitle: params.subtitle || null,
      data: params.data,
      actor: params.actor,
    })
  }

  // ── Sub-item diff & archival (payments, functions, attachments, etc.) ────

  static trashSubItem(params: {
    entityType:
      | 'member_payment'
      | 'member_function'
      | 'project_record'
      | 'project_contributor'
      | 'attachment'
      | 'meeting_agenda_item'
      | 'personal_todo'
    parentTable: string
    parentId: string | number
    originalId: string
    title: string
    subtitle?: string | null
    data: any
    actor: TrashActor
  }): number {
    return insertTrashEntry({
      entityType: params.entityType,
      entityTable: params.parentTable,
      originalId: params.originalId,
      parentId: params.parentId,
      title: params.title,
      subtitle: params.subtitle || null,
      data: params.data,
      actor: params.actor,
    })
  }

  static diffRemovedArrayItems<T extends Record<string, any>>(
    oldRaw: any,
    newRaw: any,
    getKey: (item: T) => string
  ): T[] {
    if (newRaw === undefined) return []
    const oldArr = safeJsonParse<T[]>(oldRaw, [])
    const newArr = safeJsonParse<T[]>(newRaw, [])
    if (!Array.isArray(oldArr) || !Array.isArray(newArr) || oldArr.length === 0) return []

    const newKeys = new Set(newArr.map((item) => getKey(item)))
    return oldArr.filter((item) => !newKeys.has(getKey(item)))
  }

  static checkAndTrashMemberUpdates(memberId: number, oldRow: any, updates: Record<string, any>, actor: TrashActor) {
    if (!oldRow) return
    const memberName = oldRow.name || `Član #${memberId}`

    if (updates.payments !== undefined) {
      const removedPayments = this.diffRemovedArrayItems<any>(
        oldRow.payments,
        updates.payments,
        (p) => String(p.id || `${p.date}|${p.amount}|${p.note || ''}`)
      )
      for (const p of removedPayments) {
        this.trashSubItem({
          entityType: 'member_payment',
          parentTable: 'members',
          parentId: memberId,
          originalId: String(p.id || `${memberId}_${p.date}_${p.amount}`),
          title: `Uplata: ${p.amount} € (${memberName})`,
          subtitle: [p.date, p.forYear ? `Za ${p.forYear}. god.` : '', p.note].filter(Boolean).join(' • '),
          data: { payment: p, memberId, memberName },
          actor,
        })
      }
    }

    if (updates.functions !== undefined) {
      const removedFns = this.diffRemovedArrayItems<any>(
        oldRow.functions,
        updates.functions,
        (f) => String(f.id || `${f.functionName}|${f.fromYear || ''}|${f.toYear || ''}`)
      )
      for (const fn of removedFns) {
        this.trashSubItem({
          entityType: 'member_function',
          parentTable: 'members',
          parentId: memberId,
          originalId: String(fn.id || `${memberId}_${fn.functionName}`),
          title: `Funkcija: ${fn.functionName} (${memberName})`,
          subtitle: [fn.fromYear || '—', fn.toYear || 'aktivno'].join(' – '),
          data: { fn, memberId, memberName },
          actor,
        })
      }
    }

    const nextTodos = updates.personal_todos !== undefined ? updates.personal_todos : updates.personalTodos
    if (nextTodos !== undefined) {
      const removedTodos = this.diffRemovedArrayItems<any>(
        oldRow.personal_todos,
        nextTodos,
        (t) => String(t.id || t.text)
      )
      for (const todo of removedTodos) {
        this.trashSubItem({
          entityType: 'personal_todo',
          parentTable: 'members',
          parentId: memberId,
          originalId: String(todo.id || `${memberId}_${todo.text}`),
          title: `Zadatak: ${todo.text}`,
          subtitle: `Osobni kutak člana: ${memberName}`,
          data: { todo, ownerType: 'member', ownerId: memberId, ownerName: memberName },
          actor,
        })
      }
    }
  }

  static checkAndTrashMeetingUpdates(meetingId: number, oldRow: any, updates: Record<string, any>, actor: TrashActor) {
    if (!oldRow) return
    const meetingTitle = oldRow.title || `Sjednica #${meetingId}`

    if (updates.attachments !== undefined) {
      const removedAtts = this.diffRemovedArrayItems<any>(
        oldRow.attachments,
        updates.attachments,
        (a) => String(a.id || a.url || a.name)
      )
      for (const att of removedAtts) {
        this.trashSubItem({
          entityType: 'attachment',
          parentTable: 'meetings',
          parentId: meetingId,
          originalId: String(att.id || att.url || att.name),
          title: `Prilog: ${att.name || 'Datoteka'}`,
          subtitle: `Sjednica: ${meetingTitle}`,
          data: { attachment: att, parentTable: 'meetings', parentId: meetingId, parentTitle: meetingTitle, fieldName: 'attachments' },
          actor,
        })
      }
    }

    if (updates.agenda !== undefined) {
      const removedAgenda = this.diffRemovedArrayItems<any>(
        oldRow.agenda,
        updates.agenda,
        (i) => String(i.id || i.text)
      )
      for (const item of removedAgenda) {
        this.trashSubItem({
          entityType: 'meeting_agenda_item',
          parentTable: 'meetings',
          parentId: meetingId,
          originalId: String(item.id || item.text),
          title: `Točka dnevnog reda: ${item.text}`,
          subtitle: `Sjednica: ${meetingTitle}`,
          data: { item, meetingId, meetingTitle, fieldName: 'agenda' },
          actor,
        })
      }
    }

    const nextAgendaVal = updates.next_meeting_agenda !== undefined ? updates.next_meeting_agenda : updates.nextMeetingAgenda
    if (nextAgendaVal !== undefined) {
      const removedNext = this.diffRemovedArrayItems<any>(
        oldRow.next_meeting_agenda,
        nextAgendaVal,
        (i) => String(i.id || i.text)
      )
      for (const item of removedNext) {
        this.trashSubItem({
          entityType: 'meeting_agenda_item',
          parentTable: 'meetings',
          parentId: meetingId,
          originalId: String(item.id || item.text),
          title: `Točka za sljedeću sjednicu: ${item.text}`,
          subtitle: `Sjednica: ${meetingTitle}`,
          data: { item, meetingId, meetingTitle, fieldName: 'next_meeting_agenda' },
          actor,
        })
      }
    }
  }

  static checkAndTrashLectureUpdates(lectureId: number, oldRow: any, updates: Record<string, any>, actor: TrashActor) {
    if (!oldRow || updates.attachments === undefined) return
    const lectureTitle = oldRow.title || `Predavanje #${lectureId}`
    const removedAtts = this.diffRemovedArrayItems<any>(
      oldRow.attachments,
      updates.attachments,
      (a) => String(a.id || a.url || a.name)
    )
    for (const att of removedAtts) {
      this.trashSubItem({
        entityType: 'attachment',
        parentTable: 'lectures',
        parentId: lectureId,
        originalId: String(att.id || att.url || att.name),
        title: `Prilog: ${att.name || 'Datoteka'}`,
        subtitle: `Predavanje: ${lectureTitle}`,
        data: { attachment: att, parentTable: 'lectures', parentId: lectureId, parentTitle: lectureTitle, fieldName: 'attachments' },
        actor,
      })
    }
  }

  static checkAndTrashProjectUpdates(projectId: number, oldRow: any, updates: Record<string, any>, actor: TrashActor) {
    if (!oldRow) return
    const projectTitle = oldRow.title || `Projekt #${projectId}`

    if (updates.records !== undefined) {
      const removed = this.diffRemovedArrayItems<any>(
        oldRow.records,
        updates.records,
        (r) => String(r.id || `${r.date}|${r.title}`)
      )
      for (const record of removed) {
        this.trashSubItem({
          entityType: 'project_record',
          parentTable: 'projects',
          parentId: projectId,
          originalId: String(record.id || record.title),
          title: `Zapis: ${record.title || 'Bez naslova'}`,
          subtitle: `Projekt: ${projectTitle}${record.date ? ` • ${record.date}` : ''}`,
          data: { record, projectId, projectTitle },
          actor,
        })
      }
    }

    if (updates.contributors !== undefined) {
      const removed = this.diffRemovedArrayItems<any>(
        oldRow.contributors,
        updates.contributors,
        (c) => String(c.id || JSON.stringify(c.data || {}))
      )
      for (const contributor of removed) {
        const preview = Object.values(contributor.data || {}).filter(Boolean).slice(0, 2).join(' ')
        this.trashSubItem({
          entityType: 'project_contributor',
          parentTable: 'projects',
          parentId: projectId,
          originalId: String(contributor.id || preview || Date.now()),
          title: `Doprinositelj: ${preview || contributor.id}`,
          subtitle: `Projekt: ${projectTitle}`,
          data: { contributor, projectId, projectTitle },
          actor,
        })
      }
    }

    if (updates.attachments !== undefined) {
      const removed = this.diffRemovedArrayItems<any>(
        oldRow.attachments,
        updates.attachments,
        (a) => String(a.id || a.url || a.name)
      )
      for (const att of removed) {
        this.trashSubItem({
          entityType: 'attachment',
          parentTable: 'projects',
          parentId: projectId,
          originalId: String(att.id || att.url || att.name),
          title: `Prilog: ${att.name || 'Datoteka'}`,
          subtitle: `Projekt: ${projectTitle}`,
          data: { attachment: att, parentTable: 'projects', parentId: projectId, parentTitle: projectTitle, fieldName: 'attachments' },
          actor,
        })
      }
    }
  }

  static checkAndTrashInquiryUpdates(inquiryId: number, oldRow: any, updates: Record<string, any>, actor: TrashActor) {
    if (!oldRow || updates.attachments === undefined) return
    const inquiryTitle = oldRow.subject || `Upit #${inquiryId}`
    const removed = this.diffRemovedArrayItems<any>(
      oldRow.attachments,
      updates.attachments,
      (a) => String(a.id || a.url || a.name)
    )
    for (const att of removed) {
      this.trashSubItem({
        entityType: 'attachment',
        parentTable: 'research_inquiries',
        parentId: inquiryId,
        originalId: String(att.id || att.url || att.name),
        title: `Prilog: ${att.name || 'Datoteka'}`,
        subtitle: `Upit i istraživanje: ${inquiryTitle}`,
        data: { attachment: att, parentTable: 'research_inquiries', parentId: inquiryId, parentTitle: inquiryTitle, fieldName: 'attachments' },
        actor,
      })
    }
  }

  static checkAndTrashLibraryUpdates(
    type: 'books' | 'journals',
    itemId: number,
    oldRow: any,
    updates: Record<string, any>,
    actor: TrashActor
  ) {
    if (!oldRow) return
    const parentTable = type === 'journals' ? 'library_journals' : 'library_books'
    const parentLabel = type === 'journals' ? 'Časopis' : 'Knjiga'
    const parentTitle = oldRow.naslov || `${parentLabel} #${itemId}`

    if (updates.attachments !== undefined) {
      const removed = this.diffRemovedArrayItems<any>(
        oldRow.attachments,
        updates.attachments,
        (a) => String(a.id || a.url || a.name)
      )
      for (const att of removed) {
        this.trashSubItem({
          entityType: 'attachment',
          parentTable,
          parentId: itemId,
          originalId: String(att.id || att.url || att.name),
          title: `Prilog: ${att.name || 'Datoteka'}`,
          subtitle: `${parentLabel}: ${parentTitle}`,
          data: { attachment: att, parentTable, parentId: itemId, parentTitle, fieldName: 'attachments' },
          actor,
        })
      }
    }

    if (type === 'books' && updates.rights_attachment !== undefined) {
      const oldRights = oldRow.rights_attachment
      const newRights = updates.rights_attachment
      if (oldRights && (!newRights || String(newRights).trim() === '')) {
        this.trashSubItem({
          entityType: 'attachment',
          parentTable: 'library_books',
          parentId: itemId,
          originalId: `rights_${itemId}_${Date.now()}`,
          title: `Suglasnost za digitalizaciju`,
          subtitle: `Knjiga: ${parentTitle}`,
          data: {
            attachment: oldRights,
            parentTable: 'library_books',
            parentId: itemId,
            parentTitle,
            fieldName: 'rights_attachment',
          },
          actor,
        })
      }
    }
  }

  static checkAndTrashAdminTodosUpdate(oldTodosRaw: any, newTodosRaw: any, actor: TrashActor) {
    if (newTodosRaw === undefined) return
    const removed = this.diffRemovedArrayItems<any>(
      oldTodosRaw,
      newTodosRaw,
      (t) => String(t.id || t.text)
    )
    for (const todo of removed) {
      this.trashSubItem({
        entityType: 'personal_todo',
        parentTable: 'settings',
        parentId: 1,
        originalId: String(todo.id || todo.text),
        title: `Zadatak: ${todo.text}`,
        subtitle: `Osobni kutak administratora`,
        data: { todo, ownerType: 'admin', ownerId: 'admin', ownerName: actor.name },
        actor,
      })
    }
  }

  // ── Restore (Undelete) ──────────────────────────────────────────────────

  static async restoreTrashItem(trashId: number, adminActor: TrashActor): Promise<{
    success: boolean
    item?: TrashItem
    message?: string
    error?: string
  }> {
    const db = getAppDb()
    const trashRow = db.prepare('SELECT * FROM trash_items WHERE id = ?').get(trashId) as TrashItem | undefined
    if (!trashRow) {
      return { success: false, error: 'Stavka u smeću nije pronađena.' }
    }
    if (trashRow.status === 'restored') {
      return { success: false, error: 'Ova stavka je već vraćena u sustav.' }
    }

    const data = safeJsonParse<any>(trashRow.data_json, {})
    const related = safeJsonParse<any>(trashRow.related_json, {})

    try {
      switch (trashRow.entity_type) {
        case 'member': {
          const origId = Number(trashRow.original_id)
          if (data.email) {
            const emailConflict = db
              .prepare('SELECT id, name FROM members WHERE LOWER(email) = LOWER(?)')
              .get(String(data.email)) as any
            if (emailConflict && Number(emailConflict.id) !== origId) {
              return {
                success: false,
                error: `Nije moguće vratiti člana jer u evidenciji već postoji član s e-mailom "${data.email}" (${emailConflict.name}).`,
              }
            }
          }
          const existingId = db.prepare('SELECT id FROM members WHERE id = ?').get(origId)
          const rowToInsert = existingId ? { ...data, id: undefined } : data
          const tx = db.transaction(() => {
            insertRowByColumns(db, 'members', rowToInsert)
            const restoredId = existingId
              ? (db.prepare('SELECT last_insert_rowid() as id').get() as any).id
              : origId

            if (Array.isArray(related?.payments)) {
              for (const p of related.payments) {
                try {
                  insertRowByColumns(db, 'payments', { ...p, memberId: restoredId })
                } catch {}
              }
            }
            if (Array.isArray(related?.attendance)) {
              for (const a of related.attendance) {
                try {
                  const mExists = db.prepare('SELECT id FROM meetings WHERE id = ?').get(a.meeting_id)
                  if (mExists) {
                    insertRowByColumns(db, 'attendance', { ...a, member_id: restoredId })
                  }
                } catch {}
              }
            }
            if (Array.isArray(related?.meeting_participants)) {
              for (const mp of related.meeting_participants) {
                try {
                  const mExists = db.prepare('SELECT id FROM meetings WHERE id = ?').get(mp.meeting_id)
                  if (mExists) {
                    insertRowByColumns(db, 'meeting_participants', { ...mp, member_id: restoredId })
                  }
                } catch {}
              }
            }
            if (Array.isArray(related?.vote_results)) {
              for (const vr of related.vote_results) {
                try {
                  const vExists = db.prepare('SELECT id FROM votes WHERE id = ?').get(vr.vote_id)
                  if (vExists) {
                    insertRowByColumns(db, 'vote_results', { ...vr, member_id: restoredId })
                  }
                } catch {}
              }
            }
          })
          tx()
          break
        }

        case 'lecture': {
          const origId = Number(trashRow.original_id)
          const existing = db.prepare('SELECT id FROM lectures WHERE id = ?').get(origId)
          insertRowByColumns(db, 'lectures', existing ? { ...data, id: undefined } : data)
          break
        }

        case 'meeting': {
          const origId = Number(trashRow.original_id)
          const existing = db.prepare('SELECT id FROM meetings WHERE id = ?').get(origId)
          const tx = db.transaction(() => {
            insertRowByColumns(db, 'meetings', existing ? { ...data, id: undefined } : data)
            const restoredId = existing
              ? (db.prepare('SELECT last_insert_rowid() as id').get() as any).id
              : origId
            if (Array.isArray(related?.attendance)) {
              for (const a of related.attendance) {
                try {
                  const memExists = db.prepare('SELECT id FROM members WHERE id = ?').get(a.member_id)
                  if (memExists) {
                    insertRowByColumns(db, 'attendance', { ...a, meeting_id: restoredId })
                  }
                } catch {}
              }
            }
            if (Array.isArray(related?.meeting_participants)) {
              for (const mp of related.meeting_participants) {
                try {
                  const memExists = db.prepare('SELECT id FROM members WHERE id = ?').get(mp.member_id)
                  if (memExists) {
                    insertRowByColumns(db, 'meeting_participants', { ...mp, meeting_id: restoredId })
                  }
                } catch {}
              }
            }
            if (Array.isArray(related?.linked_vote_ids)) {
              const relinkStmt = db.prepare('UPDATE votes SET meeting_id = ? WHERE id = ?')
              for (const vId of related.linked_vote_ids) {
                try {
                  relinkStmt.run(restoredId, vId)
                } catch {}
              }
            }
          })
          tx()
          break
        }

        case 'poll': {
          const origId = Number(trashRow.original_id)
          const existing = db.prepare('SELECT id FROM votes WHERE id = ?').get(origId)
          const voteRow = { ...data }
          if (voteRow.meeting_id) {
            const meetingExists = db.prepare('SELECT id FROM meetings WHERE id = ?').get(voteRow.meeting_id)
            if (!meetingExists) voteRow.meeting_id = null
          }
          const tx = db.transaction(() => {
            insertRowByColumns(db, 'votes', existing ? { ...voteRow, id: undefined } : voteRow)
            const restoredId = existing
              ? (db.prepare('SELECT last_insert_rowid() as id').get() as any).id
              : origId
            if (Array.isArray(related?.vote_results)) {
              for (const vr of related.vote_results) {
                try {
                  const memExists = db.prepare('SELECT id FROM members WHERE id = ?').get(vr.member_id)
                  if (memExists) {
                    insertRowByColumns(db, 'vote_results', { ...vr, vote_id: restoredId })
                  }
                } catch {}
              }
            }
          })
          tx()
          break
        }

        case 'project': {
          const origId = Number(trashRow.original_id)
          const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(origId)
          insertRowByColumns(db, 'projects', existing ? { ...data, id: undefined } : data)
          break
        }

        case 'research_inquiry': {
          const origId = Number(trashRow.original_id)
          const existing = db.prepare('SELECT id FROM research_inquiries WHERE id = ?').get(origId)
          insertRowByColumns(db, 'research_inquiries', existing ? { ...data, id: undefined } : data)
          break
        }

        case 'library_book': {
          const origId = Number(trashRow.original_id)
          const existing = db.prepare('SELECT id FROM library_books WHERE id = ?').get(origId)
          insertRowByColumns(db, 'library_books', existing ? { ...data, id: undefined } : data)
          break
        }

        case 'library_journal': {
          const origId = Number(trashRow.original_id)
          const existing = db.prepare('SELECT id FROM library_journals WHERE id = ?').get(origId)
          insertRowByColumns(db, 'library_journals', existing ? { ...data, id: undefined } : data)
          break
        }

        case 'external_library': {
          const origId = Number(trashRow.original_id)
          const existing = db.prepare('SELECT id FROM external_libraries WHERE id = ?').get(origId)
          const tx = db.transaction(() => {
            insertRowByColumns(db, 'external_libraries', existing ? { ...data, id: undefined } : data)
            const restoredId = existing
              ? (db.prepare('SELECT last_insert_rowid() as id').get() as any).id
              : origId
            if (Array.isArray(related?.library_contact_logs)) {
              for (const log of related.library_contact_logs) {
                try {
                  insertRowByColumns(db, 'library_contact_logs', { ...log, library_id: restoredId })
                } catch {}
              }
            }
          })
          tx()
          break
        }

        case 'library_contact_log': {
          const parentExists = db
            .prepare('SELECT id FROM external_libraries WHERE id = ?')
            .get(data.library_id)
          if (!parentExists) {
            return {
              success: false,
              error: `Matična knjižnica/ustanova (#${data.library_id}) više ne postoji. Najprije vratite matičnu ustanovu iz smeća.`,
            }
          }
          const origId = Number(trashRow.original_id)
          const existing = db.prepare('SELECT id FROM library_contact_logs WHERE id = ?').get(origId)
          insertRowByColumns(db, 'library_contact_logs', existing ? { ...data, id: undefined } : data)
          break
        }

        case 'contact': {
          const origId = Number(trashRow.original_id)
          const existing = db.prepare('SELECT id FROM contacts WHERE id = ?').get(origId)
          insertRowByColumns(db, 'contacts', existing ? { ...data, id: undefined } : data)
          break
        }

        case 'useful_link': {
          const origId = Number(trashRow.original_id)
          const existing = db.prepare('SELECT id FROM useful_links WHERE id = ?').get(origId)
          insertRowByColumns(db, 'useful_links', existing ? { ...data, id: undefined } : data)
          break
        }

        case 'vault_item': {
          const origId = Number(trashRow.original_id)
          const existing = db.prepare('SELECT id FROM vault WHERE id = ?').get(origId)
          insertRowByColumns(db, 'vault', existing ? { ...data, id: undefined } : data)
          break
        }

        case 'mailcrawl_lead': {
          const origId = Number(trashRow.original_id)
          const existing = mailcrawlDb.prepare('SELECT id FROM leads WHERE id = ?').get(origId)
          insertRowByColumns(mailcrawlDb, 'leads', existing ? { ...data, id: undefined } : data)
          break
        }

        case 'activity_logs_batch': {
          if (Array.isArray(data)) {
            const validCols = getValidTableColumns(db, 'activity_logs')
            const tx = db.transaction(() => {
              for (const row of data) {
                try {
                  const existing = db.prepare('SELECT id FROM activity_logs WHERE id = ?').get(row.id)
                  if (!existing) {
                    const filtered: Record<string, any> = {}
                    for (const [k, v] of Object.entries(row)) {
                      if (validCols.has(k) && v !== undefined) filtered[k] = v
                    }
                    const cols = Object.keys(filtered)
                    if (cols.length > 0) {
                      db.prepare(
                        `INSERT INTO activity_logs (${cols.join(', ')}) VALUES (${cols.map((c) => `@${c}`).join(', ')})`
                      ).run(filtered)
                    }
                  }
                } catch {}
              }
            })
            tx()
          }
          break
        }

        case 'member_payment': {
          const memberId = Number(data.memberId || trashRow.parent_id)
          const memberRow = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId) as any
          if (!memberRow) {
            return {
              success: false,
              error: `Član #${memberId} nije pronađen u aktivnoj evidenciji. Najprije vratite člana iz smeća.`,
            }
          }
          const existingPayments = safeJsonParse<any[]>(memberRow.payments, [])
          const payment = data.payment
          if (!existingPayments.some((p) => p.id && payment.id && String(p.id) === String(payment.id))) {
            existingPayments.push(payment)
          }
          const parsedMember = {
            ...memberRow,
            payments: existingPayments,
            honorary: memberRow.honorary === 1,
            exemptFromPayment: memberRow.exemptFromPayment === 1,
            expelled: memberRow.expelled === 1,
            deceased: memberRow.deceased === 1,
          }
          const computed = computeMemberStates(parsedMember, getStatusSettings())
          db.prepare(
            `UPDATE members SET payments = ?, status = ?, paymentStatus = ?, status_clana = ?, datum_zadnje_uplate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
          ).run(
            JSON.stringify(existingPayments),
            computed.status,
            computed.paymentStatus,
            computed.status_clana,
            computed.datum_zadnje_uplate,
            memberId
          )
          break
        }

        case 'member_function': {
          const memberId = Number(data.memberId || trashRow.parent_id)
          const memberRow = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId) as any
          if (!memberRow) {
            return {
              success: false,
              error: `Član #${memberId} nije pronađen u aktivnoj evidenciji. Najprije vratite člana iz smeća.`,
            }
          }
          const existingFns = safeJsonParse<any[]>(memberRow.functions, [])
          const fn = data.fn
          if (!existingFns.some((f) => f.id && fn.id && String(f.id) === String(fn.id))) {
            existingFns.push(fn)
          }
          db.prepare('UPDATE members SET functions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
            JSON.stringify(existingFns),
            memberId
          )
          break
        }

        case 'project_record': {
          const projectId = Number(data.projectId || trashRow.parent_id)
          const projectRow = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any
          if (!projectRow) {
            return {
              success: false,
              error: `Projekt #${projectId} nije pronađen. Najprije vratite projekt iz smeća.`,
            }
          }
          const records = safeJsonParse<any[]>(projectRow.records, [])
          const record = data.record
          if (!records.some((r) => r.id && record.id && String(r.id) === String(record.id))) {
            records.push(record)
          }
          db.prepare('UPDATE projects SET records = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
            JSON.stringify(records),
            projectId
          )
          break
        }

        case 'project_contributor': {
          const projectId = Number(data.projectId || trashRow.parent_id)
          const projectRow = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any
          if (!projectRow) {
            return {
              success: false,
              error: `Projekt #${projectId} nije pronađen. Najprije vratite projekt iz smeća.`,
            }
          }
          const contributors = safeJsonParse<any[]>(projectRow.contributors, [])
          const contributor = data.contributor
          if (!contributors.some((c) => c.id && contributor.id && String(c.id) === String(contributor.id))) {
            contributors.push(contributor)
          }
          db.prepare('UPDATE projects SET contributors = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
            JSON.stringify(contributors),
            projectId
          )
          break
        }

        case 'attachment': {
          const parentTable = String(data.parentTable || trashRow.entity_table)
          const allowedTables = new Set([
            'lectures',
            'meetings',
            'projects',
            'research_inquiries',
            'library_books',
            'library_journals',
          ])
          if (!allowedTables.has(parentTable)) {
            return { success: false, error: `Nepodržana matična tablica priloga: ${parentTable}` }
          }
          const parentId = Number(data.parentId || trashRow.parent_id)
          const parentRow = db.prepare(`SELECT * FROM ${parentTable} WHERE id = ?`).get(parentId) as any
          if (!parentRow) {
            return {
              success: false,
              error: `Matični zapis (#${parentId} u ${parentTable}) nije pronađen. Najprije vratite matični zapis iz smeća.`,
            }
          }
          if (data.fieldName === 'rights_attachment' && parentTable === 'library_books') {
            db.prepare('UPDATE library_books SET rights_attachment = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
              typeof data.attachment === 'string' ? data.attachment : JSON.stringify(data.attachment),
              parentId
            )
          } else {
            const atts = safeJsonParse<any[]>(parentRow.attachments, [])
            const att = data.attachment
            if (!atts.some((a) => a.id && att.id && String(a.id) === String(att.id))) {
              atts.push(att)
            }
            db.prepare(`UPDATE ${parentTable} SET attachments = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
              JSON.stringify(atts),
              parentId
            )
          }
          break
        }

        case 'meeting_agenda_item': {
          const meetingId = Number(data.meetingId || trashRow.parent_id)
          const meetingRow = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId) as any
          if (!meetingRow) {
            return {
              success: false,
              error: `Sjednica #${meetingId} nije pronađena. Najprije vratite sjednicu iz smeća.`,
            }
          }
          const fieldName = data.fieldName === 'next_meeting_agenda' ? 'next_meeting_agenda' : 'agenda'
          const items = safeJsonParse<any[]>(meetingRow[fieldName], [])
          const item = data.item
          if (!items.some((i) => i.id && item.id && String(i.id) === String(item.id))) {
            items.push(item)
          }
          db.prepare(`UPDATE meetings SET ${fieldName} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
            JSON.stringify(items),
            meetingId
          )
          break
        }

        case 'personal_todo': {
          const todo = data.todo
          if (data.ownerType === 'admin') {
            const settingsRow = db.prepare('SELECT adminPersonalTodos FROM settings WHERE id = 1').get() as any
            const todos = safeJsonParse<any[]>(settingsRow?.adminPersonalTodos, [])
            if (!todos.some((t) => t.id && todo.id && String(t.id) === String(todo.id))) {
              todos.push(todo)
            }
            db.prepare('UPDATE settings SET adminPersonalTodos = ? WHERE id = 1').run(JSON.stringify(todos))
          } else {
            const memberId = Number(data.ownerId || trashRow.parent_id)
            const memberRow = db.prepare('SELECT personal_todos FROM members WHERE id = ?').get(memberId) as any
            if (!memberRow) {
              return {
                success: false,
                error: `Član #${memberId} nije pronađen. Najprije vratite člana iz smeća.`,
              }
            }
            const todos = safeJsonParse<any[]>(memberRow.personal_todos, [])
            if (!todos.some((t) => t.id && todo.id && String(t.id) === String(todo.id))) {
              todos.push(todo)
            }
            db.prepare('UPDATE members SET personal_todos = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
              JSON.stringify(todos),
              memberId
            )
          }
          break
        }

        case 'drive_file': {
          const fileId = data.fileId || trashRow.original_id
          const { drive } = getGoogleWorkspaceClients({ requireTargetEmail: false })
          await drive.files.update({
            fileId,
            requestBody: { trashed: false },
            supportsAllDrives: true,
          })
          break
        }

        case 'gmail_message':
        case 'gmail_template': {
          const { gmail } = getGoogleWorkspaceClients({
            targetEmailOverride: data.mailbox,
            requireTargetEmail: true,
          })
          if (trashRow.entity_type === 'gmail_template' && data.draftId && data.raw) {
            await gmail.users.drafts.create({
              userId: 'me',
              requestBody: { message: { raw: data.raw } },
            })
          } else {
            const messageId = data.messageId || trashRow.original_id
            await gmail.users.messages.untrash({ userId: 'me', id: messageId })
          }
          break
        }

        default:
          return { success: false, error: `Nepodržana vrsta zapisa za povrat: ${trashRow.entity_type}` }
      }

      const now = new Date().toISOString()
      db.prepare(
        `UPDATE trash_items SET status = 'restored', restored_at = ?, restored_by_id = ?, restored_by_name = ? WHERE id = ?`
      ).run(now, adminActor.id || 'admin', adminActor.name || 'Administrator', trashId)

      const label = ENTITY_TYPE_LABELS[trashRow.entity_type] || trashRow.entity_type
      recordAuditLog(
        adminActor,
        'Vraćeno iz smeća (Undelete)',
        `[${label}] "${trashRow.title}" vraćeno u sustav od strane administratora ${adminActor.name}`
      )

      const updatedItem = db.prepare('SELECT * FROM trash_items WHERE id = ?').get(trashId) as TrashItem
      return {
        success: true,
        item: updatedItem,
        message: `Stavka "${trashRow.title}" je uspješno vraćena iz smeća.`,
      }
    } catch (error: any) {
      console.error('[TrashService.restoreTrashItem Error]:', error)
      return {
        success: false,
        error: error?.message || 'Greška prilikom vraćanja stavke iz smeća.',
      }
    }
  }
}
