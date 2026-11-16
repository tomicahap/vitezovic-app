import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'
import { SettingsService } from '@/src/services/settings-service'
import { DatabaseService } from '@/lib/database'
import { MemberService } from '@/src/services/member-service'
import { MeetingService } from '@/src/services/meeting-service'
import { generateEventPdfBuffer } from '@/lib/event-pdf'
import { inferCityFromLocationOrTitle } from '@/lib/croatia-cities'
import { buildHrdMasterEmail, escapeHtml, formatHrdEmailDate, formatHrdEmailTime, HrdEmailTemplateTypeId } from '@/lib/hrd-email-system'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const { type, item, recipients, customSubject, customBody, sender, testOnly, testEmail } = payload

    if (!type || !item || (!testOnly && (!recipients || !Array.isArray(recipients) || recipients.length === 0))) {
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
    const serverOrigin = originHeader || (hostHeader ? `${proto}://${hostHeader}` : 'https://cms.rodoslovlje.hr')

    let defaultSubject = ''
    let defaultBody = ''

    const formattedItemDate = item.date ? formatHrdEmailDate(item.date) : '—'
    const formattedItemTime = formatHrdEmailTime(item.time || item.start_time) || '—'

    if (isMeeting) {
      if (item.status === 'completed') {
        defaultSubject = settings.meetingSummarySubject || 'Zapisnik i detalji sa sjednice: [NASLOV]'
        defaultBody = settings.meetingSummaryBody || 'Poštovane članice i članovi tijela Društva,\n\nOvim putem Vas obavještavamo da je sjednica uspješno završena te su u sustavu dostupni zapisnik i detalji.\n\nNaziv: [NASLOV]\nDatum održavanja: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\n\nPoveznica za prijavu u sustav: [LINK]'
      } else {
        defaultSubject = settings.meetingNotificationSubject || 'Sazvana je nova sjednica: [NASLOV]'
        defaultBody = settings.meetingNotificationBody || 'Poštovane članice i članovi tijela Društva,\n\nPozivamo Vas na sjednicu koja će se održati prema sljedećim podacima:\n\nNaziv sjednice: [NASLOV]\nDatum i vrijeme: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\n\nMolimo Vas da svoj dolazak potvrdite ili se prijavite u sustav radi uvida u dnevni red.\n\nPoveznica za prijavu u sustav: [LINK]'
      }
      
      defaultSubject = defaultSubject.replace(/\[NASLOV\]/g, item.title || '')
      defaultBody = defaultBody
        .replace(/\[NASLOV\]/g, item.title || '')
        .replace(/\[DATUM\]/g, formattedItemDate)
        .replace(/\[VRIJEME\]/g, formattedItemTime)
        .replace(/\[LOKACIJA\]/g, item.location || 'Online')
        .replace(/\[LINK\]/g, serverOrigin)
    } else if (isGathering) {
      defaultSubject = "Obavijest o rodoslovnom druženju"

      if (item.status === 'completed') {
        defaultBody = 'Poštovane članice i članovi tijela Društva,\n\nRodoslovno druženje je uspješno održano te su u sustavu dostupni sažetak i materijali.\n\nNaziv: [NASLOV]\nDatum održavanja: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\n\nPoveznica za prijavu u sustav: [LINK]'
      } else {
        defaultBody = 'Poštovane članice i članovi tijela Društva,\n\nZadovoljstvo nam je najaviti rodoslovno druženje:\n\nNaziv: [NASLOV]\nDatum i vrijeme: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\n\nRadujemo se Vašem dolasku.\n\nPoveznica za prijavu u sustav: [LINK]'
      }

      defaultBody = defaultBody
        .replace(/\[NASLOV\]/g, item.title || '')
        .replace(/\[DATUM\]/g, formattedItemDate)
        .replace(/\[VRIJEME\]/g, formattedItemTime)
        .replace(/\[LOKACIJA\]/g, item.location || 'Online')
        .replace(/\[LINK\]/g, serverOrigin)
    } else if (type === 'lecture') {
      if (item.status === 'completed') {
        defaultSubject = settings.lectureSummarySubject || 'Održano predavanje: [NASLOV]'
        defaultBody = settings.lectureSummaryBody || 'Poštovane članice i članovi tijela Društva,\n\nPredavanje je uspješno održano te su u sustavu dostupni podaci i prilozi.\n\nNaziv predavanja: [NASLOV]\nDatum održavanja: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\nPredavač: [PREDAVAČ]\n\nPoveznica za prijavu u sustav: [LINK]'
      } else {
        defaultSubject = settings.lectureNotificationSubject || 'Novo predavanje: [NASLOV]'
        defaultBody = settings.lectureNotificationBody || 'Poštovane članice i članovi tijela Društva,\n\nZadovoljstvo nam je najaviti novo predavanje.\n\nNaziv predavanja: [NASLOV]\nDatum i vrijeme: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\nPredavač: [PREDAVAČ]\n\nRadujemo se Vašem dolasku!\n\nPoveznica za prijavu u sustav: [LINK]'
      }
      
      defaultSubject = defaultSubject.replace(/\[NASLOV\]/g, item.title || '')
      defaultBody = defaultBody
        .replace(/\[NASLOV\]/g, item.title || '')
        .replace(/\[DATUM\]/g, formattedItemDate)
        .replace(/\[VRIJEME\]/g, formattedItemTime)
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
    const emailList: { email: string; name?: string }[] = testOnly
      ? [{ email: testEmail?.trim() || settings.smtpFrom, name: 'Testni primatelj' }]
      : (recipients || []).map((r: any) => {
          if (typeof r === 'string') return { email: r }
          return { email: r.email, name: r.name }
        }).filter((r: any) => r.email && r.email.includes('@'))

    if (emailList.length === 0) {
      return NextResponse.json({ error: 'Niti jedan odabrani primatelj nema valjanu email adresu.' }, { status: 400 })
    }

    const targetId = item.id ? Number(item.id) : null

    // ─── Generiraj službeni A4 PDF dokument kao privitak uz obavijest ─────
    let pdfBuffer: Buffer | null = null
    let pdfFilename = ''

    try {
      let fullItem = { ...item }
      let members: any[] = []
      let polls: any[] = []
      const pollVotes: Record<number, any[]> = {}
      let logs: any[] = []

      try {
        const memberService = new MemberService()
        members = await memberService.getAllMembers()
      } catch {}

      if (isMeeting && targetId) {
        try {
          const meetingService = new MeetingService()
          const dbMeeting = await meetingService.getMeeting(targetId)
          if (dbMeeting) fullItem = { ...dbMeeting, ...item }
        } catch {
          const dbMeeting = DatabaseService.getMeeting(targetId)
          if (dbMeeting) fullItem = { ...dbMeeting, ...item }
        }

        try {
          const allPolls = DatabaseService.getPolls() || []
          polls = allPolls
            .filter((p: any) => Number(p.meeting_id) === targetId)
            .map((p: any) => ({
              ...p,
              options: typeof p.options === 'string' ? JSON.parse(p.options || '[]') : p.options || []
            }))
          for (const p of polls) {
            pollVotes[p.id] = DatabaseService.getVotesForPoll(Number(p.id)) || []
          }
        } catch {}
      } else if (targetId) {
        try {
          const rawLecture = (DatabaseService as any).getLecture(targetId)
          if (rawLecture) {
            let attendee_ids = []
            let attachments = []
            let hosts = []
            try { attendee_ids = typeof rawLecture.attendee_ids === 'string' ? JSON.parse(rawLecture.attendee_ids || '[]') : rawLecture.attendee_ids || [] } catch {}
            try { attachments = typeof rawLecture.attachments === 'string' ? JSON.parse(rawLecture.attachments || '[]') : rawLecture.attachments || [] } catch {}
            try { hosts = typeof rawLecture.hosts === 'string' ? JSON.parse(rawLecture.hosts || '[]') : rawLecture.hosts || [] } catch {}
            const resolvedCity = rawLecture.city && rawLecture.city.trim() ? rawLecture.city.trim() : inferCityFromLocationOrTitle(rawLecture.location, rawLecture.title) || null
            fullItem = { ...rawLecture, city: resolvedCity, attendee_ids, attachments, hosts, ...item }
          }
        } catch {}
      }

      try {
        const allLogs = DatabaseService.getLogs() || []
        const marker = `[ID:${type}:${targetId}]`
        logs = allLogs.filter((l: any) => l.details && String(l.details).includes(marker))
      } catch {}

      pdfBuffer = generateEventPdfBuffer({
        type: isMeeting ? 'meeting' : 'lecture',
        item: fullItem,
        members,
        polls,
        pollVotes,
        logs,
      })

      const safeTitle = String(fullItem.title || `${type}_${targetId || 'dokument'}`)
        .replace(/[čć]/gi, 'c')
        .replace(/[ž]/gi, 'z')
        .replace(/[š]/gi, 's')
        .replace(/[đ]/gi, 'd')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .slice(0, 50)

      const prefix = isMeeting
        ? (fullItem.status === 'completed' ? 'Zapisnik_sjednice' : 'Sjednica')
        : (isGathering ? 'Rodoslovno_druzenje' : 'Predavanje')

      pdfFilename = `${prefix}_${safeTitle}.pdf`
    } catch (pdfErr) {
      console.error('Greška pri generiranju PDF priloga uz obavijest:', pdfErr)
    }

    const emailAttachments: any[] = []
    if (pdfBuffer && pdfBuffer.length > 0) {
      emailAttachments.push({
        filename: pdfFilename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      })
    }

    const loginUrlMatch = finalBody.match(/https?:\/\/[^\s<]+/)
    const loginUrl = loginUrlMatch ? loginUrlMatch[0] : serverOrigin

    const cleanBodyText = finalBody
      .replace(/Poveznica za prijavu u sustav:\s*https?:\/\/[^\s<]+/gi, '')
      .replace(/Poveznica za prijavu u sustav:\s*\[LINK\]/gi, '')
      .trim()

    const templateType: HrdEmailTemplateTypeId = isMeeting
      ? (item.status === 'completed' ? 'zapisnik_sjednice' : 'poziv_sjednica')
      : 'poziv_predavanje'

    const infoBoxTitle = isMeeting
      ? (item.status === 'completed' ? 'Sažetak održane sjednice' : 'Podaci o održavanju sjednice')
      : 'Detalji događanja'

    const infoBoxHtml = `
      <div><strong>Naziv:</strong> ${escapeHtml(item.title || '—')}</div>
      <div><strong>Datum i vrijeme:</strong> ${escapeHtml(formattedItemDate)} u ${escapeHtml(formattedItemTime)}</div>
      <div><strong>Lokacija:</strong> ${escapeHtml(item.location || 'Online')}</div>
      ${!isMeeting && item.host ? `<div><strong>Predavač / voditelj:</strong> ${escapeHtml(item.host)}</div>` : ''}
      ${pdfFilename ? `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #B6AA94;"><strong>Službeni PDF prilog:</strong> <code>${escapeHtml(pdfFilename)}</code></div>` : ''}
    `

    const built = buildHrdMasterEmail({
      templateType,
      title: finalSubject,
      bodyTextOrHtml: cleanBodyText,
      infoBoxTitle,
      infoBoxHtml,
      ctaText: 'Prijavite se u sustav',
      ctaUrl: loginUrl,
      settings,
      sender,
    })

    const allAttachments = [...built.inlineAttachments, ...emailAttachments]

    const sendPromises = emailList.map(({ email }) => {
      return sendEmail({
        to: email,
        subject: testOnly ? `[TEST] ${finalSubject}` : finalSubject,
        body: built.plainText,
        html: built.html,
        attachments: allAttachments,
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
    if (testOnly) {
      return NextResponse.json({
        success: true,
        testOnly: true,
        message: `Testna obavijest poslana je na ${emailList[0].email}.`,
        sentCount: 1,
        failedCount: 0,
        sentAt: now,
        pdfAttached: Boolean(pdfBuffer && pdfBuffer.length > 0),
        pdfFilename: pdfFilename || null,
        warnings: built.warnings,
      })
    }
    const senderName = sender?.userName || 'Administrator'

    // Pripremi evidenciju primatelja s točnim vremenom i pošiljateljem za ovaj konkretni predmet
    const currentBatchRecipients = emailList.map(r => ({
      name: r.name || 'Član',
      email: r.email,
      sentAt: now,
      sentBy: senderName,
      subject: finalSubject
    }))

    let mergedRecipients = currentBatchRecipients

    // Ažuriraj isključivo ovaj predmet (po ID-u) u bazi podataka
    if (targetId) {
      try {
        if (isMeeting) {
          const existingMeeting = DatabaseService.getMeeting(targetId)
          if (existingMeeting && existingMeeting.notification_recipients) {
            try {
              const prev = typeof existingMeeting.notification_recipients === 'string'
                ? JSON.parse(existingMeeting.notification_recipients)
                : existingMeeting.notification_recipients
              if (Array.isArray(prev)) {
                mergedRecipients = [...currentBatchRecipients, ...prev]
              }
            } catch {}
          }
          DatabaseService.updateMeeting(targetId, {
            notification_sent_at: now,
            notification_recipients: JSON.stringify(mergedRecipients)
          })
        } else {
          const existingLecture = DatabaseService.getLecture(targetId)
          if (existingLecture && existingLecture.notification_recipients) {
            try {
              const prev = typeof existingLecture.notification_recipients === 'string'
                ? JSON.parse(existingLecture.notification_recipients)
                : existingLecture.notification_recipients
              if (Array.isArray(prev)) {
                mergedRecipients = [...currentBatchRecipients, ...prev]
              }
            } catch {}
          }
          DatabaseService.updateLecture(targetId, {
            notification_sent_at: now,
            notification_recipients: JSON.stringify(mergedRecipients)
          })
        }
      } catch (updateErr) {
        console.error('Greška pri spremanju evidencije obavijesti na predmet:', updateErr)
      }
    }

    // Trajno bilježenje u bazu activity_logs s jednoznačnim ID tagom predmeta
    try {
      const recipientSummary = emailList.length <= 4 
        ? emailList.map(r => r.name ? `${r.name} (${r.email})` : r.email).join(', ')
        : `${emailList.slice(0, 3).map(r => r.name ? `${r.name} (${r.email})` : r.email).join(', ')} i još ${emailList.length - 3} primatelja`

      const actionTitle = isMeeting ? 'Slanje obavijesti o sjednici' : (isGathering ? 'Slanje obavijesti o rodoslovnom druženju' : 'Slanje obavijesti o predavanju')
      const itemTag = targetId ? ` [ID:${isMeeting ? 'meeting' : 'lecture'}:${targetId}]` : ''
      const pdfLogNote = pdfFilename ? ` Priložen A4 PDF: ${pdfFilename}.` : ''
      const detailsMsg = `Poslana e-mail obavijest za: "${item.title}" (${item.date || '—'}). Uspješno poslano: ${successCount}/${emailList.length}. Primatelji: ${recipientSummary}. Predmet: "${finalSubject}".${pdfLogNote}${itemTag}`

      DatabaseService.insertLog({
        userId: sender?.userId || 'system',
        userName: senderName,
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
      sentAt: now,
      recipients: mergedRecipients,
      pdfAttached: Boolean(pdfBuffer && pdfBuffer.length > 0),
      pdfFilename: pdfFilename || null
    })

  } catch (error: any) {
    console.error('Board notification email error:', error)
    return NextResponse.json({ error: error.message || 'Došlo je do greške prilikom slanja e-mailova.' }, { status: 500 })
  }
}
