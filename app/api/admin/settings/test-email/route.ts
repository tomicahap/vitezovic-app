import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'
import { SettingsService } from '@/src/services/settings-service'
import { buildHrdMasterEmail, formatHrdEmailDate, HrdEmailTemplateTypeId } from '@/lib/hrd-email-system'
import {
  buildEventInfoBoxHtml,
  getDefaultEventEmailContent,
  stripDuplicateEventMetaLines,
} from '@/lib/event-email-templates'
import {
  DEFAULT_MISSING_DATA_EMAIL_BODY,
  SINGLE_USE_LINK_EMAIL_NOTICE_HTML,
  ensureSingleUseNoticeInBody,
} from '@/lib/member-missing-fields'
import { DoNotContactBlockedError } from '@/lib/do-not-contact'

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
        'Ovo je testni e-mail kojim se potvrđuje da su SMTP poslužitelj, službeni HRD vizualni identitet (#1E3A5F / #7C2D12 / #D97706 / #FEFCE8 / #F8FAFC) i standardizirani potpis ispravno povezani.',
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
    if (error instanceof DoNotContactBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Test email error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'payment'
    const toOverride = searchParams.get('to')?.trim()
    const previewOnly = searchParams.get('preview') === '1'

    const settingsService = new SettingsService()
    const settings: any = await settingsService.getSettings()

    if (!previewOnly && (!settings || !settings.smtpFrom)) {
      return NextResponse.json({ error: 'SMTP nije konfiguriran.' }, { status: 400 })
    }

    const todayStr = formatHrdEmailDate(new Date())
    let subject = ''
    let body = ''
    let templateType: HrdEmailTemplateTypeId = 'sluzbena_obavijest'
    let infoBoxTitle = ''
    let infoBoxHtml = ''
    let ctaText: string | undefined
    let ctaUrl: string | undefined

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
      const rawPollBody =
        settings.pollEmailBody ||
        'Poštovane članice i članovi tijela Društva,\n\nobavještavamo Vas da je u sustavu „Rodoslovac” otvoreno novo elektroničko glasovanje.\n\nDetaljan tekst prijedloga i mogućnost glasovanja dostupni su nakon prijave u sustav „Rodoslovac”.'
      body = stripDuplicateEventMetaLines(
        rawPollBody
          .replace('{pollTitle}', 'Testno glasovanje')
          .replace('{link}', 'https://rodoslovlje.hr')
      )
      infoBoxTitle = 'Predmet glasovanja'
      infoBoxHtml = `<div><strong>Testno glasovanje</strong> • Datum objave: ${todayStr}</div><div style="margin-top: 6px; color: #475569;">Svi detalji prijedloga i elektronički glasački listić dostupni su nakon prijave u sustav <strong>Rodoslovac</strong>.</div>`
      ctaText = 'Prijavi se u Rodoslovac i glasuj'
      ctaUrl = 'https://rodoslovlje.hr'
    } else if (type === 'meeting') {
      const sampleMeeting = {
        title: 'Testna sjednica Izvršnog odbora',
        date: todayStr,
        time: '19:00',
        location: 'Zagreb / Online',
        status: 'scheduled',
      }
      const defaults = getDefaultEventEmailContent('meeting', sampleMeeting)
      templateType = defaults.templateType
      subject = (settings.meetingNotificationSubject || defaults.subject).replace(/\[NASLOV\]|\{NASLOV\}/g, sampleMeeting.title)
      const cleanedMeetingBody = stripDuplicateEventMetaLines(
        (settings.meetingNotificationBody || '')
          .replace(/\[NASLOV\]|\{NASLOV\}/g, sampleMeeting.title)
          .replace(/\[DATUM\]|\{DATUM\}/g, todayStr)
          .replace(/\[VRIJEME\]|\{VRIJEME\}/g, '19:00')
          .replace(/\[LOKACIJA\]|\{LOKACIJA\}/g, 'Zagreb / Online')
          .replace(/\[LINK\]|\{LINK\}/g, 'https://rodoslovlje.hr')
      )
      body = cleanedMeetingBody || defaults.body
      infoBoxTitle = defaults.infoBoxTitle
      infoBoxHtml = buildEventInfoBoxHtml({
        type: 'meeting',
        item: sampleMeeting,
        forBrowserPreview: true,
      })
      ctaText = 'Prijavi se u Rodoslovac'
      ctaUrl = 'https://rodoslovlje.hr'
    } else if (type === 'lecture') {
      const sampleLecture = {
        title: 'Testno predavanje',
        type: 'lecture',
        date: todayStr,
        time: '19:00',
        location: 'Zagreb',
        host: 'dr. sc. Ivan Horvat',
        status: 'scheduled',
      }
      const defaults = getDefaultEventEmailContent('lecture', sampleLecture)
      templateType = defaults.templateType
      subject = (settings.lectureNotificationSubject || defaults.subject).replace(/\[NASLOV\]|\{NASLOV\}/g, sampleLecture.title)
      const cleanedLectureBody = stripDuplicateEventMetaLines(
        (settings.lectureNotificationBody || '')
          .replace(/\[NASLOV\]|\{NASLOV\}/g, sampleLecture.title)
          .replace(/\[DATUM\]|\{DATUM\}/g, todayStr)
          .replace(/\[VRIJEME\]|\{VRIJEME\}/g, '19:00')
          .replace(/\[LOKACIJA\]|\{LOKACIJA\}/g, 'Zagreb')
          .replace(/\[PREDAVAČ\]|\{PREDAVAČ\}/g, 'dr. sc. Ivan Horvat')
          .replace(/\[LINK\]|\{LINK\}/g, 'https://rodoslovlje.hr')
      )
      body = cleanedLectureBody || defaults.body
      infoBoxTitle = defaults.infoBoxTitle
      infoBoxHtml = buildEventInfoBoxHtml({
        type: 'lecture',
        item: sampleLecture,
        forBrowserPreview: true,
      })
      ctaText = 'Prijavi se u Rodoslovac'
      ctaUrl = 'https://rodoslovlje.hr'
    } else if (type === 'birthday') {
      templateType = 'obavijest_clanovima'
      subject = (settings.birthdayEmailSubject || 'Sretan rođendan!').replace(/{{name}}/gi, 'Ivan Horvat')
      body = (settings.birthdayEmailBody || '').replace(/{{name}}/gi, 'Ivan Horvat')
      infoBoxTitle = 'Rođendanska čestitka'
      infoBoxHtml = `<div>Slavljenik: <strong>Ivan Horvat</strong> • Datum: <strong>${todayStr}</strong></div>`
    } else if (type === 'missing-data') {
      templateType = 'obavijest_clanovima'
      subject = (settings.missingDataEmailSubject || 'Zamolba za dopunu podataka').replace(/{{name}}/gi, 'Ivan Horvat')
      body = ensureSingleUseNoticeInBody(
        (settings.missingDataEmailBody || DEFAULT_MISSING_DATA_EMAIL_BODY)
          .replace(/{{name}}/gi, 'Ivan Horvat')
          .replace(/{{missingFields}}/gi, '- OIB\n- Mjesto rođenja\n- Lokacije i prezimena koja istražuje')
          .replace(/{{formLink}}/gi, 'https://rodoslovlje.hr/dopuna-podataka/test-jednokratna-poveznica')
      )
      infoBoxTitle = 'Podaci za dopunu (Testni prikaz)'
      infoBoxHtml = `<div>Nedostaju: <strong>OIB, Mjesto rođenja, Lokacije i prezimena koja istražuje</strong></div>${SINGLE_USE_LINK_EMAIL_NOTICE_HTML}`
    } else {
      return NextResponse.json({ error: 'Nepoznat tip predloška.' }, { status: 400 })
    }

    const built = buildHrdMasterEmail({
      templateType,
      title: subject,
      bodyTextOrHtml: body,
      infoBoxTitle,
      infoBoxHtml,
      ctaText,
      ctaUrl,
      settings,
      forBrowserPreview: previewOnly,
    })

    if (previewOnly) {
      return NextResponse.json({
        success: true,
        subject,
        html: built.html,
        warnings: built.warnings,
      })
    }

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
    if (error instanceof DoNotContactBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Test template error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
