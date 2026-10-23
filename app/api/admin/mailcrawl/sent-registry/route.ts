import { NextRequest, NextResponse } from 'next/server'
import { db, recordDonation } from '@/lib/mailcrawl/db'

export async function GET() {
  try {
    const rows = db.prepare('SELECT * FROM sent_registry ORDER BY id DESC').all()
    return NextResponse.json(rows)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { action, sentId, leadId, donorName, donatedAmount, donatedAt, donationNote } = body || {}

    if (action === 'record_donation') {
      if (!donatedAmount) {
        return NextResponse.json({ error: 'Unesite iznos donacije.' }, { status: 400 })
      }
      const res = recordDonation({
        sentId: Number(sentId) || undefined,
        leadId: Number(leadId) || undefined,
        donorName: donorName || '',
        donatedAmount: String(donatedAmount),
        donatedAt: donatedAt || new Date().toISOString().split('T')[0],
        donationNote: donationNote || ''
      })
      const updatedSent = sentId ? db.prepare('SELECT * FROM sent_registry WHERE id = ?').get(sentId) : null
      return NextResponse.json({ ok: true, sentItem: updatedSent, res })
    }

    return NextResponse.json({ error: 'Nepoznata akcija.' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
