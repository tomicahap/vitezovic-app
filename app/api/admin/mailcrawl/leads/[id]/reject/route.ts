import { NextRequest, NextResponse } from 'next/server'
import { updateLead } from '@/lib/mailcrawl/db'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const updated = updateLead(id, { status: 'rejected' })
    if (!updated) return NextResponse.json({ ok: false, error: 'Kontakt nije pronađen.' }, { status: 404 })
    return NextResponse.json({ ok: true, lead: updated })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
