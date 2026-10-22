import { NextRequest, NextResponse } from 'next/server'
import { db, getCampaignSettings, updateLead } from '@/lib/mailcrawl/db'
import { generatePersonalizedEmail } from '@/lib/mailcrawl/ai'
import type { Lead } from '@/lib/mailcrawl/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as Lead | undefined
    if (!lead) return NextResponse.json({ ok: false, error: 'Kontakt nije pronađen.' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const { customInstruction } = body || {}
    const settings = getCampaignSettings()
    const aiRes = await generatePersonalizedEmail(lead, settings, customInstruction || '')

    const updated = updateLead(lead.id!, {
      email_subject: aiRes.subject,
      email_body: aiRes.body,
      ai_personalization_note: aiRes.personalization_note,
      activity_summary: aiRes.concise_activity || lead.activity_summary,
      status: lead.status === 'sent' ? 'sent' : 'draft_ready'
    })

    return NextResponse.json({ ok: true, lead: updated })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
