import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'
import { SettingsService } from '@/src/services/settings-service'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const { type, item, recipients, customSubject, customBody } = payload

    if (!type || !item || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'Nedostaju obavezni parametri (type, item, recipients).' }, { status: 400 })
    }

    const settingsService = new SettingsService()
    const settings: any = await settingsService.getSettings()

    if (!settings || !settings.smtpFrom || !settings.smtpHost) {
      return NextResponse.json({ error: 'SMTP poslužitelj nije konfiguriran u postavkama sustava.' }, { status: 400 })
    }

    let defaultSubject = ''
    let defaultBody = ''

    if (type === 'meeting') {
      if (item.status === 'completed') {
        defaultSubject = settings.meetingSummarySubject || 'Zapisnik i detalji sa sjednice: [NASLOV]'
        defaultBody = settings.meetingSummaryBody || 'Poštovani,\n\nOvim putem Vas obavještavamo da je sjednica uspješno završena te su u sustavu dostupni zapisnik i detalji.\n\nNaziv: [NASLOV]\nDatum održavanja: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\n\nSrdačan pozdrav!'
      } else {
        defaultSubject = settings.meetingNotificationSubject || 'Sazvana je nova sjednica: [NASLOV]'
        defaultBody = settings.meetingNotificationBody || 'Poštovani,\n\nOvim putem Vas obavještavamo da je u sustavu evidentirana nova sjednica.\n\nNaziv: [NASLOV]\nDatum i vrijeme: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\n\nSrdačan pozdrav!'
      }
      
      defaultSubject = defaultSubject.replace(/\[NASLOV\]/g, item.title || '')
      defaultBody = defaultBody
        .replace(/\[NASLOV\]/g, item.title || '')
        .replace(/\[DATUM\]/g, item.date || '')
        .replace(/\[VRIJEME\]/g, item.time || '')
        .replace(/\[LOKACIJA\]/g, item.location || '')
    } else if (type === 'lecture') {
      if (item.status === 'completed') {
        defaultSubject = settings.lectureSummarySubject || 'Održano predavanje: [NASLOV]'
        defaultBody = settings.lectureSummaryBody || 'Poštovani,\n\nPredavanje je uspješno održano te su u sustavu dostupni podaci i prilozi.\n\nNaziv predavanja: [NASLOV]\nDatum održavanja: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\nPredavač: [PREDAVAČ]\n\nSrdačan pozdrav!'
      } else {
        defaultSubject = settings.lectureNotificationSubject || 'Novo predavanje: [NASLOV]'
        defaultBody = settings.lectureNotificationBody || 'Poštovani,\n\nZadovoljstvo nam je najaviti novo predavanje.\n\nNaziv predavanja: [NASLOV]\nDatum i vrijeme: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\nPredavač: [PREDAVAČ]\n\nSrdačan pozdrav!'
      }
      
      defaultSubject = defaultSubject.replace(/\[NASLOV\]/g, item.title || '')
      defaultBody = defaultBody
        .replace(/\[NASLOV\]/g, item.title || '')
        .replace(/\[DATUM\]/g, item.date || '')
        .replace(/\[VRIJEME\]/g, item.time || '')
        .replace(/\[LOKACIJA\]/g, item.location || '')
        .replace(/\[PREDAVAČ\]/g, item.host || '')
    } else {
      return NextResponse.json({ error: 'Nepoznat tip obavijesti.' }, { status: 400 })
    }

    const finalSubject = customSubject?.trim() || defaultSubject
    const finalBody = customBody?.trim() || defaultBody

    // Normaliziraj listu email adresa
    const emailList: { email: string; name?: string }[] = recipients.map(r => {
      if (typeof r === 'string') return { email: r }
      return { email: r.email, name: r.name }
    }).filter(r => r.email && r.email.includes('@'))

    if (emailList.length === 0) {
      return NextResponse.json({ error: 'Niti jedan odabrani primatelj nema valjanu email adresu.' }, { status: 400 })
    }

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: #1e3a8a; color: #ffffff; padding: 24px 32px; }
    .header h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 6px 0 0; font-size: 13px; color: #93c5fd; }
    .content { padding: 32px; }
    .text { font-size: 14px; color: #334155; margin-bottom: 24px; white-space: pre-wrap; }
    .footer { font-size: 13px; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>Hrvatsko rodoslovno društvo</h2>
      <p>"Pavao Ritter Vitezović" — Službena obavijest</p>
    </div>
    <div class="content">
      <div class="text">${finalBody.replace(/\n/g, '<br>')}</div>
      <div class="footer">
        Hrvatsko rodoslovno društvo "Pavao Ritter Vitezović"<br>
        <span style="font-size: 12px; color: #94a3b8;">Tajništvo Društva</span>
      </div>
    </div>
  </div>
</body>
</html>`

    const sendPromises = emailList.map(({ email }) => {
      return sendEmail({
        to: email,
        subject: finalSubject,
        body: finalBody,
        html: htmlBody,
        config: {
          smtpHost: settings.smtpHost!,
          smtpPort: settings.smtpPort || 587,
          smtpUser: settings.smtpUser || '',
          smtpPass: settings.smtpPass || '',
          smtpSecure: settings.smtpSecure ? 1 : 0,
          smtpFrom: settings.smtpFrom!
        }
      })
    })

    const results = await Promise.allSettled(sendPromises)
    const failed = results.filter(r => r.status === 'rejected')
    const successCount = results.length - failed.length

    if (failed.length > 0 && failed.length === emailList.length) {
      const firstError = (failed[0] as PromiseRejectedResult).reason?.message || 'Greška u SMTP poslužitelju.'
      return NextResponse.json({ 
        error: `Niti jedan e-mail nije poslan! ${firstError}` 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: `Uspješno poslano (${successCount}/${emailList.length}) obavijest(i).`,
      sentCount: successCount,
      failedCount: failed.length,
      sentAt: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Board notification email error:', error)
    return NextResponse.json({ error: error.message || 'Došlo je do greške prilikom slanja e-mailova.' }, { status: 500 })
  }
}
