import { NextRequest, NextResponse } from 'next/server'
import { db, getCampaignSettings, getDailySentCount } from '@/lib/mailcrawl/db'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'

export async function GET(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const total = (db.prepare('SELECT COUNT(*) as c FROM leads').get() as any).c
    const newCount = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'new'").get() as any).c
    const draftCount = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'draft_ready'").get() as any).c
    const sentCount = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'sent'").get() as any).c
    const donorCount = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'donor'").get() as any).c
    const rejectedCount = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'rejected'").get() as any).c
    const registrySentTotal = (db.prepare('SELECT COUNT(*) as c FROM sent_registry').get() as any).c
    const optOutCount = (db.prepare('SELECT COUNT(*) as c FROM opt_out_registry').get() as any).c

    const donorRows = db.prepare("SELECT donated_amount FROM leads WHERE status = 'donor' AND donated_amount != ''").all() as any[]
    let totalDonatedEur = 0
    for (const r of donorRows) {
      const num = parseFloat(String(r.donated_amount).replace(',', '.'))
      if (!isNaN(num)) totalDonatedEur += num
    }

    const byType = {
      tvrtka: (db.prepare("SELECT COUNT(*) as c FROM leads WHERE entity_type = 'tvrtka'").get() as any).c,
      obrt: (db.prepare("SELECT COUNT(*) as c FROM leads WHERE entity_type = 'obrt'").get() as any).c,
      udruga: (db.prepare("SELECT COUNT(*) as c FROM leads WHERE entity_type = 'udruga'").get() as any).c,
    }

    const settings = getCampaignSettings()
    const parsedLimit = parseInt(String(settings.bulk_send_daily_limit || '150'), 10)
    const dailyLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 150

    return NextResponse.json({
      total,
      newCount,
      draftCount,
      remainingCount: newCount + draftCount,
      sentCount,
      donorCount,
      totalDonatedEur: Math.round(totalDonatedEur * 100) / 100,
      rejectedCount,
      registrySentTotal,
      optOutCount,
      dailySentCount: getDailySentCount(),
      dailyLimit,
      serperConfigured: Boolean((settings.serper_api_key || process.env.SERPER_API_KEY || '').trim()),
      byType,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
