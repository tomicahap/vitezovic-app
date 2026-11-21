import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'
import { SettingsService } from '@/src/services/settings-service'
import { MemberService, isAdminRecord } from '@/src/services/member-service'
import { DatabaseService, getAppDb } from '@/lib/database'
import { extractActor } from '@/lib/trash'
import {
  buildBoardAnnouncementEmail,
  DEFAULT_BOARD_ANNOUNCEMENT_SUBJECT,
} from '@/lib/hrd-email-system'
import { isBoardMember, getMemberActiveFunctions, formatDateTimeDMY } from '@/lib/utils'
import { getMemberActionPermissions } from '@/lib/inquiry-permissions'
import { DoNotContactBlockedError } from '@/lib/do-not-contact'
import { abortableSleep, computeSafePacingMs, createNdjsonStreamResponse } from '@/lib/ndjson-stream'

export const dynamic = 'force-dynamic'

function parseLegacyRecipientsText(rawText: string, allMembers: any[]): Array<{
  id?: number
  name: string
  email: string
  functionsLabel: string
  status: 'sent' | 'failed'
}> {
  if (!rawText) return []
  const cleaned = rawText.replace(/\s+i još\s+\d+\s+primatelja\s*$/i, '').trim()
  if (!cleaned) return []
  const parts = cleaned.split(/\s*,\s*(?=[^,()]*\([^)]*@[^)]+\))/)
  const out: Array<{
    id?: number
    name: string
    email: string
    functionsLabel: string
    status: 'sent' | 'failed'
  }> = []

  for (const part of parts) {
    const match = part.trim().match(/^(.+?)\s*\(([^()]*@[^()]+)\)$/)
    if (!match) continue
    const name = match[1].trim()
    const email = match[2].trim()
    const matchedMember = allMembers.find(
      (m) => m && m.email && m.email.trim().toLowerCase() === email.toLowerCase()
    )
    const functionsLabel = matchedMember ? getMemberActiveFunctions(matchedMember).join(', ') : ''
    out.push({
      id: matchedMember ? Number(matchedMember.id) : undefined,
      name,
      email,
      functionsLabel,
      status: 'sent',
    })
  }
  return out
}

