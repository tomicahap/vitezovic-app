import { NextRequest, NextResponse } from 'next/server'
import { getCampaignSettings } from '@/lib/mailcrawl/db'
import { createSmtpTransporter, composeEmailContent } from '@/lib/mailcrawl/mailer'

export async function POST(req: NextRequest) {
  let settings: any = {}
  try {
    const body = await req.json().catch(() => ({}))
    settings = { ...getCampaignSettings(), ...(body.settings || body || {}) }
    const recipient = (body.recipient || settings.sender_email || 'rodoslovlje@rodoslovlje.hr').trim()

    if (!recipient || !recipient.includes('@')) {
      return NextResponse.json({ ok: false, error: 'Unesite valjanu e-mail adresu za primanje testnog maila.' }, { status: 400 })
    }
    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
      return NextResponse.json({ ok: false, error: 'Unesite SMTP poslužitelj, korisničko ime i lozinku prije slanja testnog maila.' }, { status: 400 })
    }

    const transporter = createSmtpTransporter(settings)

    // Build sample content using composeEmailContent
    const sampleLead = {
      name: 'Testni Primatelj',
      email: recipient,
      email_subject: '[TEST] Provjera SMTP postavki donacija - Hrvatsko rodoslovno društvo',
      email_body: `Poštovani,\n\nOvo je testni e-mail poslan iz modula za donacije i kampanje aplikacije Hrvatskog rodoslovnog društva.\n\nDetalji poslužitelja:\n• Poslužitelj (Host): ${settings.smtp_host}\n• Port: ${settings.smtp_port} (Sigurna veza: ${settings.smtp_secure})\n• Prijavljeni korisnik: ${settings.smtp_user}\n• Vrijeme slanja: ${new Date().toLocaleString('hr-HR')}\n\nAko vidite ovu poruku, Vaše SMTP postavke su u potpunosti ispravne i spremne za rad!`
    }

    const { html, plainText, barcodeBuffer, logoAttachment } = await composeEmailContent(sampleLead, settings, true)

    const attachments: any[] = []
    if (barcodeBuffer && String(settings.include_hub3_barcode) !== 'false') {
      attachments.push({
        filename: 'donacija-2d-barkod.png',
        content: barcodeBuffer,
        cid: 'hub3barcode@rodoslovlje.hr',
        contentType: 'image/png'
      })
    }
    if (logoAttachment) {
      attachments.push(logoAttachment)
    }

    const senderEmail = (settings.sender_email || settings.smtp_user || 'rodoslovlje@rodoslovlje.hr').trim()
    const senderName = (settings.sender_name || 'Hrvatsko rodoslovno društvo').trim()

    await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: recipient,
      subject: sampleLead.email_subject,
      text: plainText,
      html,
      attachments
    })

    return NextResponse.json({
      ok: true,
      message: `Testni e-mail je uspješno poslan na adresu: ${recipient}`
    })
  } catch (err: any) {
    let friendlyMessage = err?.message || 'Greška pri slanju testnog e-maila'
    const host = (settings.smtp_host || '').toLowerCase()

    if (err?.code === 'EAUTH' || /535|authentication|badcredentials|invalid login/i.test(friendlyMessage)) {
      if (host.includes('gmail')) {
        friendlyMessage = 'Autentifikacija nije uspjela (535): Netočna lozinka ili korisničko ime. Za Gmail morate koristiti "Lozinku aplikacije" (Google App Password od 16 znakova), a ne običnu lozinku Google računa.'
      } else {
        friendlyMessage = `Autentifikacija nije uspjela (535): Netočna lozinka ili korisničko ime za račun "${settings.smtp_user}". Provjerite pristupne podatke poslužitelja ${settings.smtp_host}.`
      }
    } else if (err?.code === 'ETIMEDOUT' || /timeout|esocket/i.test(friendlyMessage)) {
      friendlyMessage = `Vrijeme čekanja veze je isteklo (${settings.smtp_host}:${settings.smtp_port}). Provjerite jesu li poslužitelj i port točni te blokira li vatrozid odlazne SMTP veze.`
    } else if (err?.code === 'ENOTFOUND') {
      friendlyMessage = `Poslužitelj "${settings.smtp_host}" nije pronađen (DNS greška). Provjerite upisani Host.`
    } else if (err?.code === 'ECONNREFUSED') {
      friendlyMessage = `Veza na ${settings.smtp_host}:${settings.smtp_port} je odbijena. Provjerite je li port ispravan (npr. 465 za SSL, 587 za STARTTLS).`
    }

    return NextResponse.json({
      ok: false,
      error: friendlyMessage,
      raw: err?.message,
      code: err?.code
    }, { status: 400 })
  }
}
