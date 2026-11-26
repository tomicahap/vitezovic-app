import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { MemberService } from '@/src/services/member-service'
import { SettingsService } from '@/src/services/settings-service'
import { sendEmail } from '@/lib/mail'
import { DatabaseService } from '@/lib/database'
import { buildHrdMasterEmail, escapeHtml } from '@/lib/hrd-email-system'
import { DoNotContactBlockedError, formatDoNotContactError, getDoNotContactEmailSet } from '@/lib/do-not-contact'
import { abortableSleep, computeSafePacingMs, createNdjsonStreamResponse } from '@/lib/ndjson-stream'
import { extractActor } from '@/lib/trash'
import { getMemberActionPermissions } from '@/lib/inquiry-permissions'
import { hashPassword } from '@/lib/password-hash'

const memberService = new MemberService()
const settingsService = new SettingsService()

const DEFAULT_BULK_INVITATION_BODY =
  'Pozivamo Vas da aktivirate svoj pristup u službeni informacijski sustav Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović” (Rodoslovac).\n\nKlikom na poveznicu ispod automatski ćete biti prijavljeni u sustav, gdje ćete odmah postaviti svoju novu osobnu lozinku (bez potrebe za unosom stare lozinke). Nakon postavljanja lozinke, ubuduće se prijavljujete svojim korisničkim imenom i novom lozinkom.'

