import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  DatabaseService,
  ExternalUsersDB,
  ResearchInquiriesDB,
  getAppDb,
} from '@/lib/database'
import { extractActor, TrashService } from '@/lib/trash'
import { getInquiryPermissions, parseAccessRights } from '@/lib/inquiry-permissions'
import { hashPassword } from '@/lib/password-hash'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sanitizeInquiryRights(raw: any): Record<string, { view: boolean; edit: boolean }> {
  const src = parseAccessRights(raw)
  const out: Record<string, { view: boolean; edit: boolean }> = {}
  const keys = [
    'research_inquiries_zaprimljeno',
    'research_inquiries_uradu',
    'research_inquiries_zavrseno',
  ]
  for (const k of keys) {
    const entry = src[k]
    if (entry && typeof entry === 'object') {
      const edit = entry.edit === true
      const view = entry.view === true || edit
      if (view || edit) {
        out[k] = { view, edit }
      }
    }
  }
  return out
}

async function resolveInquiryCaller(request: NextRequest, body?: any) {
  const actor = extractActor(request, body)
  const roleLower = (actor.role || '').trim().toLowerCase()
  if (roleLower === 'admin') {
    return {
      actor,
      isAdmin: true,
      dbUser: { id: 2579, name: actor.name || 'Administrator', role: 'admin' },
    }
  }

  const db = getAppDb()
  const numericId = Number(actor.id)
  const emailLower = (actor.email || '').trim().toLowerCase()

  let member: any = null
  if (roleLower !== 'external') {
    if (Number.isFinite(numericId) && numericId > 0) {
      member = db
        .prepare('SELECT id, name, email, role, access_rights FROM members WHERE id = ? LIMIT 1')
        .get(numericId)
    }
    if (!member && emailLower) {
      member = db
        .prepare('SELECT id, name, email, role, access_rights FROM members WHERE lower(trim(email)) = ? LIMIT 1')
        .get(emailLower)
    }
  }

  if (member) {
    const parsedRights = parseAccessRights(member.access_rights)
    return {
      actor,
      isAdmin: member.role === 'admin',
      dbUser: {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role || 'member',
        accessRights: parsedRights,
      },
    }
  }

  const ext =
    (Number.isFinite(numericId) && numericId > 0 ? ExternalUsersDB.getRawById(numericId) : null) ||
    (emailLower ? ExternalUsersDB.getRawByEmail(emailLower) : null)

  if (ext && (ext.is_active === 1 || ext.is_active === true)) {
    return {
      actor,
      isAdmin: false,
      dbUser: {
        id: Number(ext.id),
        name: ext.name,
        email: ext.email,
        role: 'external',
        accessRights: parseAccessRights(ext.access_rights),
      },
    }
  }

  return { actor, isAdmin: false, dbUser: null }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope')
    const { isAdmin, dbUser } = await resolveInquiryCaller(request)

    if (!dbUser) {
      return NextResponse.json({ error: 'Potrebna je prijava u sustav.' }, { status: 401 })
    }

    if (scope === 'researchers') {
      const perms = getInquiryPermissions(dbUser)
      const canReadResearchers =
        isAdmin || dbUser.role === 'moderator' || perms.canViewAny || perms.canEditAny
      if (!canReadResearchers) {
        return NextResponse.json({ error: 'Nemate ovlast za pregled istraživača.' }, { status: 403 })
      }
      const externalUsers = ExternalUsersDB.getActiveForResearchPicker()
      return NextResponse.json({ externalUsers }, { headers: { 'Cache-Control': 'no-store' } })
    }

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Pristup popisu vanjskih suradnika dopušten je isključivo Administratoru.' },
        { status: 403 }
      )
    }

    const list = ExternalUsersDB.getAll().map((u) => {
      const stats = ResearchInquiriesDB.getAssignedStatsForMember(Number(u.id), u.name)
      return {
        ...u,
        assignedInquiriesCount: stats.totalCount,
        assignedActiveInquiriesCount: stats.activeCount,
      }
    })

    return NextResponse.json({ externalUsers: list }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('Error in GET /api/admin/external-users:', e)
    return NextResponse.json({ error: e.message || 'Greška poslužitelja.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { actor, isAdmin, dbUser } = await resolveInquiryCaller(request, body)
    if (!dbUser || !isAdmin) {
      return NextResponse.json(
        { error: 'Samo Administrator može dodavati vanjske suradnike.' },
        { status: 403 }
      )
    }

    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim()
    const phone = String(body.phone || '').trim()
    const organization = String(body.organization || '').trim()
    const notes = String(body.notes || '').trim()
    const accessRights = sanitizeInquiryRights(body.accessRights)

    if (!name || !email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Unesite valjano ime i prezime te e-mail adresu.' },
        { status: 400 }
      )
    }

    const tempRawPassword = crypto.randomBytes(16).toString('hex')
    const created = ExternalUsersDB.create({
      name,
      email,
      phone,
      organization,
      notes,
      passwordHash: hashPassword(tempRawPassword),
      accessRights,
      isActive: body.isActive !== false,
      createdBy: actor.name || 'Administrator',
    })

    try {
      DatabaseService.insertLog({
        userId: actor.id || 'admin',
        userName: actor.name || 'Administrator',
        userRole: 'admin',
        action: 'Dodan vanjski suradnik (Istraživanja)',
        details: `Administrator ${actor.name || 'Administrator'} dodao je vanjskog suradnika (nije član): ${created.name} (${created.email})${organization ? `, ustanova: ${organization}` : ''}.`,
      })
    } catch {}

    return NextResponse.json({ success: true, externalUser: created })
  } catch (e: any) {
    console.error('Error in POST /api/admin/external-users:', e)
    return NextResponse.json(
      { error: e.message || 'Greška pri dodavanju vanjskog suradnika.' },
      { status: 400 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { actor, isAdmin, dbUser } = await resolveInquiryCaller(request, body)
    if (!dbUser || !isAdmin) {
      return NextResponse.json(
        { error: 'Samo Administrator može uređivati vanjske suradnike.' },
        { status: 403 }
      )
    }

    const id = Number(body.id)
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Nedostaje valjani ID vanjskog suradnika.' }, { status: 400 })
    }

    const updates: Record<string, any> = {}
    if (body.name !== undefined) updates.name = String(body.name || '').trim()
    if (body.email !== undefined) updates.email = String(body.email || '').trim()
    if (body.phone !== undefined) updates.phone = String(body.phone || '').trim()
    if (body.organization !== undefined) updates.organization = String(body.organization || '').trim()
    if (body.notes !== undefined) updates.notes = String(body.notes || '').trim()
    if (body.isActive !== undefined || body.is_active !== undefined) {
      const val = body.isActive !== undefined ? body.isActive : body.is_active
      updates.is_active = val === true || val === 1 ? 1 : 0
    }
    if (body.accessRights !== undefined) {
      updates.access_rights = sanitizeInquiryRights(body.accessRights)
    }

    const updated = ExternalUsersDB.update(id, updates)

    try {
      DatabaseService.insertLog({
        userId: actor.id || 'admin',
        userName: actor.name || 'Administrator',
        userRole: 'admin',
        action: 'Ažuriran vanjski suradnik (Istraživanja)',
        details: `Administrator ${actor.name || 'Administrator'} ažurirao je podatke/prava za vanjskog suradnika ${updated.name} (${updated.email}).`,
      })
    } catch {}

    return NextResponse.json({ success: true, externalUser: updated })
  } catch (e: any) {
    console.error('Error in PATCH /api/admin/external-users:', e)
    return NextResponse.json(
      { error: e.message || 'Greška pri ažuriranju vanjskog suradnika.' },
      { status: 400 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const idParam = searchParams.get('id')
    let body: any = {}
    try {
      body = await request.json()
    } catch {}
    const { actor, isAdmin, dbUser } = await resolveInquiryCaller(request, body)
    if (!dbUser || !isAdmin) {
      return NextResponse.json(
        { error: 'Samo Administrator može brisati vanjske suradnike.' },
        { status: 403 }
      )
    }

    const id = Number(idParam || body.id)
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Nedostaje ID vanjskog suradnika.' }, { status: 400 })
    }

    const result = TrashService.trashExternalUser(id, actor)
    if (result.notFound) {
      return NextResponse.json({ error: 'Vanjski suradnik nije pronađen.' }, { status: 404 })
    }

    return NextResponse.json({ success: true, trashedId: result.trashedId })
  } catch (e: any) {
    console.error('Error in DELETE /api/admin/external-users:', e)
    return NextResponse.json(
      { error: e.message || 'Greška pri brisanju vanjskog suradnika.' },
      { status: 500 }
    )
  }
}
