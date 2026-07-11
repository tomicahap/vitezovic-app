import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'
import { SettingsService } from '@/src/services/settings-service'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const { type, item, recipients } = payload

    if (!type || !item || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'Nedostaju obavezni parametri (type, item, recipients).' }, { status: 400 })
    }

    const settingsService = new SettingsService()
    const settings = await settingsService.getSettings()

    if (!settings || !settings.smtpFrom || !settings.smtpHost) {
      return NextResponse.json({ error: 'SMTP server nije konfiguriran u postavkama.' }, { status: 400 })
    }

    let subject = ''
    let body = ''

    if (type === 'meeting') {
      if (item.status === 'completed') {
        subject = settings.meetingSummarySubject || 'Zapisnik i detalji sa sjednice: [NASLOV]'
        body = settings.meetingSummaryBody || 'Poštovani,\n\nOvim putem Vas obavještavamo da je sjednica uspješno završena te su u sustavu dostupni zapisnik i detalji.\n\nNaziv: [NASLOV]\nDatum održavanja: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\n\nSrdačan pozdrav!'
      } else {
        subject = settings.meetingNotificationSubject || 'Sazvana je nova sjednica: [NASLOV]'
        body = settings.meetingNotificationBody || 'Poštovani,\n\nOvim putem Vas obavještavamo da je u sustavu evidentirana nova sjednica.\n\nNaziv: [NASLOV]\nDatum i vrijeme: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\n\nSrdačan pozdrav!'
      }
      
      subject = subject.replace(/\[NASLOV\]/g, item.title || '')
      body = body
        .replace(/\[NASLOV\]/g, item.title || '')
        .replace(/\[DATUM\]/g, item.date || '')
        .replace(/\[VRIJEME\]/g, item.time || '')
        .replace(/\[LOKACIJA\]/g, item.location || '')
    } else if (type === 'lecture') {
      if (item.status === 'completed') {
        subject = settings.lectureSummarySubject || 'Održano predavanje: [NASLOV]'
        body = settings.lectureSummaryBody || 'Poštovani,\n\nPredavanje je uspješno održano te su u sustavu dostupni podaci i prilozi.\n\nNaziv predavanja: [NASLOV]\nDatum održavanja: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\nPredavač: [PREDAVAČ]\n\nSrdačan pozdrav!'
      } else {
        subject = settings.lectureNotificationSubject || 'Novo predavanje: [NASLOV]'
        body = settings.lectureNotificationBody || 'Poštovani,\n\nZadovoljstvo nam je najaviti novo predavanje.\n\nNaziv predavanja: [NASLOV]\nDatum i vrijeme: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\nPredavač: [PREDAVAČ]\n\nSrdačan pozdrav!'
      }
      
      subject = subject.replace(/\[NASLOV\]/g, item.title || '')
      body = body
        .replace(/\[NASLOV\]/g, item.title || '')
        .replace(/\[DATUM\]/g, item.date || '')
        .replace(/\[VRIJEME\]/g, item.time || '')
        .replace(/\[LOKACIJA\]/g, item.location || '')
        .replace(/\[PREDAVAČ\]/g, item.host || '')
    } else {
      return NextResponse.json({ error: 'Nepoznat tip obavijesti.' }, { status: 400 })
    }

    // Send emails in parallel
    const sendPromises = recipients.map(email => {
      return sendEmail({
        to: email,
        subject: subject,
        body: body,
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

    if (failed.length > 0 && failed.length === recipients.length) {
      return NextResponse.json({ error: 'Niti jedan e-mail nije uspješno poslan. Provjerite SMTP postavke.' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: `Uspješno poslano (${results.length - failed.length}/${results.length}).`,
      failedCount: failed.length
    })

  } catch (error: any) {
    console.error('Board notification email error:', error)
    return NextResponse.json({ error: error.message || 'Došlo je do greške prilikom slanja e-mailova.' }, { status: 500 })
  }
}
