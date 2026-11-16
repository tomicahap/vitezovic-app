import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'
import { SettingsService } from '@/src/services/settings-service'
import { buildHrdMasterEmail, formatHrdEmailDate, HrdEmailTemplateTypeId } from '@/lib/hrd-email-system'

export async function POST(request: NextRequest) {
  try {
    const config = await request.json()

    if (!config.smtpHost || !config.smtpFrom) {
      return NextResponse.json({ error: 'Nedostaju podaci za slanje (Host i From).' }, { status: 400 })
    }

    const settingsService = new SettingsService()
    const settings = await settingsService.getSettings()
    const mergedSettings = { ...(settings || {}), ...config }

    const built = buildHrdMasterEmail({
      templateType: 'sluzbena_obavijest',
      title: 'Testni e-mail za provjeru SMTP i vizualnog identiteta HRD',
      greeting: 'Poštovani,',
      bodyTextOrHtml:
        'Ovo je testni e-mail kojim se potvrđuje da su SMTP poslužitelj, službeni HRD vizualni identitet (#343C32 / #A17B50 / #EAE1D1), postojeći službeni HRD logotip i standardizirani potpis ispravno povezani.',
      infoBoxTitle: 'Tehnička potvrda sustava',
      infoBoxHtml: `<div>SMTP poslužitelj: <strong>${config.smtpHost}:${config.smtpPort || 587}</strong><br/>Pošiljatelj: <strong>${config.smtpFrom}</strong><br/>Datum provjere: <strong>${formatHrdEmailDate(new Date())}</strong></div>`,
      closingText: 'Hvala što koristite sustav „Rodoslovac”.',
      settings: mergedSettings,
    })

    const targetRecipient = config.testRecipient?.trim() || config.smtpFrom

    await sendEmail({
      to: targetRecipient,
      subject: '[TEST] HRD „Pavao Ritter Vitezović” — Provjera SMTP i HTML predloška',
      body: built.plainText,
      html: built.html,
      attachments: built.inlineAttachments,
      config: {
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        smtpPass: config.smtpPass,
        smtpSecure: config.smtpSecure ? 1 : 0,
        smtpFrom: config.smtpFrom,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Testni e-mail uspješno je poslan na ${targetRecipient}.`,
      warnings: built.warnings,
    })
  } catch (error: any) {
    console.error('Test email error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'payment'
    const toOverride = searchParams.get('to')?.trim()

    const settingsService = new SettingsService()
    const settings: any = await settingsService.getSettings()

    if (!settings || !settings.smtpFrom) {
      return NextResponse.json({ error: 'SMTP nije konfiguriran.' }, { status: 400 })
    }

    const todayStr = formatHrdEmailDate(new Date())
    let subject = ''
    let body = ''
    let templateType: HrdEmailTemplateTypeId = 'sluzbena_obavijest'
    let infoBoxTitle = ''
    let infoBoxHtml = ''

    if (type === 'payment') {
      templateType = 'obavijest_clanovima'
      subject = settings.paymentEmailSubject || 'Obavijest o članarini'
      body = (settings.paymentEmailBody || '').replace(/{{name}}/gi, 'Ivan Horvat')
      infoBoxTitle = 'Evidencija članarine (Testni prikaz)'
      infoBoxHtml = `<div>Član: <strong>Ivan Horvat</strong> • Datum izrade: <strong>${todayStr}</strong></div>`
    } else if (type === 'invitation') {
      templateType = 'informacije_clanstvo'
      subject = settings.invitationEmailSubject || 'Pozivnica za pristup sustavu HRD'
      body = (settings.invitationEmailBody || '')
        .replace('{email}', 'test@rodoslovlje.hr')
        .replace('{tempPassword}', 'Privremena123')
        .replace('{link}', 'https://rodoslovlje.hr')
      infoBoxTitle = 'Podaci za prijavu (Testni prikaz)'
      infoBoxHtml = `<div>Korisničko ime: <strong>test@rodoslovlje.hr</strong><br/>Privremena lozinka: <strong>Privremena123</strong></div>`
    } else if (type === 'poll') {
      templateType = 'sluzbena_obavijest'
      subject = (settings.pollEmailSubject || 'Obavezno glasovanje: {pollTitle}').replace('{pollTitle}', 'Testno glasovanje')
      body = (settings.pollEmailBody || '')
        .replace('{pollTitle}', 'Testno glasovanje')
        .replace('{link}', 'https://rodoslovlje.hr')
      infoBoxTitle = 'Naziv odluke za glasovanje'
      infoBoxHtml = `<div><strong>Testno glasovanje</strong> • Datum: ${todayStr}</div>`
    } else if (type === 'meeting') {
      templateType = 'poziv_sjednica'
      subject = (settings.meetingNotificationSubject || 'Sazvana je nova sjednica: [NASLOV]').replace(/\[NASLOV\]|\{NASLOV\}/g, 'Testna sjednica')
      body = (settings.meetingNotificationBody || '')
        .replace(/\[NASLOV\]|\{NASLOV\}/g, 'Testna sjednica')
        .replace(/\[DATUM\]|\{DATUM\}/g, todayStr)
        .replace(/\[VRIJEME\]|\{VRIJEME\}/g, '19:00')
        .replace(/\[LOKACIJA\]|\{LOKACIJA\}/g, 'Zagreb / Online')
        .replace(/\[LINK\]|\{LINK\}/g, 'https://rodoslovlje.hr')
      infoBoxTitle = 'Podaci o sjednici'
      infoBoxHtml = `<div>Datum: <strong>${todayStr}</strong> u <strong>19:00</strong> • Lokacija: <strong>Zagreb / Online</strong></div>`
    } else if (type === 'lecture') {
      templateType = 'poziv_predavanje'
      subject = (settings.lectureNotificationSubject || 'Novo predavanje: [NASLOV]').replace(/\[NASLOV\]|\{NASLOV\}/g, 'Testno predavanje')
      body = (settings.lectureNotificationBody || '')
        .replace(/\[NASLOV\]|\{NASLOV\}/g, 'Testno predavanje')
        .replace(/\[DATUM\]|\{DATUM\}/g, todayStr)
        .replace(/\[VRIJEME\]|\{VRIJEME\}/g, '19:00')
        .replace(/\[LOKACIJA\]|\{LOKACIJA\}/g, 'Zagreb')
        .replace(/\[PREDAVAČ\]|\{PREDAVAČ\}/g, 'dr. sc. Ivan Horvat')
        .replace(/\[LINK\]|\{LINK\}/g, 'https://rodoslovlje.hr')
      infoBoxTitle = 'Detalji predavanja'
      infoBoxHtml = `<div>Predavač: <strong>dr. sc. Ivan Horvat</strong> • Datum: <strong>${todayStr}</strong> u <strong>19:00</strong></div>`
    } else if (type === 'birthday') {
      templateType = 'obavijest_clanovima'
      subject = (settings.birthdayEmailSubject || 'Sretan rođendan!').replace(/{{name}}/gi, 'Ivan Horvat')
      body = (settings.birthdayEmailBody || '').replace(/{{name}}/gi, 'Ivan Horvat')
      infoBoxTitle = 'Rođendanska čestitka'
      infoBoxHtml = `<div>Slavljenik: <strong>Ivan Horvat</strong> • Datum: <strong>${todayStr}</strong></div>`
    } else if (type === 'missing-data') {
      templateType = 'obavijest_clanovima'
      subject = (settings.missingDataEmailSubject || 'Zamolba za dopunu podataka').replace(/{{name}}/gi, 'Ivan Horvat')
      body = (settings.missingDataEmailBody || '')
        .replace(/{{name}}/gi, 'Ivan Horvat')
        .replace(/{{missingFields}}/gi, '- OIB\n- Mjesto rođenja\n- Lokacije i prezimena koja istražuje')
        .replace(/{{formLink}}/gi, 'https://rodoslovlje.hr/dopuna-podataka/test-token')
      infoBoxTitle = 'Podaci za dopunu (Testni prikaz)'
      infoBoxHtml = `<div>Nedostaju: <strong>OIB, Mjesto rođenja, Lokacije i prezimena koja istražuje</strong></div>`
    } else {
      return NextResponse.json({ error: 'Nepoznat tip predloška.' }, { status: 400 })
    }

    const built = buildHrdMasterEmail({
      templateType,
      title: subject,
      bodyTextOrHtml: body,
      infoBoxTitle,
      infoBoxHtml,
      settings,
    })

    const targetRecipient = toOverride || settings.smtpFrom

    await sendEmail({
      to: targetRecipient,
      subject: '[TEST] ' + subject,
      body: built.plainText,
      html: built.html,
      config: settings,
      attachments: built.inlineAttachments,
    })

    return NextResponse.json({
      success: true,
      message: `Testni e-mail poslan na ${targetRecipient}.`,
      warnings: built.warnings,
    })
  } catch (error: any) {
    console.error('Test template error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