export async function GET(request: NextRequest) {
  try {
    const actor = extractActor(request)
    const roleLower = (actor.role || '').trim().toLowerCase()

    const memberService = new MemberService()
    const allMembers = await memberService.getAllMembers()

    const numericActorId = Number(actor.id)
    const emailLower = (actor.email || '').trim().toLowerCase()
    const actorMember =
      roleLower !== 'admin'
        ? allMembers.find(
            (m) =>
              (Number.isFinite(numericActorId) && numericActorId > 0 && Number(m.id) === numericActorId) ||
              (emailLower && m.email && m.email.trim().toLowerCase() === emailLower)
          )
        : undefined

    const canViewHistory =
      roleLower === 'admin' ||
      Boolean(actorMember && getMemberActionPermissions(actorMember).obavijest_tijelima) ||
      Boolean(actorMember && !actorMember.deceased && !actorMember.expelled && isBoardMember(actorMember))

    if (!canViewHistory) {
      return NextResponse.json(
        { error: 'Nemate ovlast za pregled povijesti poslanih obavijesti tijelima društva.' },
        { status: 403 }
      )
    }

    const rows = DatabaseService.getBoardAnnouncements(200)
    const structured = rows.map((row: any) => {
      let recipients: any[] = []
      try {
        const parsed = JSON.parse(row.recipients_json || '[]')
        recipients = Array.isArray(parsed) ? parsed : []
      } catch {
        recipients = []
      }
      return {
        id: Number(row.id),
        subject: row.subject || DEFAULT_BOARD_ANNOUNCEMENT_SUBJECT,
        message: row.message || '',
        senderId: row.sender_id || '',
        senderName: row.sender_name || 'Administrator',
        senderRole: row.sender_role || '',
        senderEmail: row.sender_email || '',
        recipients,
        sentCount: Number(row.sent_count || 0),
        failedCount: Number(row.failed_count || 0),
        totalRecipients: Number(row.total_recipients || recipients.length || 0),
        syncedBoardNotice: Boolean(row.synced_board_notice),
        sentAt: row.sent_at,
        isLegacyLog: false,
      }
    })

    // Uključi i eventualne ranije obavijesti zabilježene samo u activity_logs (uklj. prvu poslanu obavijest)
    const db = getAppDb()
    let legacyLogs: any[] = []
    try {
      legacyLogs = db
        .prepare(
          `SELECT id, userId, userName, userRole, details, timestamp
           FROM activity_logs
           WHERE action = ?
           ORDER BY timestamp DESC
           LIMIT 100`
        )
        .all('Obavijest članovima tijela društva') as any[]
    } catch {}

    const combined = [...structured]
    for (const log of legacyLogs) {
      const logTs = new Date(log.timestamp || '').getTime()
      const alreadyStored = structured.some((item) => {
        const itemTs = new Date(item.sentAt || '').getTime()
        return Number.isFinite(logTs) && Number.isFinite(itemTs) && Math.abs(itemTs - logTs) <= 10000
      })
      if (alreadyStored) continue

      const details = String(log.details || '')
      const ratioMatch = details.match(/\((\d+)\/(\d+)\)\./)
      const subjectMatch = details.match(/Predmet:\s*"([^"]+)"/)
      const recipientsMatch = details.match(/Primatelji:\s*([\s\S]+)$/)
      const senderRoleMatch = details.match(/^.+?\s*\(([^()]+)\)\s+poslao\/la je obavijest/)

      const sentCount = ratioMatch ? Number(ratioMatch[1]) : 0
      const totalRecipients = ratioMatch ? Number(ratioMatch[2]) : 0
      const parsedSubject = subjectMatch?.[1]?.trim() || DEFAULT_BOARD_ANNOUNCEMENT_SUBJECT
      const rawRecipients = recipientsMatch?.[1]?.trim() || ''
      const parsedRecipients = parseLegacyRecipientsText(rawRecipients, allMembers)

      combined.push({
        id: -Number(log.id || Date.now()),
        subject: parsedSubject,
        message: '',
        senderId: String(log.userId || ''),
        senderName: log.userName || 'Administrator',
        senderRole: senderRoleMatch?.[1]?.trim() || log.userRole || '',
        senderEmail: '',
        recipients: parsedRecipients,
        sentCount: sentCount || parsedRecipients.length,
        failedCount: Math.max(0, totalRecipients - sentCount),
        totalRecipients: totalRecipients || parsedRecipients.length,
        syncedBoardNotice: false,
        sentAt: log.timestamp,
        isLegacyLog: true,
        legacyDetails: details,
        legacyRecipientsSummary: rawRecipients,
      } as any)
    }

    combined.sort((a, b) => {
      const ta = new Date(a.sentAt || 0).getTime()
      const tb = new Date(b.sentAt || 0).getTime()
      return tb - ta
    })

    return NextResponse.json(
      { success: true, announcements: combined },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error: any) {
    console.error('[Board Announcement GET Error]:', error)
    return NextResponse.json(
      { error: error?.message || 'Greška pri dohvaćanju povijesti poslanih obavijesti.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      subject,
      message,
      recipientIds,
      testOnly = false,
      testEmail,
      sender,
      syncBoardNotice = false,
      stream = false,
    } = body || {}

    const actor = extractActor(request, body)
    const roleLower = (actor.role || '').trim().toLowerCase()
    const isPrivilegedRole = roleLower === 'admin' || roleLower === 'moderator'

    const settingsService = new SettingsService()
    const settings: any = await settingsService.getSettings()
    if (!settings || !settings.smtpHost || !settings.smtpFrom) {
      return NextResponse.json(
        { error: 'SMTP poslužitelj nije konfiguriran u postavkama sustava.' },
        { status: 400 }
      )
    }

    const memberService = new MemberService()
    const allMembers = await memberService.getAllMembers()

    // Pronađi zapis prijavljenog korisnika ako nije sustavni administrator
    const numericActorId = Number(actor.id)
    const emailLower = (actor.email || '').trim().toLowerCase()
    const actorMember =
      roleLower !== 'admin'
        ? allMembers.find(
            (m) =>
              (Number.isFinite(numericActorId) && numericActorId > 0 && Number(m.id) === numericActorId) ||
              (emailLower && m.email && m.email.trim().toLowerCase() === emailLower)
          )
        : undefined

    const canActorSend =
      roleLower === 'admin' ||
      Boolean(actorMember && getMemberActionPermissions(actorMember).obavijest_tijelima)

    if (!canActorSend) {
      return NextResponse.json(
        { error: 'Nemate ovlast za slanje obavijesti članovima tijela društva.' },
        { status: 403 }
      )
    }

    const cleanSubject = String(subject || '').trim() || DEFAULT_BOARD_ANNOUNCEMENT_SUBJECT
    const cleanMessage = String(message || '').trim()
    if (!cleanMessage) {
      return NextResponse.json({ error: 'Unesite tekst obavijesti za članove tijela.' }, { status: 400 })
    }

    // Odredi točno ime i dužnost osobe koja dijeli obavijest
    let senderDisplayName = actor.name || 'Administrator'
    let senderRoleLabel = 'Član tijela društva'

    if (roleLower === 'admin') {
      senderDisplayName =
        settings.adminName?.trim() ||
        (sender?.userName && String(sender.userName).trim()) ||
        actor.name ||
        'Administrator'
      senderRoleLabel = 'Administrator'
    } else if (actorMember) {
      senderDisplayName = actorMember.name || actor.name || 'Član tijela društva'
      const activeFns = getMemberActiveFunctions(actorMember)
      senderRoleLabel =
        activeFns.length > 0
          ? activeFns.join(', ')
          : actorMember.role === 'moderator'
          ? 'Moderator (tijelo društva)'
          : 'Član tijela društva'
    } else if (roleLower === 'moderator') {
      senderRoleLabel = 'Moderator (tijelo društva)'
    }

    // Isključivo trenutni aktivni sastav tijela društva s valjanom e-mail adresom
    const seenEmails = new Set<string>()
    const currentBoardRecipients: Array<{
      id: number
      name: string
      email: string
      functionsLabel: string
    }> = []

    for (const m of allMembers) {
      if (!m || m.deceased || m.expelled || m.doNotContact || isAdminRecord(m)) continue
      if (!isBoardMember(m)) continue
      const email = String(m.email || '').trim()
      if (!email || !email.includes('@')) continue

      const key = email.toLowerCase()
      if (seenEmails.has(key)) continue
      seenEmails.add(key)

      const fns = getMemberActiveFunctions(m)
      currentBoardRecipients.push({
        id: Number(m.id),
        name: m.name || email,
        email,
        functionsLabel: fns.join(', '),
      })
    }

    let targetRecipients = currentBoardRecipients
    if (!testOnly) {
      if (Array.isArray(recipientIds)) {
        const selectedIdSet = new Set(recipientIds.map((id: any) => Number(id)))
        targetRecipients = currentBoardRecipients.filter((r) => selectedIdSet.has(r.id))
      }

      if (targetRecipients.length === 0) {
        return NextResponse.json(
          { error: 'Nema odabranih članova trenutnog sastava tijela društva s valjanom e-mail adresom.' },
          { status: 400 }
        )
      }
    } else {
      const actorValidEmail = actor.email && actor.email.includes('@') ? actor.email.trim() : ''
      const targetTestEmail = String(testEmail || '').trim() || actorValidEmail || settings.smtpFrom
      if (!targetTestEmail || !targetTestEmail.includes('@')) {
        return NextResponse.json({ error: 'Unesite valjanu testnu e-mail adresu.' }, { status: 400 })
      }
      targetRecipients = [
        {
          id: 0,
          name: 'Testni primatelj',
          email: targetTestEmail,
          functionsLabel: 'Testni prikaz',
        },
      ]
    }

    const originHeader = request.headers.get('origin')
    const hostHeader = request.headers.get('host')
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    const serverOrigin = originHeader || (hostHeader ? `${proto}://${hostHeader}` : 'https://cms.rodoslovlje.hr')

    const now = new Date()
    const nowIso = now.toISOString()
    const formattedDateTime = formatDateTimeDMY(now)

    const built = buildBoardAnnouncementEmail({
      subject: cleanSubject,
      message: cleanMessage,
      senderName: senderDisplayName,
      sentDate: now,
      formattedDateTime,
      ctaUrl: serverOrigin,
      settings,
      sender: {
        userId: actor.id,
        userName: senderDisplayName,
        userEmail: actor.email,
        userRole: actor.role,
      },
    })

    const finalSubject = testOnly ? `[TEST] ${cleanSubject}` : cleanSubject

    const smtpConfig = {
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort || 587,
      smtpUser: settings.smtpUser || '',
      smtpPass: settings.smtpPass || '',
      smtpSecure: settings.smtpSecure ? 1 : 0,
      smtpFrom: settings.smtpFrom,
    }

    const runSending = async (emit?: (obj: Record<string, any>) => void) => {
      const results: Array<{ status: 'fulfilled' | 'rejected'; reason?: any }> = []
      let successCount = 0
      let failedCount = 0
      let processedCount = 0
      let cancelled = false
      const total = targetRecipients.length
      const delayMs = testOnly ? 0 : computeSafePacingMs(total)

      emit?.({
        type: 'start',
        total,
        skipped: 0,
        delayMs,
        startedAt: new Date().toISOString(),
      })

      for (let i = 0; i < targetRecipients.length; i++) {
        if (request.signal.aborted) {
          cancelled = true
          break
        }

        const recipient = targetRecipients[i]
        emit?.({
          type: 'progress',
          total,
          processed: processedCount,
          sent: successCount,
          failed: failedCount,
          skipped: 0,
          currentName: recipient.name,
          currentEmail: recipient.email,
          delayMs,
        })

        try {
          await sendEmail({
            to: recipient.email,
            subject: finalSubject,
            body: built.plainText,
            html: built.html,
            attachments: built.inlineAttachments,
            config: smtpConfig,
          })
          results.push({ status: 'fulfilled' })
          successCount++
          processedCount++
          emit?.({
            type: 'progress',
            total,
            processed: processedCount,
            sent: successCount,
            failed: failedCount,
            skipped: 0,
            currentName: recipient.name,
            currentEmail: recipient.email,
          })
        } catch (err: any) {
          results.push({ status: 'rejected', reason: err })
          failedCount++
          processedCount++
          emit?.({
            type: 'progress',
            total,
            processed: processedCount,
            sent: successCount,
            failed: failedCount,
            skipped: 0,
            currentName: recipient.name,
            currentEmail: recipient.email,
            lastError: err?.message || 'Greška pri slanju',
          })
        }

        if (i < targetRecipients.length - 1 && delayMs > 0) {
          const ok = await abortableSleep(delayMs, request.signal)
          if (!ok) {
            cancelled = true
            break
          }
        }
      }

      if (failedCount > 0 && successCount === 0 && !cancelled) {
        const firstErr = results.find((r) => r.status === 'rejected')?.reason?.message || 'Greška pri slanju putem SMTP poslužitelja.'
        return {
          status: 500,
          payload: { error: `Slanje e-maila nije uspjelo! ${firstErr}` },
        }
      }

      if (testOnly) {
        return {
          status: 200,
          payload: {
            success: true,
            testOnly: true,
            sentCount: 1,
            failedCount: 0,
            sentTo: targetRecipients[0].email,
            sentAt: nowIso,
            senderDisplayName,
            senderRoleLabel,
            message: `Testni e-mail uspješno je poslan na ${targetRecipients[0].email}.`,
            warnings: built.warnings,
          },
        }
      }

      // Opcionalno istovremeno objavi na Oglasnoj ploči odbora ako to zatraži admin/moderator
      if (syncBoardNotice && isPrivilegedRole && successCount > 0) {
        try {
          await settingsService.updateSettings({
            boardNotice: `${cleanSubject}\n\n${cleanMessage}`,
            boardNoticeAuthor: senderDisplayName,
            boardNoticeDate: nowIso,
          })
        } catch (noticeErr) {
          console.warn('[Board Announcement] Neuspješno ažuriranje oglasne ploče:', noticeErr)
        }
      }

      // Trajno spremi potpunu evidenciju poslane obavijesti u board_announcements
      let announcementId: number | undefined
      if (successCount > 0 || failedCount > 0) {
        try {
          const recipientsRecord = targetRecipients.slice(0, results.length).map((recipient, idx) => {
            const res = results[idx]
            return {
              id: recipient.id,
              name: recipient.name,
              email: recipient.email,
              functionsLabel: recipient.functionsLabel,
              status: res?.status === 'fulfilled' ? ('sent' as const) : ('failed' as const),
              error:
                res?.status === 'rejected'
                  ? String(res.reason?.message || 'Greška pri slanju')
                  : undefined,
            }
          })

          announcementId = DatabaseService.insertBoardAnnouncement({
            subject: cleanSubject,
            message: cleanMessage,
            senderId: String(actor.id || ''),
            senderName: senderDisplayName,
            senderRole: senderRoleLabel,
            senderEmail: actor.email || '',
            recipientsJson: JSON.stringify(recipientsRecord),
            sentCount: successCount,
            failedCount,
            totalRecipients: targetRecipients.length,
            syncedBoardNotice: Boolean(syncBoardNotice && isPrivilegedRole),
            sentAt: nowIso,
          })
        } catch (persistErr) {
          console.error('[Board Announcement] Greška pri spremanju u board_announcements:', persistErr)
        }

        // Trajno evidentiraj u activity_logs
        try {
          const sentSlice = targetRecipients.slice(0, results.length)
          const recipientSummary =
            sentSlice.length <= 4
              ? sentSlice.map((r) => `${r.name} (${r.email})`).join(', ')
              : `${sentSlice.slice(0, 3).map((r) => `${r.name} (${r.email})`).join(', ')} i još ${sentSlice.length - 3} primatelja`

          DatabaseService.insertLog({
            userId: String(actor.id || 'system'),
            userName: senderDisplayName,
            userRole: actor.role || 'member',
            action: 'Obavijest članovima tijela društva',
            details: `${senderDisplayName} (${senderRoleLabel}) poslao/la je obavijest trenutnom sastavu tijela društva (${successCount}/${targetRecipients.length}). Predmet: "${cleanSubject}". Primatelji: ${recipientSummary}`,
            timestamp: nowIso,
          })
        } catch (logErr) {
          console.error('[Board Announcement] Greška pri upisu u activity_logs:', logErr)
        }
      }

      return {
        status: 200,
        cancelled,
        payload: {
          success: true,
          cancelled,
          announcementId,
          testOnly: false,
          sentCount: successCount,
          failedCount,
          sentAt: nowIso,
          senderDisplayName,
          senderRoleLabel,
          recipients: targetRecipients,
          message: cancelled
            ? `Slanje je zaustavljeno. Obavijest je poslana na ${successCount}/${targetRecipients.length} adresa.`
            : `Obavijest je uspješno poslana na ${successCount}/${targetRecipients.length} adresa trenutnog sastava tijela društva.`,
          warnings: built.warnings,
        },
      }
    }

    if (stream && !testOnly) {
      return createNdjsonStreamResponse(async (emit) => {
        const outcome = await runSending(emit)
        if (outcome.status >= 400) {
          emit({ type: 'error', error: (outcome.payload as any).error || 'Greška pri slanju obavijesti.' })
          return
        }
        const p: any = outcome.payload
        emit({
          type: 'done',
          cancelled: Boolean(outcome.cancelled),
          sent: p.sentCount || 0,
          failed: p.failedCount || 0,
          skipped: 0,
          processed: (p.sentCount || 0) + (p.failedCount || 0),
          total: targetRecipients.length,
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
    console.error('[Board Announcement POST Error]:', error)
    return NextResponse.json(
      { error: error?.message || 'Interna greška poslužitelja pri slanju obavijesti.' },
      { status: 500 }
    )
  }
}
