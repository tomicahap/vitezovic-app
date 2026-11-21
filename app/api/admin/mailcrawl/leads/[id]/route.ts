import { NextRequest, NextResponse } from 'next/server'
import { db, updateLead } from '@/lib/mailcrawl/db'
import { TrashService, extractActor } from '@/lib/trash'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response
  try {
    const { id } = await params
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id)
    if (!lead) return NextResponse.json({ ok: false, error: 'Kontakt nije pronađen.' }, { status: 404 })
    return NextResponse.json(lead)
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const updated = updateLead(id, body || {})
    if (!updated) return NextResponse.json({ ok: false, error: 'Kontakt nije pronađen.' }, { status: 404 })
    return NextResponse.json({ ok: true, lead: updated })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response
  try {
    const { id } = await params
    const actor = extractActor(req)
    TrashService.trashMailcrawlLead(id, actor)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