function applyTemplateTokens(
  text: string,
  vars: { name: string; email: string; inviteUrl: string }
): string {
  return text
    .replace(/{{name}}/gi, vars.name)
    .replace(/{{ime}}/gi, vars.name)
    .replace(/{{email}}/gi, vars.email)
    .replace(/{{korisnicko_ime}}/gi, vars.email)
    .replace(/{{link}}/gi, vars.inviteUrl)
    .replace(/{{inviteLink}}/gi, vars.inviteUrl)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const actor = extractActor(request, body)
    const actorRole = String(actor.role || '').trim().toLowerCase()

    if (actorRole !== 'admin') {
      const actorId = Number(actor.id)
      const actorMember =
        Number.isFinite(actorId) && actorId > 0
          ? await memberService.getMember(actorId)
          : null

      const canInvite = Boolean(
        actorMember &&
          !actorMember.deceased &&
          !actorMember.expelled &&
          getMemberActionPermissions(actorMember).posalji_pozivnicu
      )

      if (!canInvite) {
        return NextResponse.json(
          { error: 'Nemate ovlast za skupno slanje pozivnica u sustav.' },
          { status: 403 }
        )
      }
    }

    const settings = await settingsService.getSettings()
    if (!settings) {
      return NextResponse.json({ error: 'Postavke sustava nisu pronađene.' }, { status: 404 })
    }

    if (!settings.smtpHost || !settings.smtpFrom) {
      return NextResponse.json(
        { error: 'SMTP poslužitelj nije konfiguriran u postavkama sustava.' },
        { status: 400 }
      )
    }

    const {
      memberIds,
      customSubject,
      customBody,
      sender,
      testOnly,
      testEmail,
      previewMemberId,
      stream,
    } = body

    const allMembers = await memberService.getAllMembers()
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
    const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const origin = `${protocol}://${host}`

    const defaultSubject = settings.invitationEmailSubject || 'Pozivnica za pristup sustavu HRD'
    const rawSubject = customSubject?.trim() || defaultSubject
    const rawBody = customBody?.trim() || DEFAULT_BULK_INVITATION_BODY
    const now = new Date().toISOString()

    const senderInfo = sender || {
      userId: actor.id || 'system',
      userName: actor.name || 'Administrator',
      userRole: actor.role || 'admin',
    }

    if (testOnly) {
      const allowedSampleMembers = allMembers.filter((m) => !m.doNotContact && !m.deceased)
      const sampleMember =
        (previewMemberId ? allowedSampleMembers.find((m) => m.id === Number(previewMemberId)) : null) ||
        (Array.isArray(memberIds) && memberIds.length > 0
          ? allowedSampleMembers.find((m) => m.id === Number(memberIds[0]))
          : null) ||
        allowedSampleMembers[0] || {
          id: 1,
          name: 'Ivan Horvat',
          email: settings.smtpFrom,
        }

      const sampleEmail = String(sampleMember.email || settings.smtpFrom).trim()
      const inviteUrl = `${origin}/pozivnica/test-pregled`
      const memberSubject = applyTemplateTokens(rawSubject, {
        name: sampleMember.name,
        email: sampleEmail,
        inviteUrl,
      })
      const memberBody = applyTemplateTokens(rawBody, {
        name: sampleMember.name,
        email: sampleEmail,
        inviteUrl,
      })

      const infoBoxHtml = `
        <div style="margin-bottom: 8px;"><strong>Korisničko ime (Username / E-pošta):</strong><br/><code style="background: #FFFFFF; padding: 3px 8px; border: 1px solid #E2E8F0; color: #1E3A5F; font-weight: bold; display: inline-block; margin-top: 2px;">${escapeHtml(sampleEmail)}</code></div>
        <div style="margin-bottom: 8px;"><strong>Izravna poveznica za aktivaciju i postavljanje lozinke:</strong><br/><a href="${escapeHtml(inviteUrl)}" style="color: #1F77C5; font-weight: bold; word-break: break-all;">${escapeHtml(inviteUrl)}</a></div>
        <div style="font-size: 12px; color: #475569; margin-top: 6px;">Nakon postavljanja lozinke, za svaku buduću prijavu koristite adresu <a href="${escapeHtml(origin)}/" style="color: #1F77C5;">${escapeHtml(origin)}/</a> te gore navedeno korisničko ime i svoju novu lozinku.</div>
      `

      const built = buildHrdMasterEmail({
        templateType: 'informacije_clanstvo',
        title: memberSubject,
        greeting: `Poštovani/a ${sampleMember.name},`,
        bodyTextOrHtml: memberBody,
        infoBoxTitle: 'Vaši pristupni podaci za sustav Rodoslovac',
        infoBoxHtml,
        ctaText: 'Aktiviraj pristup i postavi lozinku',
        ctaUrl: inviteUrl,
        closingText: 'Dobro došli u sustav Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović”!',
        settings,
        sender: senderInfo,
      })

      const targetRecipient = testEmail?.trim() || settings.smtpFrom

      await sendEmail({
        to: targetRecipient,
        subject: `[TEST] ${memberSubject}`,
        body: built.plainText,
        html: built.html,
        config: settings,
        attachments: built.inlineAttachments,
      })

      return NextResponse.json({
        success: true,
        testOnly: true,
        count: 1,
        errors: 0,
        sentAt: now,
        message: `Testna pozivnica (primjer za člana ${sampleMember.name}) uspješno je poslana na ${targetRecipient}.`,
        warnings: built.warnings,
      })
    }

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json(
        { error: 'Odaberite barem jednog člana kojem želite poslati pozivnicu.' },
        { status: 400 }
      )
    }

    const idSet = new Set(memberIds.map((id: any) => Number(id)))
    let targets = allMembers.filter((m) => idSet.has(m.id) && !m.deceased)

    if (targets.length === 0) {
      return NextResponse.json(
        { error: 'Nije pronađen niti jedan važeći primatelj među odabranim članovima.' },
        { status: 404 }
      )
    }

    if (targets.length === 1 && targets[0]?.doNotContact) {
      const m = targets[0]
      return NextResponse.json(
        {
          error: formatDoNotContactError([
            {
              id: m.id,
              name: m.name,
              email: m.email || '',
              doNotContactDate: m.doNotContactDate || '',
              doNotContactNote: m.doNotContactNote || '',
            },
          ]),
        },
        { status: 403 }
      )
    }

    const blockedEmails = getDoNotContactEmailSet()
    const beforeFilterCount = targets.length
    targets = targets.filter((m) => {
      if (!m || m.doNotContact) return false
      const emailLower = String(m.email || '').trim().toLowerCase()
      if (emailLower && blockedEmails.has(emailLower)) return false
      return true
    })
    const skippedDoNotContactCount = beforeFilterCount - targets.length

    if (targets.length === 0) {
      return NextResponse.json(
        {
          error:
            'Nema dopuštenih primatelja — svi odabrani članovi na izričitu su napomenu zatražili da ih se ne kontaktira.',
        },
        { status: 403 }
      )
    }

    const runSending = async (emit?: (obj: Record<string, any>) => void) => {
      let sentCount = 0
      let errorCount = 0
      let processedCount = 0
      let cancelled = false
      const errorsList: string[] = []
      const sentMemberIds: number[] = []
      const total = targets.length
      const delayMs = computeSafePacingMs(total)
      const batchSentAt = new Date().toISOString()

      emit?.({
        type: 'start',
        total,
        skipped: skippedDoNotContactCount,
        delayMs,
        startedAt: batchSentAt,
      })

      for (let i = 0; i < targets.length; i++) {
        if (request.signal.aborted) {
          cancelled = true
          break
        }

        const member = targets[i]
        const memberEmail = String(member.email || '').trim()

        emit?.({
          type: 'progress',
          total,
          processed: processedCount,
          sent: sentCount,
          failed: errorCount,
          skipped: skippedDoNotContactCount,
          currentName: member.name,
          currentEmail: memberEmail,
          delayMs,
        })

        if (!memberEmail || !memberEmail.includes('@')) {
          errorCount++
          processedCount++
          const msg = `${member.name}: Nedostaje valjana email adresa.`
          errorsList.push(msg)
          emit?.({
            type: 'progress',
            total,
            processed: processedCount,
            sent: sentCount,
            failed: errorCount,
            skipped: skippedDoNotContactCount,
            currentName: member.name,
            currentEmail: memberEmail,
            lastError: msg,
          })
          continue
        }

        try {
          const invitationToken = crypto.randomBytes(32).toString('hex')
          const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          const resolvedPassword = crypto.randomBytes(16).toString('hex')
          const inviteUrl = `${origin}/pozivnica/${invitationToken}`
          const sentAt = new Date().toISOString()

          const memberSubject = applyTemplateTokens(rawSubject, {
            name: member.name,
            email: memberEmail,
            inviteUrl,
          })
          const memberBody = applyTemplateTokens(rawBody, {
            name: member.name,
            email: memberEmail,
            inviteUrl,
          })

          const infoBoxHtml = `
            <div style="margin-bottom: 8px;"><strong>Korisničko ime (Username / E-pošta):</strong><br/><code style="background: #FFFFFF; padding: 3px 8px; border: 1px solid #E2E8F0; color: #1E3A5F; font-weight: bold; display: inline-block; margin-top: 2px;">${escapeHtml(memberEmail)}</code></div>
            <div style="margin-bottom: 8px;"><strong>Izravna poveznica za aktivaciju i postavljanje lozinke:</strong><br/><a href="${escapeHtml(inviteUrl)}" style="color: #1F77C5; font-weight: bold; word-break: break-all;">${escapeHtml(inviteUrl)}</a></div>
            <div style="font-size: 12px; color: #475569; margin-top: 6px;">Nakon postavljanja lozinke, za svaku buduću prijavu koristite adresu <a href="${escapeHtml(origin)}/" style="color: #1F77C5;">${escapeHtml(origin)}/</a> te gore navedeno korisničko ime i svoju novu lozinku.</div>
          `

          const built = buildHrdMasterEmail({
            templateType: 'informacije_clanstvo',
            title: memberSubject,
            greeting: `Poštovani/a ${member.name},`,
            bodyTextOrHtml: memberBody,
            infoBoxTitle: 'Vaši pristupni podaci za sustav Rodoslovac',
            infoBoxHtml,
            ctaText: 'Aktiviraj pristup i postavi lozinku',
            ctaUrl: inviteUrl,
            closingText: 'Dobro došli u sustav Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović”!',
            settings,
            sender: senderInfo,
          })

          await sendEmail({
            to: memberEmail,
            subject: memberSubject,
            body: built.plainText,
            html: built.html,
            config: settings,
            attachments: built.inlineAttachments,
          })

          await memberService.updateMember(member.id, {
            invitationSent: 1,
            invitation_sent_at: sentAt,
            invitationSentAt: sentAt,
            password: hashPassword(resolvedPassword),
            is_temp_password: 1,
            isTempPassword: true,
            invitation_token: invitationToken,
            invitationToken: invitationToken,
            invitation_token_expires_at: tokenExpiresAt,
            invitationTokenExpiresAt: tokenExpiresAt,
          })

          sentCount++
          processedCount++
          sentMemberIds.push(member.id)

          emit?.({
            type: 'progress',
            total,
            processed: processedCount,
            sent: sentCount,
            failed: errorCount,
            skipped: skippedDoNotContactCount,
            currentName: member.name,
            currentEmail: memberEmail,
          })
        } catch (err: any) {
          console.error(`Neuspjelo slanje pozivnice članu ${memberEmail}:`, err)
          errorCount++
          processedCount++
          const errMsg = `${member.name} (${memberEmail}): ${err?.message || 'Greška'}`
          errorsList.push(errMsg)
          emit?.({
            type: 'progress',
            total,
            processed: processedCount,
            sent: sentCount,
            failed: errorCount,
            skipped: skippedDoNotContactCount,
            currentName: member.name,
            currentEmail: memberEmail,
            lastError: errMsg,
          })
        }

        if (i < targets.length - 1 && delayMs > 0) {
          const ok = await abortableSleep(delayMs, request.signal)
          if (!ok) {
            cancelled = true
            break
          }
        }
      }

      if (sentCount > 0) {
        try {
          DatabaseService.insertLog({
            userId: senderInfo.userId || 'system',
            userName: senderInfo.userName || 'Administrator',
            userRole: senderInfo.userRole || 'admin',
            action: 'Skupno slanje pozivnica',
            details: `Poslano ${sentCount} od ${total} pozivnica s izravnom poveznicom za aktivaciju sustava Rodoslovac.${errorCount > 0 ? ` Neuspjelo: ${errorCount}.` : ''}${skippedDoNotContactCount > 0 ? ` Preskočeno (ne kontaktirati): ${skippedDoNotContactCount}.` : ''}`,
            timestamp: new Date().toISOString(),
          })
        } catch (logErr) {
          console.error('Greška pri upisu skupnog loga pozivnica:', logErr)
        }
      }

      if (sentCount === 0 && errorCount > 0 && !cancelled) {
        return {
          status: 500,
          payload: {
            success: false,
            count: 0,
            errors: errorCount,
            error: `Slanje nije uspjelo niti za jednog primatelja. ${errorsList[0] || 'Provjerite SMTP postavke.'}`,
            details: errorsList,
          },
        }
      }

      return {
        status: 200,
        cancelled,
        payload: {
          success: true,
          cancelled,
          count: sentCount,
          errors: errorCount,
          skippedDoNotContactCount,
          sentAt: batchSentAt,
          sentMemberIds,
          message: cancelled
            ? `Slanje pozivnica je zaustavljeno. Poslano ${sentCount} od ${total}.${errorCount > 0 ? ` Neuspjelo: ${errorCount}.` : ''}`
            : `Uspješno poslano ${sentCount} pozivnica s aktivacijskim poveznicama.${errorCount > 0 ? ` Neuspjelo: ${errorCount}.` : ''}${skippedDoNotContactCount > 0 ? ` Preskočeno zbog zabrane kontakta: ${skippedDoNotContactCount}.` : ''}`,
          details: errorsList,
        },
      }
    }

    if (stream) {
      return createNdjsonStreamResponse(async (emit) => {
        const outcome = await runSending(emit)
        if (!outcome.payload.success) {
          emit({ type: 'error', error: outcome.payload.error, details: outcome.payload.details })
          return
        }
        emit({
          type: 'done',
          cancelled: Boolean(outcome.cancelled),
          sent: outcome.payload.count,
          failed: outcome.payload.errors,
          skipped: outcome.payload.skippedDoNotContactCount || 0,
          processed: (outcome.payload.count || 0) + (outcome.payload.errors || 0),
          total: targets.length,
          finishedAt: new Date().toISOString(),
          result: outcome.payload,
        })
      })
    }

    const outcome = await runSending()
    return NextResponse.json(outcome.payload, { status: outcome.status })
  } catch (error: any) {
    if (error instanceof DoNotContactBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Bulk invitation error:', error)
    return NextResponse.json(
      { error: error?.message || 'Interna greška poslužitelja pri skupnom slanju pozivnica.' },
      { status: 500 }
    )
  }
}
