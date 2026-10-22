import { NextRequest, NextResponse } from 'next/server'
import { db, getCampaignSettings } from '@/lib/mailcrawl/db'
import { sendDonationEmail } from '@/lib/mailcrawl/mailer'
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
    const { testEmail, email_subject, email_body } = body || {}
    const settings = getCampaignSettings()
    const targetEmail = (testEmail || settings.sender_email || 'rodoslovlje@rodoslovlje.hr').trim()

    const tempLead = {
      ...lead,
      email_subject: email_subject || lead.email_subject,
      email_body: email_body || lead.email_body
    }

    await sendDonationEmail(tempLead, settings, targetEmail)
    return NextResponse.json({ ok: true, message: `Testni mail uspješno poslan na ${targetEmail}!` })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
