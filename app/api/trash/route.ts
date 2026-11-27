import { NextRequest, NextResponse } from 'next/server'
import { TrashService, extractActor, ENTITY_TYPE_LABELS } from '@/lib/trash'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function isAdminRequest(request: NextRequest, body?: any): { isAdmin: boolean; actor: ReturnType<typeof extractActor> } {
  const actor = extractActor(request, body)
  const roleLower = (actor.role || '').trim().toLowerCase()
  const authHeader = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim().toLowerCase()
  const headerRole = (request.headers.get('x-user-role') || '').trim().toLowerCase()
  const isAdmin = roleLower === 'admin' || authHeader === 'admin' || headerRole === 'admin'
  return { isAdmin, actor }
}

export async function GET(request: NextRequest) {
  const { isAdmin } = isAdminRequest(request)
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Pristup odbijen. Smeće vidi jedino administrator.' },
      { status: 403 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'trashed'
    const entityType = searchParams.get('entityType') || 'all'
    const search = searchParams.get('search') || ''

    const items = TrashService.getAll({ status, entityType, search })
    const counts = TrashService.getCounts()

    return NextResponse.json({
      items,
      counts,
      labels: ENTITY_TYPE_LABELS,
    })
  } catch (error: any) {
    console.error('[Trash GET Error]:', error)
    return NextResponse.json(
      { error: error?.message || 'Greška pri dohvaćanju smeća.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  let body: any = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const { isAdmin, actor } = isAdminRequest(request, body)
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Pristup odbijen. Samo administrator može upravljati stavkama u smeću.' },
      { status: 403 }
    )
  }

  try {
    const { action, id, ids } = body

    if (action === 'restore') {
      if (!id) {
        return NextResponse.json({ error: 'Nedostaje ID stavke u smeću.' }, { status: 400 })
      }
      const result = await TrashService.restoreTrashItem(Number(id), actor)
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Vraćanje nije uspjelo.' }, { status: 400 })
      }
      return NextResponse.json(result)
    }

    if (action === 'permanent_delete') {
      if (!id || !Number.isFinite(Number(id)) || Number(id) <= 0) {
        return NextResponse.json({ error: 'Nedostaje valjani ID stavke u smeću.' }, { status: 400 })
      }
      const result = TrashService.permanentlyDeleteTrashItem(Number(id), actor)
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Trajno brisanje nije uspjelo.' }, { status: 400 })
      }
      return NextResponse.json(result)
    }

    if (action === 'permanent_delete_bulk') {
      if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: 'Odaberite barem jednu stavku za trajno brisanje.' }, { status: 400 })
      }
      const result = TrashService.permanentlyDeleteTrashItems(ids, actor)
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Skupno trajno brisanje nije uspjelo.' }, { status: 400 })
      }
      return NextResponse.json(result)
    }

    if (action === 'empty_trash') {
      const result = TrashService.emptyTrash(actor)
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Pražnjenje smeća nije uspjelo.' }, { status: 400 })
      }
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Nepoznata akcija.' }, { status: 400 })
  } catch (error: any) {
    console.error('[Trash POST Error]:', error)
    return NextResponse.json(
      { error: error?.message || 'Greška pri obradi zahtjeva u smeću.' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  let body: any = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const { isAdmin, actor } = isAdminRequest(request, body)
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Pristup odbijen. Samo administrator može trajno brisati stavke iz smeća.' },
      { status: 403 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const emptyAll = searchParams.get('all') === '1' || body?.action === 'empty_trash'
    if (emptyAll) {
      const result = TrashService.emptyTrash(actor)
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Pražnjenje smeća nije uspjelo.' }, { status: 400 })
      }
      return NextResponse.json(result)
    }

    if (Array.isArray(body?.ids) && body.ids.length > 0) {
      const result = TrashService.permanentlyDeleteTrashItems(body.ids, actor)
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Skupno trajno brisanje nije uspjelo.' }, { status: 400 })
      }
      return NextResponse.json(result)
    }

    const rawId = searchParams.get('id') || body?.id
    if (!rawId || !Number.isFinite(Number(rawId)) || Number(rawId) <= 0) {
      return NextResponse.json({ error: 'Nedostaje valjani ID stavke u smeću.' }, { status: 400 })
    }

    const result = TrashService.permanentlyDeleteTrashItem(Number(rawId), actor)
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Trajno brisanje nije uspjelo.' }, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Trash DELETE Error]:', error)
    return NextResponse.json(
      { error: error?.message || 'Greška pri trajnom brisanju iz smeća.' },
      { status: 500 }
    )
  }
}
