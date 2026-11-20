import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService, getAppDb } from '@/lib/database'
import { extractActor } from '@/lib/trash'
import { parseAccessRights } from '@/lib/inquiry-permissions'
import { isAdminRecord } from '@/src/services/member-service'
import { inspectMemberDate } from '@/lib/date-validation'
import { formatDateDMY } from '@/lib/utils'
import { getArchiveResultLabel } from '@/lib/archive-constants'

export const dynamic = 'force-dynamic'

function resolveArchivePermissions(request: NextRequest, body?: any) {
  const actor = extractActor(request, body)
  const roleLower = (actor.role || '').trim().toLowerCase()
  const db = getAppDb()

  const numericActorId = Number(actor.id)
  const emailLower = (actor.email || '').trim().toLowerCase()

  let actorMember: any = null
  if (roleLower !== 'admin') {
    if (Number.isFinite(numericActorId) && numericActorId > 0) {
      actorMember = db
        .prepare('SELECT id, name, email, role, access_rights FROM members WHERE id = ? LIMIT 1')
        .get(numericActorId)
    }
    if (!actorMember && emailLower) {
      actorMember = db
        .prepare('SELECT id, name, email, role, access_rights FROM members WHERE LOWER(TRIM(email)) = ? LIMIT 1')
        .get(emailLower)
    }
  }

  let canView = false
  let canEdit = false
  if (roleLower === 'admin' || roleLower === 'moderator') {
    canView = true
    canEdit = true
  } else if (actorMember) {
    const ar = parseAccessRights(actorMember.access_rights)
    canEdit = Boolean(ar?.archive?.edit === true)
    canView = Boolean(ar?.archive?.view === true || canEdit)
  }

  const actorName =
    roleLower === 'admin'
      ? (db.prepare('SELECT adminName FROM settings WHERE id = 1').get() as any)?.adminName?.trim() ||
        actor.name ||
        'Administrator'
      : actorMember?.name || actor.name || 'Korisnik'

  return { actor, actorName, roleLower, canView, canEdit }
}

export async function GET(request: NextRequest) {
  try {
    const { canView, canEdit } = resolveArchivePermissions(request)
    if (!canView) {
      return NextResponse.json(
        { error: 'Nemate ovlast za pregled modula Arhiv.' },
        { status: 403 }
      )
    }

    const rows = DatabaseService.getArchiveMembersList()
    const items = rows
      .map((r: any) => ({
        memberId: Number(r.memberId),
        name: String(r.name || ''),
        email: String(r.email || ''),
        phone: String(r.phone || ''),
        landlinePhone: String(r.landlinePhone || ''),
        address: String(r.address || ''),
        deceased: r.deceased === 1 || r.deceased === true,
        deathDate: String(r.deathDate || ''),
        contacted: r.contacted === 1 || r.contacted === true,
        contactedAt: r.contactedAt ? formatDateDMY(r.contactedAt, String(r.contactedAt)) : '',
        contactResult: String(r.contactResult || ''),
        note: String(r.note || ''),
        updatedByName: String(r.updatedByName || ''),
        updatedAt: String(r.updatedAt || ''),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'hr'))

    return NextResponse.json(
      { success: true, items, canEdit },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error: any) {
    console.error('[Archive GET Error]:', error)
    return NextResponse.json(
      { error: error?.message || 'Greška pri učitavanju arhive članova.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { actor, actorName, roleLower, canEdit } = resolveArchivePermissions(request, body)

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Nemate pravo uređivanja evidencije u modulu Arhiv.' },
        { status: 403 }
      )
    }

    const memberId = Number(body?.memberId)
    if (!Number.isFinite(memberId) || memberId <= 0) {
      return NextResponse.json({ error: 'Neispravan identifikator člana.' }, { status: 400 })
    }

    const db = getAppDb()
    const memberRow = db
      .prepare('SELECT id, name, email, role FROM members WHERE id = ? LIMIT 1')
      .get(memberId) as any

    if (!memberRow || isAdminRecord(memberRow)) {
      return NextResponse.json({ error: 'Član nije pronađen u registru.' }, { status: 404 })
    }

    const contacted = Boolean(body?.contacted)
    const rawDate = String(body?.contactedAt || '').trim()
    let normalizedDate = ''

    if (rawDate) {
      const inspected = inspectMemberDate(rawDate)
      if (!inspected.isoDate) {
        return NextResponse.json(
          { error: 'Datum kontakta nije ispravan. Unesite datum u formatu DD/MM/YYYY.' },
          { status: 400 }
        )
      }
      normalizedDate = formatDateDMY(inspected.isoDate, rawDate)
    }

    const contactResult = String(body?.contactResult || '').trim()
    const note = String(body?.note || '').trim()

    const updated = DatabaseService.upsertArchiveMemberContact({
      memberId,
      contacted,
      contactedAt: normalizedDate,
      contactResult,
      note,
      updatedById: String(actor.id || ''),
      updatedByName: actorName,
    })

    try {
      const resultLabel = contactResult ? getArchiveResultLabel(contactResult) : ''
      const notePreview = note ? ` | Napomena: "${note.slice(0, 80)}${note.length > 80 ? '…' : ''}"` : ''
      DatabaseService.insertLog({
        userId: String(actor.id || 'system'),
        userName: actorName,
        userRole: roleLower || 'member',
        action: 'Ažuriranje arhiva',
        details: `${actorName} ažurirao/la je arhivsku evidenciju za člana ${memberRow.name} (Kontaktiran: ${contacted ? 'Da' : 'Ne'}${normalizedDate ? `, datum: ${normalizedDate}` : ''}${resultLabel ? `, rezultat: ${resultLabel}` : ''}${notePreview})`,
        timestamp: new Date().toISOString(),
      })
    } catch (logErr) {
      console.warn('[Archive PATCH] Log warning:', logErr)
    }

    return NextResponse.json({ success: true, item: updated })
  } catch (error: any) {
    console.error('[Archive PATCH Error]:', error)
    return NextResponse.json(
      { error: error?.message || 'Greška pri spremanju arhivskog zapisa.' },
      { status: 500 }
    )
  }
}
