import { NextRequest, NextResponse } from 'next/server'
import { db, getCampaignSettings } from '@/lib/mailcrawl/db'
import { sendDonationEmail } from '@/lib/mailcrawl/mailer'
import type { Lead } from '@/lib/mailcrawl/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let settings: any = {}
  try {
    const { id } = await params
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as Lead | undefined
    if (!lead) return NextResponse.json({ ok: false, error: 'Kontakt nije pronađen.' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const { testEmail, email_subject, email_body, contact_person, email } = body || {}
    settings = getCampaignSettings()
    const targetEmail = (testEmail || settings.sender_email || 'rodoslovlje@rodoslovlje.hr').trim()

    if (!targetEmail || !targetEmail.includes('@')) {
      return NextResponse.json({ ok: false, error: 'Unesite valjanu e-mail adresu za primanje testnog maila.' }, { status: 400 })
    }

    const tempLead = {
      ...lead,
      contact_person: contact_person !== undefined ? contact_person : lead.contact_person,
      email: email || lead.email,
      email_subject: email_subject || lead.email_subject,
      email_body: email_body || lead.email_body
    }

    await sendDonationEmail(tempLead, settings, targetEmail)
    return NextResponse.json({ ok: true, message: `Testni mail uspješno poslan na ${targetEmail}!` })
  } catch (err: any) {
    let friendlyMessage = err?.message || 'Greška pri slanju testnog e-maila'
    const host = (settings.smtp_host || '').toLowerCase()

    if (err?.code === 'EAUTH' || /535|authentication|badcredentials|invalid login/i.test(friendlyMessage)) {
      if (host.includes('gmail')) {
        friendlyMessage = 'Autentifikacija nije uspjela (535): Netočna lozinka ili korisničko ime. Za Gmail morate koristiti "Lozinku aplikacije" (Google App Password od 16 znakova), a ne običnu lozinku Google računa.'
      } else {
        friendlyMessage = `Autentifikacija nije uspjela (535): Netočna lozinka ili korisničko ime za račun "${settings.smtp_user}". Provjerite pristupne podatke.`
      }
    } else if (err?.code === 'ETIMEDOUT' || /timeout|esocket/i.test(friendlyMessage)) {
      friendlyMessage = `Vrijeme čekanja veze je isteklo (${settings.smtp_host}:${settings.smtp_port}). Provjerite jesu li poslužitelj i port točni te blokira li vatrozid odlazne SMTP veze.`
    } else if (err?.code === 'ENOTFOUND') {
      friendlyMessage = `Poslužitelj "${settings.smtp_host}" nije pronađen (DNS greška). Provjerite upisani Host.`
    } else if (err?.code === 'ECONNREFUSED') {
      friendlyMessage = `Veza na ${settings.smtp_host}:${settings.smtp_port} je odbijena. Provjerite je li port ispravan (npr. 465 za SSL, 587 za STARTTLS).`
    }

    return NextResponse.json({ ok: false, error: friendlyMessage, raw: err?.message }, { status: 500 })
  }
}
