import { NextRequest, NextResponse } from 'next/server'
import { db, getCampaignSettings, recordSentMail } from '@/lib/mailcrawl/db'
import { sendDonationEmail } from '@/lib/mailcrawl/mailer'
import type { SentRegistryItem, Lead } from '@/lib/mailcrawl/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sent = db.prepare('SELECT * FROM sent_registry WHERE id = ?').get(id) as SentRegistryItem | undefined
    if (!sent) {
      return NextResponse.json({ ok: false, error: 'Zapis poslanog maila nije pronađen.' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const recipient = String(body.email || sent.recipient_email || sent.email_norm).trim()
    const subject = String(body.subject || sent.subject || 'Poziv za donaciju').trim()
    const emailBody = String(body.body || sent.body || '').trim()
    const contactPerson = String(body.contact_person || sent.contact_person || '').trim()

    if (!recipient) {
      return NextResponse.json({ ok: false, error: 'Primatelj nema važeću e-mail adresu.' }, { status: 400 })
    }
    if (!subject || !emailBody) {
      return NextResponse.json({ ok: false, error: 'Predmet i sadržaj maila ne smiju biti prazni.' }, { status: 400 })
    }

    // Build lead context for mailer
    let leadObj: Partial<Lead> = {
      name: sent.company_name || 'Poštovani',
      email: recipient,
      oib: sent.oib,
      contact_person: contactPerson,
      email_subject: subject,
      email_body: emailBody
    }

    if (sent.lead_id) {
      const realLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(sent.lead_id) as Lead | undefined
      if (realLead) {
        leadObj = { ...realLead, ...leadObj }
      }
    }

    const settings = getCampaignSettings()
    await sendDonationEmail(leadObj, settings)

    const nowStr = new Date().toLocaleString('hr-HR')
    recordSentMail({
      leadId: sent.lead_id,
      recipientEmail: recipient,
      companyName: sent.company_name || leadObj.name || '',
      oib: sent.oib,
      website: leadObj.website,
      contactPerson,
      contactRole: leadObj.contact_role,
      subject,
      body: emailBody,
      timestamp: nowStr
    })

    const updatedSent = db.prepare('SELECT * FROM sent_registry WHERE id = ?').get(sent.id)
    return NextResponse.json({
      ok: true,
      message: `Mail uspješno ponovno poslan na ${recipient}!`,
      sentItem: updatedSent
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
