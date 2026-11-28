import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService, LibraryDB, getAppDb } from '@/lib/database'
import { extractActor } from '@/lib/trash'
import { parseAccessRights } from '@/lib/inquiry-permissions'
import { generateLibraryBooksPdfBuffer } from '@/lib/library-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function resolveLibraryViewer(request: NextRequest, body?: any) {
  const actor = extractActor(request, body)
  const roleLower = (actor.role || '').trim().toLowerCase()
  const hasId = Boolean(actor.id && actor.id !== 'unknown')
  const emailLower = (actor.email || '').trim().toLowerCase()

  if (roleLower === 'admin' || roleLower === 'moderator') {
    return { actor, authorized: true }
  }

  if (!hasId && !emailLower) {
    return { actor, authorized: false, unauthenticated: true }
  }

  const db = getAppDb()
  const numericId = Number(actor.id)
  let member: any = null

  if (hasId && Number.isFinite(numericId) && numericId > 0) {
    member = db
      .prepare('SELECT id, name, email, role, access_rights FROM members WHERE id = ? LIMIT 1')
      .get(numericId)
  }
  if (!member && emailLower) {
    member = db
      .prepare('SELECT id, name, email, role, access_rights FROM members WHERE lower(trim(email)) = ? LIMIT 1')
      .get(emailLower)
  }

  if (!member) {
    return { actor, authorized: false, unauthenticated: true }
  }

  const memberRole = String(member.role || '').trim().toLowerCase()
  if (memberRole === 'admin' || memberRole === 'moderator') {
    return {
      actor: { ...actor, id: String(member.id), name: member.name || actor.name, role: member.role },
      authorized: true,
    }
  }

  const rights = parseAccessRights(member.access_rights)
  const canViewLibrary = rights.library?.view === true || rights.library?.edit === true
  return {
    actor: { ...actor, id: String(member.id), name: member.name || actor.name, role: member.role || 'member' },
    authorized: canViewLibrary,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const auth = await resolveLibraryViewer(request, body)
    if (auth.unauthenticated) {
      return NextResponse.json({ error: 'Potrebna je prijava u sustav.' }, { status: 401 })
    }
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Nemate ovlast za izvoz kataloga knjižnice.' }, { status: 403 })
    }

    const scope: 'all' | 'filtered' = body.scope === 'filtered' ? 'filtered' : 'all'
    const bookIds: number[] = Array.isArray(body.bookIds)
      ? body.bookIds.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n) && n > 0)
      : []
    const filterLabel = String(body.filterLabel || 'Cijeli katalog knjiga').trim()

    let books = LibraryDB.getAllBooks()
    const isFiltered = scope === 'filtered'
    if (isFiltered) {
      const idSet = new Set(bookIds)
      books = books.filter((b: any) => idSet.has(Number(b.id)))
    }

    books.sort((a: any, b: any) => {
      const numA = typeof a.broj === 'number' && !Number.isNaN(a.broj) ? a.broj : Number.MAX_SAFE_INTEGER
      const numB = typeof b.broj === 'number' && !Number.isNaN(b.broj) ? b.broj : Number.MAX_SAFE_INTEGER
      if (numA !== numB) return numA - numB
      return Number(a.id || 0) - Number(b.id || 0)
    })

    const generatedBy = auth.actor.name || 'Korisnik'
    const pdfBuffer = generateLibraryBooksPdfBuffer({
      books,
      filterLabel: isFiltered ? filterLabel : 'Cijeli katalog knjiga',
      generatedBy,
      generatedAt: new Date(),
    })

    try {
      DatabaseService.insertLog({
        userId: auth.actor.id || 'admin',
        userName: generatedBy,
        userRole: auth.actor.role || 'member',
        action: 'Izvoz knjiga (PDF)',
        details: `Izvezen PDF katalog knjižnice (${books.length} knjiga, obuhvat: ${
          isFiltered ? filterLabel : 'Cijeli katalog knjiga'
        }).`,
        timestamp: new Date().toISOString(),
      })
    } catch {}

    const todayIso = new Date().toISOString().slice(0, 10)
    const fileName = `HRD_Knjiznica_Knjige_${todayIso}${isFiltered ? '_filtrirano' : ''}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    console.error('Error in POST /api/library/export/pdf:', e)
    return NextResponse.json(
      { error: e?.message || 'Greška pri generiranju PDF kataloga knjiga.' },
      { status: 500 }
    )
  }
}
