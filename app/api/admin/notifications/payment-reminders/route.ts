import { NextRequest, NextResponse } from 'next/server'
import { MemberService } from '@/src/services/member-service'
import { SettingsService } from '@/src/services/settings-service'
import { sendEmail } from '@/lib/mail'
import { computeMemberStates, StatusSettings } from '@/lib/member-status'
import { DatabaseService } from '@/lib/database'
import { buildHrdMasterEmail, escapeHtml } from '@/lib/hrd-email-system'

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
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #EAE1D1; border: 1px solid #B6AA94; margin-bottom: 16px;">
          <tr>
            <td align="center" style="padding: 16px;">
              <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; font-weight: bold; color: #343C32; margin-bottom: 6px;">2D barkod za brzo plaćanje (m-banking)</div>
              <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #292929; margin-bottom: 12px;">Skenirajte ovaj barkod kamerom unutar aplikacije Vaše banke („Skeniraj i plati”) za trenutačno popunjavanje naloga.</div>
              <div style="display: inline-block; background-color: #FFFFFF; padding: 10px; border: 1px solid #B6AA94;">
                <img src="cid:qr_cid" alt="2D Barkod za uplatu" width="220" style="display: block; max-width: 220px; width: 100%; height: auto;" />
              </div>
            </td>
          </tr>
        </table>`
      }
      if (includeSlip && slipBase64) {
        extra += `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #EAE1D1; border: 1px solid #B6AA94;">
          <tr>
            <td align="center" style="padding: 16px;">
              <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; font-weight: bold; color: #343C32; margin-bottom: 6px;">Uplatnica HUB-3 za uplatu članarine</div>
              <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #292929; margin-bottom: 12px;">Uplatu možete izvršiti putem internetskog bankarstva ili prema prikazanoj uplatnici.</div>
              <div style="background-color: #FFFFFF; padding: 8px; border: 1px solid #B6AA94;">
                <img src="cid:uplatnica_cid" alt="Uplatnica HUB-3" width="500" style="display: block; max-width: 100%; width: 100%; height: auto;" />
              </div>
            </td>
          </tr>
        </table>`
      }
      return extra
    }

    if (testOnly) {
      const sampleMember = membersToNotify[0] || {
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
        }<br/>Status članarine: <strong style="color: #704C3A;">Podmirenje članarine za tekuće razdoblje</strong></div>`,
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

    let sentCount = 0
    let errorCount = 0
    const errorsList: string[] = []

    const emailPromises = membersToNotify.map(async (member) => {
      if (!member.email || !member.email.includes('@')) {
        errorCount++
        errorsList.push(`${member.name}: Nedostaje valjana email adresa.`)
        return
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
          }<br/>Status članarine: <strong style="color: #704C3A;">Podmirenje članarine za tekuće razdoblje</strong></div>`,
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
      } catch (err: any) {
        console.error(`Neuspjelo slanje maila članu ${member.email}:`, err)
        errorCount++
        errorsList.push(`${member.name} (${member.email}): ${err.message || 'Greška'}`)
      }
    })

    await Promise.all(emailPromises)

    if (sentCount === 0 && errorCount > 0) {
      return NextResponse.json(
        {
          success: false,
          count: 0,
          errors: errorCount,
          error: `Slanje nije uspjelo za niti jednog primatelja. ${errorsList[0] || 'Provjerite SMTP postavke.'}`,
          details: errorsList,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      count: sentCount,
      errors: errorCount,
      sentAt: now,
      message: `Uspješno poslano ${sentCount} obavijest(i). ${errorCount > 0 ? `Neuspjelo: ${errorCount}.` : ''}`,
      details: errorsList,
    })
  } catch (error: any) {
    console.error('Payment notification error:', error)
    return NextResponse.json({ error: error.message || 'Interna greška poslužitelja.' }, { status: 500 })
  }
}
