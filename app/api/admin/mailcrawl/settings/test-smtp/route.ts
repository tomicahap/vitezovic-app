import { NextRequest, NextResponse } from 'next/server'
import { getCampaignSettings } from '@/lib/mailcrawl/db'
import { verifySmtpConnection } from '@/lib/mailcrawl/mailer'

export async function POST(req: NextRequest) {
  let settings: any = {}
  try {
    const body = await req.json().catch(() => ({}))
    settings = { ...getCampaignSettings(), ...(body || {}) }

    if (!settings.smtp_host || !settings.smtp_host.trim()) {
      return NextResponse.json({ ok: false, error: 'Unesite SMTP poslužitelj (Host).' }, { status: 400 })
    }
    if (!settings.smtp_user || !settings.smtp_user.trim()) {
      return NextResponse.json({ ok: false, error: 'Unesite korisničko ime / email za SMTP.' }, { status: 400 })
    }
    if (!settings.smtp_pass || !settings.smtp_pass.trim()) {
      return NextResponse.json({ ok: false, error: 'Unesite lozinku za SMTP poslužitelj.' }, { status: 400 })
    }

    await verifySmtpConnection(settings)
    return NextResponse.json({ ok: true, message: 'SMTP veza uspješno uspostavljena!' })
  } catch (err: any) {
    let friendlyMessage = err?.message || 'Greška pri provjeri SMTP poslužitelja'
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

    return NextResponse.json({
      ok: false,
      error: friendlyMessage,
      raw: err?.message,
      code: err?.code
    }, { status: 400 })
  }
}
