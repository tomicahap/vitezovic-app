import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'
import { SettingsService } from '@/src/services/settings-service'
import { DatabaseService } from '@/lib/database'
import { MemberService } from '@/src/services/member-service'
import { MeetingService } from '@/src/services/meeting-service'
import { generateEventPdfBuffer } from '@/lib/event-pdf'
import { inferCityFromLocationOrTitle } from '@/lib/croatia-cities'
import { buildHrdMasterEmail, formatHrdEmailDate, formatHrdEmailTime } from '@/lib/hrd-email-system'
import {
  buildEventInfoBoxHtml,
  getDefaultEventEmailContent,
  stripDuplicateEventMetaLines,
} from '@/lib/event-email-templates'
import { DoNotContactBlockedError, getDoNotContactEmailSet } from '@/lib/do-not-contact'
import { abortableSleep, computeSafePacingMs, createNdjsonStreamResponse } from '@/lib/ndjson-stream'
import { parseExternalAttendees } from '@/lib/attendance'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const { type, item, recipients, customSubject, customBody, sender, testOnly, testEmail, stream } = payload

    if (!type || !item || (!testOnly && (!recipients || !Array.isArray(recipients) || recipients.length === 0))) {
      return NextResponse.json({ error: 'Nedostaju obavezni parametri (type, item, recipients).' }, { status: 400 })
    }

    const settingsService = new SettingsService()
    const settings: any = await settingsService.getSettings()

    if (!settings || !settings.smtpFrom || !settings.smtpHost) {
      return NextResponse.json({ error: 'SMTP poslužitelj nije konfiguriran u postavkama sustava.' }, { status: 400 })
    }

    const eventDefaults = getDefaultEventEmailContent(type === 'meeting' ? 'meeting' : 'lecture', item)
    const isMeeting = eventDefaults.kind.isMeeting
    const isGathering = eventDefaults.kind.isGathering

    if (type !== 'meeting' && type !== 'lecture') {
      return NextResponse.json({ error: 'Nepoznat tip obavijesti.' }, { status: 400 })
    }

    const originHeader = request.headers.get('origin')
    const hostHeader = request.headers.get('host')
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    const serverOrigin = originHeader || (hostHeader ? `${proto}://${hostHeader}` : 'https://cms.rodoslovlje.hr')

    const formattedItemDate = item.date ? formatHrdEmailDate(item.date) : '—'
    const formattedItemTime = formatHrdEmailTime(item.time || item.start_time) || '—'

    const replaceTemplateVars = (tpl: string) =>
      String(tpl || '')
        .replace(/\[NASLOV\]|\{NASLOV\}/g, item.title || '')
        .replace(/\[DATUM\]|\{DATUM\}/g, formattedItemDate)
        .replace(/\[VRIJEME\]|\{VRIJEME\}/g, formattedItemTime)
        .replace(/\[LOKACIJA\]|\{LOKACIJA\}/g, item.location || 'Online')
        .replace(/\[PREDAVAČ\]|\{PREDAVAČ\}/g, item.host || '—')
        .replace(/\[LINK\]|\{LINK\}/g, serverOrigin)

    let defaultSubject = eventDefaults.subject
    let defaultBody = eventDefaults.body

    if (isMeeting) {
      const configuredSubj = item.status === 'completed' ? settings.meetingSummarySubject : settings.meetingNotificationSubject
      const configuredBody = item.status === 'completed' ? settings.meetingSummaryBody : settings.meetingNotificationBody
      if (configuredSubj && String(configuredSubj).trim()) {
        defaultSubject = replaceTemplateVars(configuredSubj)
      }
      if (configuredBody && String(configuredBody).trim()) {
        const cleaned = stripDuplicateEventMetaLines(replaceTemplateVars(configuredBody))
        if (cleaned) defaultBody = cleaned
      }
    } else if (!isGathering) {
      const configuredSubj = item.status === 'completed' ? settings.lectureSummarySubject : settings.lectureNotificationSubject
      const configuredBody = item.status === 'completed' ? settings.lectureSummaryBody : settings.lectureNotificationBody
      if (configuredSubj && String(configuredSubj).trim() && eventDefaults.kind.key === 'lecture') {
        defaultSubject = replaceTemplateVars(configuredSubj)
      }
      if (configuredBody && String(configuredBody).trim() && eventDefaults.kind.key === 'lecture') {
        const cleaned = stripDuplicateEventMetaLines(replaceTemplateVars(configuredBody))
        if (cleaned) defaultBody = cleaned
      }
    }

    let finalSubject = customSubject?.trim() || defaultSubject
    if (isGathering) {
      // Naslov za rodoslovno druženje mora biti ISKLJUČIVO "Obavijest o rodoslovnom druženju"
      finalSubject = "Obavijest o rodoslovnom druženju"
    }
    const finalBody = customBody?.trim() || defaultBody

    // Normaliziraj listu email adresa i isključi članove s oznakom "Ne kontaktirati"
    const blockedEmails = getDoNotContactEmailSet()
    const rawEmailList: { email: string; name?: string }[] = testOnly
      ? [{ email: testEmail?.trim() || settings.smtpFrom, name: 'Testni primatelj' }]
      : (recipients || []).map((r: any) => {
          if (typeof r === 'string') return { email: r }
          return { email: r.email, name: r.name }
        }).filter((r: any) => r.email && r.email.includes('@'))

    const emailList = testOnly
      ? rawEmailList
      : rawEmailList.filter((r) => !blockedEmails.has(String(r.email).trim().toLowerCase()))

    if (rawEmailList.length === 0) {
      return NextResponse.json({ error: 'Niti jedan odabrani primatelj nema valjanu email adresu.' }, { status: 400 })
    }
    if (!testOnly && emailList.length === 0) {
      return NextResponse.json(
        { error: 'Slanje nije dopušteno: svi odabrani primatelji na izričitu su napomenu zatražili da ih se ne kontaktira.' },
        { status: 403 }
      )
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
            let external_attendees: any[] = []
            let attachments = []
            let hosts = []
            try { attendee_ids = typeof rawLecture.attendee_ids === 'string' ? JSON.parse(rawLecture.attendee_ids || '[]') : rawLecture.attendee_ids || [] } catch {}
            external_attendees = parseExternalAttendees(rawLecture.external_attendees)
            try { attachments = typeof rawLecture.attachments === 'string' ? JSON.parse(rawLecture.attachments || '[]') : rawLecture.attachments || [] } catch {}
            try { hosts = typeof rawLecture.hosts === 'string' ? JSON.parse(rawLecture.hosts || '[]') : rawLecture.hosts || [] } catch {}
            const resolvedCity = rawLecture.city && rawLecture.city.trim() ? rawLecture.city.trim() : inferCityFromLocationOrTitle(rawLecture.location, rawLecture.title) || null
            fullItem = { ...rawLecture, city: resolvedCity, attendee_ids, external_attendees, attachments, hosts, ...item }
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

    const cleanBodyText = stripDuplicateEventMetaLines(finalBody)

    const built = buildHrdMasterEmail({
      templateType: eventDefaults.templateType,
      title: finalSubject,
      bodyTextOrHtml: cleanBodyText,
      infoBoxTitle: eventDefaults.infoBoxTitle,
      infoBoxHtml: buildEventInfoBoxHtml({
        type: isMeeting ? 'meeting' : 'lecture',
        item,
        pdfFilename: pdfFilename || null,
      }),
      ctaText: 'Prijavi se u Rodoslovac',
      ctaUrl: loginUrl,
      settings,
      sender,
    })

    const allAttachments = [...built.inlineAttachments, ...emailAttachments]
    const smtpConfig = {
      smtpHost: settings.smtpHost!,
      smtpPort: settings.smtpPort || 587,
      smtpUser: settings.smtpUser || '',
      smtpPass: settings.smtpPass || '',
      smtpSecure: settings.smtpSecure ? 1 : 0,
      smtpFrom: settings.smtpFrom!,
    }
    const skippedDoNotContactCount = Math.max(0, rawEmailList.length - emailList.length)

    const runSending = async (emit?: (obj: Record<string, any>) => void) => {
      let successCount = 0
      let failedCount = 0
      let processedCount = 0
      let cancelled = false
      let firstError = ''
      const sentList: { email: string; name?: string }[] = []
      const total = emailList.length
      const delayMs = testOnly ? 0 : computeSafePacingMs(total)

      emit?.({
        type: 'start',
        total,
        skipped: skippedDoNotContactCount,
        delayMs,
        startedAt: new Date().toISOString(),
      })

      for (let i = 0; i < emailList.length; i++) {
        if (request.signal.aborted) {
          cancelled = true
          break
        }

        const recipient = emailList[i]
        emit?.({
          type: 'progress',
          total,
          processed: processedCount,
          sent: successCount,
          failed: failedCount,
          skipped: skippedDoNotContactCount,
          currentName: recipient.name || recipient.email,
          currentEmail: recipient.email,
          delayMs,
        })

        try {
          await sendEmail({
            to: recipient.email,
            subject: testOnly ? `[TEST] ${finalSubject}` : finalSubject,
            body: built.plainText,
            html: built.html,
            attachments: allAttachments,
            config: smtpConfig,
          })
          successCount++
          processedCount++
          sentList.push(recipient)
          emit?.({
            type: 'progress',
            total,
            processed: processedCount,
            sent: successCount,
            failed: failedCount,
            skipped: skippedDoNotContactCount,
            currentName: recipient.name || recipient.email,
            currentEmail: recipient.email,
          })
        } catch (err: any) {
          failedCount++
          processedCount++
          const errMsg = err?.message || 'Greška u SMTP poslužitelju.'
          if (!firstError) firstError = errMsg
          emit?.({
            type: 'progress',
            total,
            processed: processedCount,
            sent: successCount,
            failed: failedCount,
            skipped: skippedDoNotContactCount,
            currentName: recipient.name || recipient.email,
            currentEmail: recipient.email,
            lastError: errMsg,
          })
        }

        if (i < emailList.length - 1 && delayMs > 0) {
          const ok = await abortableSleep(delayMs, request.signal)
          if (!ok) {
            cancelled = true
            break
          }
        }
      }

      if (failedCount > 0 && successCount === 0 && !cancelled) {
        return {
          status: 500,
          payload: { error: `Niti jedan e-mail nije poslan! ${firstError || 'Greška u SMTP poslužitelju.'}` },
        }
      }

      const now = new Date().toISOString()
      if (testOnly) {
        return {
          status: 200,
          payload: {
            success: true,
            testOnly: true,
            message: `Testna obavijest poslana je na ${emailList[0].email}.`,
            sentCount: 1,
            failedCount: 0,
            sentAt: now,
            pdfAttached: Boolean(pdfBuffer && pdfBuffer.length > 0),
            pdfFilename: pdfFilename || null,
            warnings: built.warnings,
          },
        }
      }

      const senderName = sender?.userName || 'Administrator'
      const recordedRecipientsSource = sentList.length > 0 ? sentList : []
      const currentBatchRecipients = recordedRecipientsSource.map((r) => ({
        name: r.name || 'Član',
        email: r.email,
        sentAt: now,
        sentBy: senderName,
        subject: finalSubject,
      }))

      let mergedRecipients = currentBatchRecipients

      if (targetId && currentBatchRecipients.length > 0) {
        try {
          if (isMeeting) {
            const existingMeeting = DatabaseService.getMeeting(targetId)
            if (existingMeeting && existingMeeting.notification_recipients) {
              try {
                const prev =
                  typeof existingMeeting.notification_recipients === 'string'
                    ? JSON.parse(existingMeeting.notification_recipients)
                    : existingMeeting.notification_recipients
                if (Array.isArray(prev)) {
                  mergedRecipients = [...currentBatchRecipients, ...prev]
                }
              } catch {}
            }
            DatabaseService.updateMeeting(targetId, {
              notification_sent_at: now,
              notification_recipients: JSON.stringify(mergedRecipients),
            })
          } else {
            const existingLecture = DatabaseService.getLecture(targetId)
            if (existingLecture && existingLecture.notification_recipients) {
              try {
                const prev =
                  typeof existingLecture.notification_recipients === 'string'
                    ? JSON.parse(existingLecture.notification_recipients)
                    : existingLecture.notification_recipients
                if (Array.isArray(prev)) {
                  mergedRecipients = [...currentBatchRecipients, ...prev]
                }
              } catch {}
            }
            DatabaseService.updateLecture(targetId, {
              notification_sent_at: now,
              notification_recipients: JSON.stringify(mergedRecipients),
            })
          }
        } catch (updateErr) {
          console.error('Greška pri spremanju evidencije obavijesti na predmet:', updateErr)
        }
      }

      if (sentList.length > 0) {
        try {
          const recipientSummary =
            sentList.length <= 4
              ? sentList.map((r) => (r.name ? `${r.name} (${r.email})` : r.email)).join(', ')
              : `${sentList
                  .slice(0, 3)
                  .map((r) => (r.name ? `${r.name} (${r.email})` : r.email))
                  .join(', ')} i još ${sentList.length - 3} primatelja`

          const actionTitle = isMeeting
            ? 'Slanje obavijesti o sjednici'
            : isGathering
            ? 'Slanje obavijesti o rodoslovnom druženju'
            : 'Slanje obavijesti o predavanju'
          const itemTag = targetId ? ` [ID:${isMeeting ? 'meeting' : 'lecture'}:${targetId}]` : ''
          const pdfLogNote = pdfFilename ? ` Priložen A4 PDF: ${pdfFilename}.` : ''
          const detailsMsg = `Poslana e-mail obavijest za: "${item.title}" (${item.date || '—'}). Uspješno poslano: ${successCount}/${emailList.length}. Primatelji: ${recipientSummary}. Predmet: "${finalSubject}".${pdfLogNote}${itemTag}`

          DatabaseService.insertLog({
            userId: sender?.userId || 'system',
            userName: senderName,
            userRole: sender?.userRole || 'admin',
            action: actionTitle,
            details: detailsMsg,
            timestamp: now,
          })
        } catch (dbErr) {
          console.error('Greška pri upisu u activity_logs za board notification:', dbErr)
        }
      }

      return {
        status: 200,
        cancelled,
        payload: {
          success: true,
          cancelled,
          message: cancelled
            ? `Slanje je zaustavljeno. Poslano (${successCount}/${emailList.length}) obavijest(i).`
            : `Uspješno poslano (${successCount}/${emailList.length}) obavijest(i).`,
          sentCount: successCount,
          failedCount,
          skippedDoNotContactCount,
          sentAt: now,
          recipients: mergedRecipients,
          pdfAttached: Boolean(pdfBuffer && pdfBuffer.length > 0),
          pdfFilename: pdfFilename || null,
        },
      }
    }

    if (stream && !testOnly) {
      return createNdjsonStreamResponse(async (emit) => {
        const outcome = await runSending(emit)
        if (outcome.status >= 400) {
          emit({ type: 'error', error: (outcome.payload as any).error || 'Greška pri slanju e-mailova.' })
          return
        }
        const p: any = outcome.payload
        emit({
          type: 'done',
          cancelled: Boolean(outcome.cancelled),
          sent: p.sentCount || 0,
          failed: p.failedCount || 0,
          skipped: p.skippedDoNotContactCount || 0,
          processed: (p.sentCount || 0) + (p.failedCount || 0),
          total: emailList.length,
          finishedAt: new Date().toISOString(),
          result: p,
        })
      })
    }

    const outcome = await runSending()
    return NextResponse.json(outcome.payload, { status: outcome.status })

  } catch (error: any) {
    if (error instanceof DoNotContactBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Board notification email error:', error)
    return NextResponse.json({ error: error.message || 'Došlo je do greške prilikom slanja e-mailova.' }, { status: 500 })
  }
}
