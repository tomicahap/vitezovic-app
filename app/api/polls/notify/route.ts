import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'
import { MemberService } from '@/src/services/member-service'
import { SettingsService } from '@/src/services/settings-service'
import { DatabaseService } from '@/lib/database'
import { buildHrdMasterEmail, escapeHtml } from '@/lib/hrd-email-system'
import { DoNotContactBlockedError, getDoNotContactEmailSet } from '@/lib/do-not-contact'
import { abortableSleep, computeSafePacingMs, createNdjsonStreamResponse } from '@/lib/ndjson-stream'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pollTitle, targetType, selectedMemberIds, customSubject, customBody, sender, testOnly, testEmail, stream } = body

    const memberService = new MemberService()
    const settingsService = new SettingsService()
    const settings = await settingsService.getSettings()

    if (!settings || !settings.smtpFrom || !settings.smtpHost) {
      return NextResponse.json({ error: 'SMTP poslužitelj nije konfiguriran u postavkama sustava.' }, { status: 400 })
    }

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
    const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const origin = `${protocol}://${host}`

    const defaultSubject = `Obavezno glasovanje: ${pollTitle}`
    const finalSubject = customSubject?.trim() || defaultSubject

    if (testOnly) {
      const targetRecipient = testEmail?.trim() || settings.smtpFrom
      const defaultText = `Poštovane članice i članovi tijela Društva,\n\nObavještavamo Vas da je u sustavu HRD otvoreno novo obavezno glasovanje:\n\n„${pollTitle}”\n\nMolimo Vas da se prijavite u sustav kako biste dali svoj glas.`
      const testBody = customBody?.trim() || defaultText
      const built = buildHrdMasterEmail({
        templateType: 'sluzbena_obavijest',
        title: finalSubject,
        subtitle: 'Službeno elektroničko glasovanje',
        bodyTextOrHtml: testBody,
        infoBoxTitle: 'Naziv odluke / ankete za glasovanje',
        infoBoxHtml: `<div style="font-weight: bold; font-size: 15px; color: #7C2D12;">${escapeHtml(pollTitle || 'Glasovanje')}</div>`,
        ctaText: 'Prijavite se i glasujte',
        ctaUrl: `${origin}/`,
        settings,
        sender,
      })
      await sendEmail({
        to: targetRecipient,
        subject: `[TEST] ${finalSubject}`,
        body: built.plainText,
        html: built.html,
        config: settings,
        attachments: built.inlineAttachments,
      })
      return NextResponse.json({
        success: true,
        testOnly: true,
        message: `Testna obavijest o glasovanju poslana na ${targetRecipient}.`,
        warnings: built.warnings,
      })
    }

    const allMembers = await memberService.getAllMembers()
    let targetMembers = []
    if (targetType === 'all') {
      targetMembers = allMembers
    } else if (Array.isArray(selectedMemberIds)) {
      targetMembers = allMembers.filter((m) => selectedMemberIds.includes(m.id))
    } else {
      targetMembers = allMembers
    }

    const blockedEmails = getDoNotContactEmailSet()
    const validEmailTargets = targetMembers.filter((m) => m.email && m.email.includes('@'))
    const validMembers = validEmailTargets.filter((m) => {
      if (m.doNotContact) return false
      const emailLower = String(m.email || '').trim().toLowerCase()
      return !emailLower || !blockedEmails.has(emailLower)
    })
    if (validEmailTargets.length > 0 && validMembers.length === 0) {
      return NextResponse.json(
        { error: 'Nema dopuštenih primatelja — svi odabrani članovi na izričitu su napomenu zatražili da ih se ne kontaktira.' },
        { status: 403 }
      )
    }
    if (validMembers.length === 0) {
      return NextResponse.json({ error: 'Niti jedan primatelj nema valjanu email adresu.' }, { status: 400 })
    }

    const skippedDoNotContactCount = Math.max(0, validEmailTargets.length - validMembers.length)

    const runSending = async (emit?: (obj: Record<string, any>) => void) => {
      let sentCount = 0
      let failedCount = 0
      let processedCount = 0
      let cancelled = false
      const total = validMembers.length
      const delayMs = computeSafePacingMs(total)

      emit?.({
        type: 'start',
        total,
        skipped: skippedDoNotContactCount,
        delayMs,
        startedAt: new Date().toISOString(),
      })

      for (let i = 0; i < validMembers.length; i++) {
        if (request.signal.aborted) {
          cancelled = true
          break
        }

        const member = validMembers[i]
        emit?.({
          type: 'progress',
          total,
          processed: processedCount,
          sent: sentCount,
          failed: failedCount,
          skipped: skippedDoNotContactCount,
          currentName: member.name,
          currentEmail: member.email || '',
          delayMs,
        })

        const defaultText = `Poštovani/a ${member.name},\n\nObavještavamo Vas da je u sustavu HRD otvoreno novo obavezno glasovanje:\n\n„${pollTitle}”\n\nMolimo Vas da se prijavite u sustav kako biste dali svoj glas.`

        const memberBody = customBody?.trim()
          ? customBody.replace(/{{name}}/gi, member.name).replace(/{{ime}}/gi, member.name)
          : defaultText

        const built = buildHrdMasterEmail({
          templateType: 'sluzbena_obavijest',
          title: finalSubject,
          subtitle: 'Službeno elektroničko glasovanje',
          bodyTextOrHtml: memberBody,
          infoBoxTitle: 'Naziv odluke / ankete za glasovanje',
          infoBoxHtml: `<div style="font-weight: bold; font-size: 15px; color: #7C2D12;">${escapeHtml(pollTitle || '')}</div>`,
          ctaText: 'Prijavite se i glasujte',
          ctaUrl: `${origin}/`,
          settings,
          sender,
        })

        try {
          await sendEmail({
            to: member.email,
            subject: finalSubject,
            body: built.plainText,
            html: built.html,
            config: settings,
            attachments: built.inlineAttachments,
          })
          sentCount++
          processedCount++
          emit?.({
            type: 'progress',
            total,
            processed: processedCount,
            sent: sentCount,
            failed: failedCount,
            skipped: skippedDoNotContactCount,
            currentName: member.name,
            currentEmail: member.email || '',
          })
        } catch (err: any) {
          console.error(`Neuspješno slanje za ${member.email}:`, err)
          failedCount++
          processedCount++
          emit?.({
            type: 'progress',
            total,
            processed: processedCount,
            sent: sentCount,
            failed: failedCount,
            skipped: skippedDoNotContactCount,
            currentName: member.name,
            currentEmail: member.email || '',
            lastError: err?.message || 'Greška pri slanju',
          })
        }

        if (i < validMembers.length - 1 && delayMs > 0) {
          const ok = await abortableSleep(delayMs, request.signal)
          if (!ok) {
            cancelled = true
            break
          }
        }
      }

      const now = new Date().toISOString()
      if (sentCount > 0) {
        try {
          DatabaseService.insertLog({
            userId: sender?.userId || 'system',
            userName: sender?.userName || 'Administrator',
            userRole: sender?.userRole || 'admin',
            action: 'Slanje obavijesti o glasovanju',
            details: `Poslana e-mail obavijest o glasovanju "${pollTitle}" na ${sentCount} adresa.`,
            timestamp: now,
          })
        } catch {}
      }

      return {
        cancelled,
        payload: {
          success: sentCount > 0 || failedCount === 0,
          cancelled,
          sentCount,
          failedCount,
          skippedDoNotContactCount,
          sentAt: now,
          message: cancelled
            ? `Slanje je zaustavljeno. Poslano na ${sentCount} od ${total} adresa.`
            : `Uspješno poslano na ${sentCount} adresa.${failedCount > 0 ? ` Neuspješno: ${failedCount}.` : ''}`,
        },
      }
    }

    if (stream) {
      return createNdjsonStreamResponse(async (emit) => {
        const outcome = await runSending(emit)
        const p = outcome.payload
        emit({
          type: 'done',
          cancelled: Boolean(outcome.cancelled),
          sent: p.sentCount,
          failed: p.failedCount,
          skipped: p.skippedDoNotContactCount,
          processed: p.sentCount + p.failedCount,
          total: validMembers.length,
          finishedAt: new Date().toISOString(),
          result: p,
        })
      })
    }

    const outcome = await runSending()
    return NextResponse.json(outcome.payload)
  } catch (error: any) {
    if (error instanceof DoNotContactBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Greška u API ruti /api/polls/notify:', error)
    return NextResponse.json({ error: error.message || 'Greška na poslužitelju.' }, { status: 500 })
  }
}
