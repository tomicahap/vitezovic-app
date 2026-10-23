import { NextRequest, NextResponse } from 'next/server'
import { db, getCampaignSettings, normalizeEmail, updateLead, recordSentMail } from '@/lib/mailcrawl/db'
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
    const { email, email_subject, email_body, contact_person, isResend } = body || {}

    const updatedLead = updateLead(lead.id!, {
      email: email !== undefined ? email : lead.email,
      email_subject: email_subject !== undefined ? email_subject : lead.email_subject,
      email_body: email_body !== undefined ? email_body : lead.email_body,
      contact_person: contact_person !== undefined ? contact_person : lead.contact_person
    })

    if (!updatedLead || !updatedLead.email) {
      return NextResponse.json({ ok: false, error: 'Subjekt nema e-mail adresu.' }, { status: 400 })
    }
    if (!updatedLead.email_subject || !updatedLead.email_body) {
      return NextResponse.json({ ok: false, error: 'Predmet i tekst maila ne smiju biti prazni.' }, { status: 400 })
    }

    const emailNorm = normalizeEmail(updatedLead.email)
    const alreadySent = db.prepare('SELECT * FROM sent_registry WHERE email_norm = ?').get(emailNorm) as any
    if (!isResend && (alreadySent || updatedLead.status === 'sent')) {
      return NextResponse.json({
        ok: false,
        error: `Zaštita od neželjenog duplog slanja: Na adresu ${emailNorm} je već poslan mail (${alreadySent ? alreadySent.sent_at : updatedLead.sent_at}). Ako želite ponovno poslati, koristite opciju "Pošalji ponovno".`
      }, { status: 409 })
    }

    const settings = getCampaignSettings()
    await sendDonationEmail(updatedLead, settings)

    const nowStr = new Date().toLocaleString('hr-HR')
    recordSentMail({
      leadId: updatedLead.id,
      recipientEmail: updatedLead.email,
      companyName: updatedLead.name,
      oib: updatedLead.oib,
      website: updatedLead.website,
      contactPerson: updatedLead.contact_person,
      contactRole: updatedLead.contact_role,
      subject: updatedLead.email_subject,
      body: updatedLead.email_body,
      timestamp: nowStr
    })

    const finalLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(updatedLead.id) as Lead
    return NextResponse.json({ ok: true, lead: finalLead })
  } catch (err: any) {
    const { id } = await params
    updateLead(id, { error_message: err.message })
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
