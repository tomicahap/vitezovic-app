import { NextResponse } from 'next/server'
import { db } from '@/lib/mailcrawl/db'

export async function GET() {
  try {
    const total = (db.prepare('SELECT COUNT(*) as c FROM leads').get() as any).c
    const newCount = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'new'").get() as any).c
    const draftCount = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'draft_ready'").get() as any).c
    const sentCount = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'sent'").get() as any).c
    const donorCount = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'donor'").get() as any).c
    const rejectedCount = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'rejected'").get() as any).c
    const registrySentTotal = (db.prepare('SELECT COUNT(*) as c FROM sent_registry').get() as any).c

    const donorRows = db.prepare("SELECT donated_amount FROM leads WHERE status = 'donor' AND donated_amount != ''").all() as any[]
    let totalDonatedEur = 0
    for (const r of donorRows) {
      const num = parseFloat(String(r.donated_amount).replace(',', '.'))
      if (!isNaN(num)) totalDonatedEur += num
    }

    const byType = {
      tvrtka: (db.prepare("SELECT COUNT(*) as c FROM leads WHERE entity_type = 'tvrtka'").get() as any).c,
      obrt: (db.prepare("SELECT COUNT(*) as c FROM leads WHERE entity_type = 'obrt'").get() as any).c,
      udruga: (db.prepare("SELECT COUNT(*) as c FROM leads WHERE entity_type = 'udruga'").get() as any).c
    }

    return NextResponse.json({
      total,
      newCount,
      draftCount,
      sentCount,
      donorCount,
      totalDonatedEur: Math.round(totalDonatedEur * 100) / 100,
      rejectedCount,
      registrySentTotal,
      byType
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
