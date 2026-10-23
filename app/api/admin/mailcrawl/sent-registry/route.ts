import { NextRequest, NextResponse } from 'next/server'
import { 
  db, 
  recordDonation, 
  markSentItemInvalidEmail, 
  updateSentItemEmail, 
  unmarkSentItemInvalidEmail 
} from '@/lib/mailcrawl/db'

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
    const { action, id, sentId, leadId, donorName, donatedAmount, donorAmount, donatedAt, donorDate, donationNote, donorNote, reason, newEmail } = body || {}

    const targetSentId = Number(id || sentId) || undefined

    if (action === 'record_donation') {
      const amount = donatedAmount || donorAmount
      if (!amount) {
        return NextResponse.json({ error: 'Unesite iznos donacije.' }, { status: 400 })
      }
      const res = recordDonation({
        sentId: targetSentId,
        leadId: Number(leadId) || undefined,
        donorName: donorName || '',
        donatedAmount: String(amount),
        donatedAt: donatedAt || donorDate || new Date().toISOString().split('T')[0],
        donationNote: donationNote || donorNote || ''
      })
      const updatedSent = targetSentId ? db.prepare('SELECT * FROM sent_registry WHERE id = ?').get(targetSentId) : null
      return NextResponse.json({ ok: true, sentItem: updatedSent, res })
    }

    if (action === 'mark_invalid_email') {
      if (!targetSentId) {
        return NextResponse.json({ error: 'Nedostaje ID zapisa.' }, { status: 400 })
      }
      const updated = markSentItemInvalidEmail(targetSentId, reason)
      return NextResponse.json({ ok: true, item: updated })
    }

    if (action === 'update_email') {
      if (!targetSentId || !newEmail) {
        return NextResponse.json({ error: 'Nedostaje ID ili nova e-mail adresa.' }, { status: 400 })
      }
      try {
        const updated = updateSentItemEmail(targetSentId, newEmail)
        return NextResponse.json({ ok: true, item: updated })
      } catch (validationErr: any) {
        return NextResponse.json({ error: validationErr.message || 'Neispravna e-mail adresa.' }, { status: 400 })
      }
    }

    if (action === 'unmark_invalid_email') {
      if (!targetSentId) {
        return NextResponse.json({ error: 'Nedostaje ID zapisa.' }, { status: 400 })
      }
      const updated = unmarkSentItemInvalidEmail(targetSentId)
      return NextResponse.json({ ok: true, item: updated })
    }

    return NextResponse.json({ error: 'Nepoznata akcija.' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
