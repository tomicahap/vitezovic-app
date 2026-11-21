import { NextRequest, NextResponse } from 'next/server'
import { updateLead } from '@/lib/mailcrawl/db'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response
  try {
    const { id } = await params
    const updated = updateLead(id, { status: 'rejected' })
    if (!updated) return NextResponse.json({ ok: false, error: 'Kontakt nije pronađen.' }, { status: 404 })
    return NextResponse.json({ ok: true, lead: updated })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
