import { NextRequest, NextResponse } from 'next/server'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'
import { addOptOut, listOptOuts, removeOptOut } from '@/lib/mailcrawl/db'
import { DatabaseService } from '@/lib/database'

export async function GET(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response

  try {
    return NextResponse.json({ ok: true, items: listOptOuts() })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Greška pri dohvatu liste odjava.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const { email, website, oib, companyName, reason } = body || {}
    const item = addOptOut({ email, website, oib, companyName, reason })

    try {
      DatabaseService.insertLog({
        userId: auth.actor.id || 'system',
        userName: auth.actor.name || 'Administrator',
        userRole: auth.actor.role || 'admin',
        action: 'Dodana odjava (Donacije)',
        details: `Subjekt "${item.company_name || item.email_norm || item.domain_norm}" dodan je na listu odjava (Ne kontaktirati). Razlog: ${item.reason}`,
        timestamp: new Date().toISOString(),
      })
    } catch {}

    return NextResponse.json({ ok: true, item })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Greška pri dodavanju na listu odjava.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(req.url)
    let id = searchParams.get('id')
    if (!id) {
      const body = await req.json().catch(() => ({}))
      id = body?.id ? String(body.id) : null
    }
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Nedostaje ID zapisa za uklanjanje.' }, { status: 400 })
    }
    const removed = removeOptOut(id)
    if (!removed) {
      return NextResponse.json({ ok: false, error: 'Zapis nije pronađen.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Greška pri brisanju iz liste odjava.' }, { status: 500 })
  }
}
