import { NextRequest, NextResponse } from 'next/server'
import { MemberService } from '@/src/services/member-service'
import { SettingsService } from '@/src/services/settings-service'
import { sendEmail } from '@/lib/mail'
import { computeMemberStates, StatusSettings } from '@/lib/member-status'
import { DatabaseService } from '@/lib/database'
import { buildHrdMasterEmail, escapeHtml } from '@/lib/hrd-email-system'
import { DoNotContactBlockedError, formatDoNotContactError, getDoNotContactEmailSet } from '@/lib/do-not-contact'
import { abortableSleep, computeSafePacingMs, createNdjsonStreamResponse } from '@/lib/ndjson-stream'

const memberService = new MemberService()
const settingsService = new SettingsService()

export async function POST(request: NextRequest) {
  try {
    const settings = await settingsService.getSettings()
    if (!settings) {
      return NextResponse.json({ error: 'Postavke sustava nisu pronađene.' }, { status: 404 })
    }

    if (!settings.smtpHost || !settings.smtpFrom) {
      return NextResponse.json({ error: 'SMTP poslužitelj nije konfiguriran u postavkama sustava.' }, { status: 400 })
    }

    const body = await request.json()
    const {
      memberId,
      memberIds,
      customSubject,
      customBody,
      includeSlip = true,
      includeQr = true,
      sender,
      testOnly,
      testEmail,
      stream,
    } = body

    let membersToNotify: any[] = []

    if (memberId) {
      const member = await memberService.getMember(Number(memberId))
      if (!member) {
        return NextResponse.json({ error: 'Član nije pronađen.' }, { status: 404 })
      }
      membersToNotify = [member]
    } else if (Array.isArray(memberIds) && memberIds.length > 0) {
      const allMembers = await memberService.getAllMembers()
      membersToNotify = allMembers.filter((m) => memberIds.includes(m.id))
    } else {
      const members = await memberService.getAllMembers()
      const statusSettings: StatusSettings = {
        overdueAfterDays: settings.overdueAfterDays || 365,
        expiredAfterDays: settings.expiredAfterDays || 730,
        requirePaymentToBeActive: Boolean((settings as any).requirePaymentToBeActive),
      }

      membersToNotify = members.filter((m) => {
        const state = computeMemberStates(m, statusSettings)
        return state.status_clana === 'DUG'
      })

      if (membersToNotify.length === 0 && !testOnly) {
        return NextResponse.json({
          success: true,
          count: 0,
          errors: 0,
          message: 'Nema članova sa statusom DUG.',
        })
      }
    }

    let skippedDoNotContactCount = 0
    if (!testOnly) {
      if (membersToNotify.length === 1 && membersToNotify[0]?.doNotContact) {
        const m = membersToNotify[0]
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
      const beforeFilter = membersToNotify.length
      membersToNotify = membersToNotify.filter((m) => {
        if (!m || m.doNotContact) return false
        const emailLower = String(m.email || '').trim().toLowerCase()
        if (emailLower && blockedEmails.has(emailLower)) return false
        return true
      })
      skippedDoNotContactCount = beforeFilter - membersToNotify.length

      if (membersToNotify.length === 0) {
        return NextResponse.json(
          {
            error:
              'Nema dopuštenih primatelja — svi odabrani članovi na izričitu su napomenu zatražili da ih se ne kontaktira.',
          },
          { status: 403 }
        )
      }
    }

    // Prepare attachments (HUB-3 slip & QR barcode)
    const baseAttachments: Array<{
      filename: string
      content: Buffer
      contentType: string
      cid?: string
      contentDisposition?: 'inline' | 'attachment'
    }> = []

    let slipMime = 'image/png'
    let slipBase64 = ''
    if (includeSlip && settings.paymentSlipUrl) {
      const match = settings.paymentSlipUrl.match(/^data:([^;,]+);base64,([\s\S]+)$/i)
      if (match) {
        slipMime = match[1].toLowerCase()
        slipBase64 = match[2].replace(/\s+/g, '')
      } else if (settings.paymentSlipUrl.includes(',')) {
        slipBase64 = settings.paymentSlipUrl.split(',')[1].replace(/\s+/g, '')
      }
      if (slipBase64) {
        baseAttachments.push({
          filename: 'uplatnica.png',
          content: Buffer.from(slipBase64, 'base64'),
          contentType: slipMime,
          cid: 'uplatnica_cid',
          contentDisposition: 'inline',
        })
      }
    }

    let qrMime = 'image/png'
    let qrBase64 = ''
    if (includeQr && settings.paymentQrUrl) {
      const match = settings.paymentQrUrl.match(/^data:([^;,]+);base64,([\s\S]+)$/i)
      if (match) {
        qrMime = match[1].toLowerCase()
        qrBase64 = match[2].replace(/\s+/g, '')
      } else if (settings.paymentQrUrl.includes(',')) {
        qrBase64 = settings.paymentQrUrl.split(',')[1].replace(/\s+/g, '')
      }
      if (qrBase64) {
        baseAttachments.push({
          filename: 'barkod_za_uplatu.png',
          content: Buffer.from(qrBase64, 'base64'),
          contentType: qrMime,
          cid: 'qr_cid',
          contentDisposition: 'inline',
        })
      }
    }

    const defaultSubject = settings.paymentEmailSubject || 'Obavijest o članarini — HRD „Pavao Ritter Vitezović”'
    const defaultBody =
      settings.paymentEmailBody ||
      'Poštovani/a {{name}},\n\nPrema evidenciji Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović”, molimo Vas za podmirenje godišnje članarine za tekuće razdoblje.'

    const rawSubject = customSubject?.trim() || defaultSubject
    const rawBody = customBody?.trim() || defaultBody
    const now = new Date().toISOString()

    const buildEmbedHtml = () => {
      let extra = ''
      if (includeQr && qrBase64) {
        extra += `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; margin-bottom: 16px;">
          <tr>
            <td align="center" style="padding: 16px;">
              <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; font-weight: bold; color: #7C2D12; margin-bottom: 6px;">2D barkod za brzo plaćanje (m-banking)</div>
              <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1F2937; margin-bottom: 12px;">Skenirajte ovaj barkod kamerom unutar aplikacije Vaše banke („Skeniraj i plati”) za trenutačno popunjavanje naloga.</div>
              <div style="display: inline-block; background-color: #FFFFFF; padding: 10px; border: 1px solid #E2E8F0;">
                <img src="cid:qr_cid" alt="2D Barkod za uplatu" width="220" style="display: block; max-width: 220px; width: 100%; height: auto;" />
              </div>
            </td>
          </tr>
        </table>`
      }
      if (includeSlip && slipBase64) {
        extra += `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0;">
          <tr>
            <td align="center" style="padding: 16px;">
              <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; font-weight: bold; color: #7C2D12; margin-bottom: 6px;">Uplatnica HUB-3 za uplatu članarine</div>
              <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1F2937; margin-bottom: 12px;">Uplatu možete izvršiti putem internetskog bankarstva ili prema prikazanoj uplatnici.</div>
              <div style="background-color: #FFFFFF; padding: 8px; border: 1px solid #E2E8F0;">
                <img src="cid:uplatnica_cid" alt="Uplatnica HUB-3" width="500" style="display: block; max-width: 100%; width: 100%; height: auto;" />
              </div>
            </td>
          </tr>
        </table>`
      }
      return extra
    }

    if (testOnly) {
      const sampleMember =
        membersToNotify.find((m) => !m?.doNotContact) ||
        membersToNotify[0] || {
          name: 'Ivan Horvat',
          email: settings.smtpFrom,
          registryNumber: '001',
          membershipNumber: '001',
        }
      const memberSubject = rawSubject
        .replace(/{{name}}/gi, sampleMember.name)
        .replace(/{{ime}}/gi, sampleMember.name)
      const memberBody = rawBody
        .replace(/{{name}}/gi, sampleMember.name)
        .replace(/{{ime}}/gi, sampleMember.name)
        .replace(/{{email}}/gi, sampleMember.email || '')
        .replace(/{{registryNumber}}/gi, sampleMember.registryNumber || '—')
        .replace(/{{membershipNumber}}/gi, sampleMember.membershipNumber || '—')

      const built = buildHrdMasterEmail({
        templateType: 'obavijest_clanovima',
        title: memberSubject,
        subtitle: 'Službena obavijest o članarini',
        bodyTextOrHtml: memberBody,
        infoBoxTitle: 'Evidencija primatelja',
        infoBoxHtml: `<div>Član: <strong>${escapeHtml(sampleMember.name)}</strong>${
          sampleMember.registryNumber ? ` • Broj matice: <strong>${escapeHtml(sampleMember.registryNumber)}</strong>` : ''
        }<br/>Status članarine: <strong style="color: #7C2D12;">Podmirenje članarine za tekuće razdoblje</strong></div>`,
        extraContentHtml: buildEmbedHtml(),
        settings,
        sender,
      })

      const targetRecipient = testEmail?.trim() || settings.smtpFrom
      await sendEmail({
        to: targetRecipient,
        subject: `[TEST] ${memberSubject}`,
        body: built.plainText,
        html: built.html,
        config: settings,
        attachments: [...built.inlineAttachments, ...baseAttachments],
      })

      return NextResponse.json({
        success: true,
        testOnly: true,
        count: 1,
        errors: 0,
        sentAt: now,
        message: `Testna obavijest o članarini poslana je na ${targetRecipient}.`,
        warnings: built.warnings,
      })
    }

    const runSending = async (emit?: (obj: Record<string, any>) => void) => {
      let sentCount = 0
      let errorCount = 0
      let processedCount = 0
      let cancelled = false
      const errorsList: string[] = []
      const sentMemberIds: number[] = []
      const total = membersToNotify.length
      const delayMs = computeSafePacingMs(total)

      emit?.({
        type: 'start',
        total,
        skipped: skippedDoNotContactCount,
        delayMs,
        startedAt: new Date().toISOString(),
      })

      for (let i = 0; i < membersToNotify.length; i++) {
        if (request.signal.aborted) {
          cancelled = true
          break
        }

        const member = membersToNotify[i]
        emit?.({
          type: 'progress',
          total,
          processed: processedCount,
          sent: sentCount,
          failed: errorCount,
          skipped: skippedDoNotContactCount,
          currentName: member.name,
          currentEmail: member.email || '',
          delayMs,
        })

        if (!member.email || !member.email.includes('@')) {
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
            currentEmail: member.email || '',
            lastError: msg,
          })
          continue
        }

        try {
          const memberSubject = rawSubject
            .replace(/{{name}}/gi, member.name)
            .replace(/{{ime}}/gi, member.name)

          const memberBody = rawBody
            .replace(/{{name}}/gi, member.name)
            .replace(/{{ime}}/gi, member.name)
            .replace(/{{email}}/gi, member.email)
            .replace(/{{registryNumber}}/gi, member.registryNumber || '—')
            .replace(/{{membershipNumber}}/gi, member.membershipNumber || '—')

          const built = buildHrdMasterEmail({
            templateType: 'obavijest_clanovima',
            title: memberSubject,
            subtitle: 'Službena obavijest o članarini',
            bodyTextOrHtml: memberBody,
            infoBoxTitle: 'Evidencija primatelja',
            infoBoxHtml: `<div>Član: <strong>${escapeHtml(member.name)}</strong>${
              member.registryNumber ? ` • Broj matice: <strong>${escapeHtml(member.registryNumber)}</strong>` : ''
            }<br/>Status članarine: <strong style="color: #7C2D12;">Podmirenje članarine za tekuće razdoblje</strong></div>`,
            extraContentHtml: buildEmbedHtml(),
            settings,
            sender,
          })

          await sendEmail({
            to: member.email,
            subject: memberSubject,
            body: built.plainText,
            html: built.html,
            config: settings,
            attachments: [...built.inlineAttachments, ...baseAttachments],
          })

          try {
            await memberService.updateMember(member.id, {
              lastPaymentReminderAt: now,
            })
          } catch (dbErr) {
            console.error(`Greška pri ažuriranju datuma opomene za člana ${member.id}:`, dbErr)
          }

          try {
            DatabaseService.insertLog({
              userId: sender?.userId || 'system',
              userName: sender?.userName || 'Administrator',
              userRole: sender?.userRole || 'admin',
              action: 'Slanje podsjetnika za članarinu',
              details: `Poslan podsjetnik za članarinu članu: ${member.name} (${member.email}). Predmet: "${memberSubject}"`,
              timestamp: now,
            })
          } catch (logErr) {
            console.error(`Greška pri upisu aktivnosti za opomenu člana ${member.id}:`, logErr)
          }

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
            currentEmail: member.email,
          })
        } catch (err: any) {
          console.error(`Neuspjelo slanje maila članu ${member.email}:`, err)
          errorCount++
          processedCount++
          const errMsg = `${member.name} (${member.email}): ${err.message || 'Greška'}`
          errorsList.push(errMsg)
          emit?.({
            type: 'progress',
            total,
            processed: processedCount,
            sent: sentCount,
            failed: errorCount,
            skipped: skippedDoNotContactCount,
            currentName: member.name,
            currentEmail: member.email,
            lastError: errMsg,
          })
        }

        if (i < membersToNotify.length - 1 && delayMs > 0) {
          const ok = await abortableSleep(delayMs, request.signal)
          if (!ok) {
            cancelled = true
            break
          }
        }
      }

      if (sentCount === 0 && errorCount > 0 && !cancelled) {
        return {
          status: 500,
          payload: {
            success: false,
            count: 0,
            errors: errorCount,
            sentMemberIds,
            error: `Slanje nije uspjelo za niti jednog primatelja. ${errorsList[0] || 'Provjerite SMTP postavke.'}`,
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
          sentMemberIds,
          sentAt: now,
          message: cancelled
            ? `Slanje je zaustavljeno. Poslano ${sentCount} od ${total} obavijesti.${errorCount > 0 ? ` Neuspjelo: ${errorCount}.` : ''}`
            : `Uspješno poslano ${sentCount} obavijest(i). ${errorCount > 0 ? `Neuspjelo: ${errorCount}.` : ''}${skippedDoNotContactCount > 0 ? ` Preskočeno zbog zabrane kontakta: ${skippedDoNotContactCount}.` : ''}`,
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
          total: membersToNotify.length,
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
    console.error('Payment notification error:', error)
    return NextResponse.json({ error: error.message || 'Interna greška poslužitelja.' }, { status: 500 })
  }
}
