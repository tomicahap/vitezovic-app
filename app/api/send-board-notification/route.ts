import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'
import { SettingsService } from '@/src/services/settings-service'
import { DatabaseService } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const { type, item, recipients, customSubject, customBody, sender } = payload

    if (!type || !item || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'Nedostaju obavezni parametri (type, item, recipients).' }, { status: 400 })
    }

    const settingsService = new SettingsService()
    const settings: any = await settingsService.getSettings()

    if (!settings || !settings.smtpFrom || !settings.smtpHost) {
      return NextResponse.json({ error: 'SMTP poslužitelj nije konfiguriran u postavkama sustava.' }, { status: 400 })
    }

    const isMeeting = type === 'meeting'
    const isGathering = !isMeeting && (item.type === 'gathering' || item.title?.toLowerCase().includes('druženje') || item.title?.toLowerCase().includes('druzenje'))

    const originHeader = request.headers.get('origin')
    const hostHeader = request.headers.get('host')
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    const serverOrigin = originHeader || (hostHeader ? `${proto}://${hostHeader}` : 'https://vitezovic.hr')

    let defaultSubject = ''
    let defaultBody = ''

    if (isMeeting) {
      if (item.status === 'completed') {
        defaultSubject = settings.meetingSummarySubject || 'Zapisnik i detalji sa sjednice: [NASLOV]'
        defaultBody = settings.meetingSummaryBody || 'Poštovane članice i članovi tijela Društva,\n\nOvim putem Vas obavještavamo da je sjednica uspješno završena te su u sustavu dostupni zapisnik i detalji.\n\nNaziv: [NASLOV]\nDatum održavanja: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\n\nPoveznica za prijavu u sustav: [LINK]\n\nSrdačan pozdrav,\nIzvršni odbor HRD "Pavao Ritter Vitezović"'
      } else {
        defaultSubject = settings.meetingNotificationSubject || 'Sazvana je nova sjednica: [NASLOV]'
        defaultBody = settings.meetingNotificationBody || 'Poštovane članice i članovi tijela Društva,\n\nPozivamo Vas na sjednicu koja će se održati prema sljedećim podacima:\n\nNaziv sjednice: [NASLOV]\nDatum i vrijeme: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\n\nMolimo Vas da svoj dolazak potvrdite ili se prijavite u sustav radi uvida u dnevni red.\n\nPoveznica za prijavu u sustav: [LINK]\n\nSrdačan pozdrav,\nIzvršni odbor HRD "Pavao Ritter Vitezović"'
      }
      
      defaultSubject = defaultSubject.replace(/\[NASLOV\]/g, item.title || '')
      defaultBody = defaultBody
        .replace(/\[NASLOV\]/g, item.title || '')
        .replace(/\[DATUM\]/g, item.date || '')
        .replace(/\[VRIJEME\]/g, item.time || '—')
        .replace(/\[LOKACIJA\]/g, item.location || 'Online')
        .replace(/\[LINK\]/g, serverOrigin)
    } else if (isGathering) {
      defaultSubject = item.title && item.title.trim().toLowerCase() !== "rodoslovno druženje"
        ? `Obavijest o rodoslovnom druženju: ${item.title}`
        : "Obavijest o rodoslovnom druženju"

      if (item.status === 'completed') {
        defaultBody = 'Poštovane članice i članovi tijela Društva,\n\nRodoslovno druženje je uspješno održano te su u sustavu dostupni sažetak i materijali.\n\nNaziv: [NASLOV]\nDatum održavanja: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\n\nPoveznica za prijavu u sustav: [LINK]\n\nSrdačan pozdrav,\nHRD "Pavao Ritter Vitezović"'
      } else {
        defaultBody = 'Poštovane članice i članovi tijela Društva,\n\nZadovoljstvo nam je najaviti rodoslovno druženje:\n\nNaziv: [NASLOV]\nDatum i vrijeme: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\n\nRadujemo se Vašem dolasku.\n\nPoveznica za prijavu u sustav: [LINK]\n\nSrdačan pozdrav,\nHRD "Pavao Ritter Vitezović"'
      }

      defaultBody = defaultBody
        .replace(/\[NASLOV\]/g, item.title || '')
        .replace(/\[DATUM\]/g, item.date || '')
        .replace(/\[VRIJEME\]/g, item.time || '—')
        .replace(/\[LOKACIJA\]/g, item.location || 'Online')
        .replace(/\[LINK\]/g, serverOrigin)
    } else if (type === 'lecture') {
      if (item.status === 'completed') {
        defaultSubject = settings.lectureSummarySubject || 'Održano predavanje: [NASLOV]'
        defaultBody = settings.lectureSummaryBody || 'Poštovane članice i članovi tijela Društva,\n\nPredavanje je uspješno održano te su u sustavu dostupni podaci i prilozi.\n\nNaziv predavanja: [NASLOV]\nDatum održavanja: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\nPredavač: [PREDAVAČ]\n\nPoveznica za prijavu u sustav: [LINK]\n\nSrdačan pozdrav,\nHRD "Pavao Ritter Vitezović"'
      } else {
        defaultSubject = settings.lectureNotificationSubject || 'Novo predavanje: [NASLOV]'
        defaultBody = settings.lectureNotificationBody || 'Poštovane članice i članovi tijela Društva,\n\nZadovoljstvo nam je najaviti novo predavanje.\n\nNaziv predavanja: [NASLOV]\nDatum i vrijeme: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\nPredavač: [PREDAVAČ]\n\nRadujemo se Vašem dolasku!\n\nPoveznica za prijavu u sustav: [LINK]\n\nSrdačan pozdrav,\nHRD "Pavao Ritter Vitezović"'
      }
      
      defaultSubject = defaultSubject.replace(/\[NASLOV\]/g, item.title || '')
      defaultBody = defaultBody
        .replace(/\[NASLOV\]/g, item.title || '')
        .replace(/\[DATUM\]/g, item.date || '')
        .replace(/\[VRIJEME\]/g, item.time || '—')
        .replace(/\[LOKACIJA\]/g, item.location || 'Online')
        .replace(/\[PREDAVAČ\]/g, item.host || '—')
        .replace(/\[LINK\]/g, serverOrigin)
    } else {
      return NextResponse.json({ error: 'Nepoznat tip obavijesti.' }, { status: 400 })
    }

    let finalSubject = customSubject?.trim() || defaultSubject
    if (isGathering) {
      // Naslov za rodoslovno druženje mora biti ISKLJUČIVO "Obavijest o rodoslovnom druženju"
      finalSubject = "Obavijest o rodoslovnom druženju"
    }
    const finalBody = customBody?.trim() || defaultBody

    // Normaliziraj listu email adresa
    const emailList: { email: string; name?: string }[] = recipients.map(r => {
      if (typeof r === 'string') return { email: r }
      return { email: r.email, name: r.name }
    }).filter(r => r.email && r.email.includes('@'))

    if (emailList.length === 0) {
      return NextResponse.json({ error: 'Niti jedan odabrani primatelj nema valjanu email adresu.' }, { status: 400 })
    }

    const loginUrlMatch = finalBody.match(/https?:\/\/[^\s<]+/)
    const loginUrl = loginUrlMatch ? loginUrlMatch[0] : serverOrigin

    const cleanBodyText = finalBody
      .replace(/Poveznica za prijavu u sustav:\s*https?:\/\/[^\s<]+/gi, '')
      .replace(/Poveznica za prijavu u sustav:\s*\[LINK\]/gi, '')
      .trim()

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1B2B36; background-color: #F2EFE9; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E8E4DE; overflow: hidden; box-shadow: 0 4px 20px rgba(27, 43, 54, 0.08); }
    .header { background: #1B2B36; color: #ffffff; padding: 26px 32px; border-bottom: 3px solid #CEA369; }
    .header h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; color: #ffffff; }
    .header p { margin: 6px 0 0; font-size: 13px; color: #CEA369; font-weight: 500; }
    .content { padding: 32px; }
    .text { font-size: 14px; color: #1B2B36; line-height: 1.7; white-space: pre-wrap; margin-bottom: 24px; }
    .btn-container { text-align: center; margin: 32px 0 28px; }
    .btn { display: inline-block; background-color: #1B2B36; color: #ffffff !important; text-decoration: none; padding: 13px 36px; border-radius: 9999px; font-weight: 700; font-size: 14px; letter-spacing: 0.03em; border: 2px solid #CEA369; box-shadow: 0 4px 14px rgba(27, 43, 54, 0.25); }
    .footer { font-size: 13px; color: #6B7280; border-top: 1px solid #E8E4DE; padding-top: 20px; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>Hrvatsko rodoslovno društvo</h2>
      <p>"Pavao Ritter Vitezović" — Službena obavijest</p>
    </div>
    <div class="content">
      <div class="text">${cleanBodyText
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" style="color: #1B2B36; font-weight: 700; text-decoration: underline;">$1</a>')
        .replace(/\n/g, '<br>')}</div>
      <div class="btn-container">
        <a href="${loginUrl}" class="btn" target="_blank">Prijavite se u sustav &rarr;</a>
      </div>
      <div class="footer">
        Hrvatsko rodoslovno društvo "Pavao Ritter Vitezović"<br>
        <span style="font-size: 12px; color: #9CA3AF;">Izvršni odbor Društva</span>
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

    const now = new Date().toISOString()

    // Trajno bilježenje u bazu activity_logs: kome i kada je poslan mail
    try {
      const recipientSummary = emailList.length <= 4 
        ? emailList.map(r => r.name ? `${r.name} (${r.email})` : r.email).join(', ')
        : `${emailList.slice(0, 3).map(r => r.name ? `${r.name} (${r.email})` : r.email).join(', ')} i još ${emailList.length - 3} primatelja`

      const actionTitle = isMeeting ? 'Slanje obavijesti o sjednici' : (isGathering ? 'Slanje obavijesti o rodoslovnom druženju' : 'Slanje obavijesti o predavanju')
      const detailsMsg = `Poslana e-mail obavijest za: "${item.title}" (${item.date || '—'}). Uspješno poslano: ${successCount}/${emailList.length}. Primatelji: ${recipientSummary}. Predmet: "${finalSubject}"`

      DatabaseService.insertLog({
        userId: sender?.userId || 'system',
        userName: sender?.userName || 'Administrator',
        userRole: sender?.userRole || 'admin',
        action: actionTitle,
        details: detailsMsg,
        timestamp: now
      })
    } catch (dbErr) {
      console.error('Greška pri upisu u activity_logs za board notification:', dbErr)
    }

    return NextResponse.json({ 
      success: true, 
      message: `Uspješno poslano (${successCount}/${emailList.length}) obavijest(i).`,
      sentCount: successCount,
      failedCount: failed.length,
      sentAt: now
    })

  } catch (error: any) {
    console.error('Board notification email error:', error)
    return NextResponse.json({ error: error.message || 'Došlo je do greške prilikom slanja e-mailova.' }, { status: 500 })
  }
}
