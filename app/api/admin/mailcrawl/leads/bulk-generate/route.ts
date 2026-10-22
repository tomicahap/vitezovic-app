import { NextRequest, NextResponse } from 'next/server'
import { db, getCampaignSettings, updateLead } from '@/lib/mailcrawl/db'
import { generatePersonalizedEmail } from '@/lib/mailcrawl/ai'
import type { Lead } from '@/lib/mailcrawl/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { ids } = body || {}
    let leadsToProcess: Lead[] = []

    if (Array.isArray(ids) && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',')
      leadsToProcess = db.prepare(`SELECT * FROM leads WHERE id IN (${placeholders}) AND status != 'sent'`).all(...ids) as Lead[]
    } else {
      leadsToProcess = db.prepare("SELECT * FROM leads WHERE status = 'new'").all() as Lead[]
    }

    const settings = getCampaignSettings()
    let generated = 0
    for (const lead of leadsToProcess) {
      const aiRes = await generatePersonalizedEmail(lead, settings)
      updateLead(lead.id!, {
        email_subject: aiRes.subject,
        email_body: aiRes.body,
        ai_personalization_note: aiRes.personalization_note,
        activity_summary: aiRes.concise_activity || lead.activity_summary,
        status: 'draft_ready'
      })
      generated++
    }

    return NextResponse.json({ ok: true, generated })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
