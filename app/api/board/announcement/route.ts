import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'
import { SettingsService } from '@/src/services/settings-service'
import { MemberService, isAdminRecord } from '@/src/services/member-service'
import { DatabaseService } from '@/lib/database'
import { extractActor } from '@/lib/trash'
import {
  buildBoardAnnouncementEmail,
  DEFAULT_BOARD_ANNOUNCEMENT_SUBJECT,
} from '@/lib/hrd-email-system'
import { isBoardMember, getMemberActiveFunctions, formatDateTimeDMY } from '@/lib/utils'
import { getMemberActionPermissions } from '@/lib/inquiry-permissions'

export const dynamic = 'force-dynamic'

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
      if (!m || m.deceased || m.expelled || isAdminRecord(m)) continue
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

    const results = await Promise.allSettled(
      targetRecipients.map((recipient) =>
        sendEmail({
          to: recipient.email,
          subject: finalSubject,
          body: built.plainText,
          html: built.html,
          attachments: built.inlineAttachments,
          config: smtpConfig,
        })
      )
    )

    const failed = results.filter((r) => r.status === 'rejected')
    const successCount = results.length - failed.length

    if (failed.length > 0 && failed.length === targetRecipients.length) {
      const firstErr = (failed[0] as PromiseRejectedResult).reason?.message || 'Greška pri slanju putem SMTP poslužitelja.'
      return NextResponse.json(
        { error: `Slanje e-maila nije uspjelo! ${firstErr}` },
        { status: 500 }
      )
    }

    if (testOnly) {
      return NextResponse.json({
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
      })
    }

    // Opcionalno istovremeno objavi na Oglasnoj ploči odbora ako to zatraži admin/moderator
    if (syncBoardNotice && isPrivilegedRole) {
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

    // Trajno evidentiraj u activity_logs
    try {
      const recipientSummary =
        targetRecipients.length <= 4
          ? targetRecipients.map((r) => `${r.name} (${r.email})`).join(', ')
          : `${targetRecipients.slice(0, 3).map((r) => `${r.name} (${r.email})`).join(', ')} i još ${targetRecipients.length - 3} primatelja`

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

    return NextResponse.json({
      success: true,
      testOnly: false,
      sentCount: successCount,
      failedCount: failed.length,
      sentAt: nowIso,
      senderDisplayName,
      senderRoleLabel,
      recipients: targetRecipients,
      message: `Obavijest je uspješno poslana na ${successCount}/${targetRecipients.length} adresa trenutnog sastava tijela društva.`,
      warnings: built.warnings,
    })
  } catch (error: any) {
    console.error('[Board Announcement POST Error]:', error)
    return NextResponse.json(
      { error: error?.message || 'Interna greška poslužitelja pri slanju obavijesti.' },
      { status: 500 }
    )
  }
}
