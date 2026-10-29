import { NextRequest, NextResponse } from 'next/server'
import { MemberService } from '@/src/services/member-service'
import { SettingsService } from '@/src/services/settings-service'
import { sendEmail } from '@/lib/mail'
import { computeMemberStates, StatusSettings } from '@/lib/member-status'
import { DatabaseService } from '@/lib/database'

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
    const { memberId, memberIds, customSubject, customBody, includeSlip = true, includeQr = true, sender } = body

    let membersToNotify: any[] = []

    if (memberId) {
      const member = await memberService.getMember(Number(memberId))
      if (!member) {
        return NextResponse.json({ error: 'Član nije pronađen.' }, { status: 404 })
      }
      membersToNotify = [member]
    } else if (Array.isArray(memberIds) && memberIds.length > 0) {
      const allMembers = await memberService.getAllMembers()
      membersToNotify = allMembers.filter(m => memberIds.includes(m.id))
    } else {
      const members = await memberService.getAllMembers()
      const statusSettings: StatusSettings = {
        overdueAfterDays: settings.overdueAfterDays || 365,
        expiredAfterDays: settings.expiredAfterDays || 730
      }

      // Filter members with status "DUG"
      membersToNotify = members.filter(m => {
        const state = computeMemberStates(m, statusSettings)
        return state.status_clana === 'DUG'
      })

      if (membersToNotify.length === 0) {
        return NextResponse.json({ success: true, count: 0, errors: 0, message: 'Nema članova sa statusom DUG.' })
      }
    }

    let sentCount = 0
    let errorCount = 0
    const errorsList: string[] = []

    // Prepare attachments
    const attachments: Array<{
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
        attachments.push({
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
        attachments.push({
          filename: 'barkod_za_uplatu.png',
          content: Buffer.from(qrBase64, 'base64'),
          contentType: qrMime,
          cid: 'qr_cid',
          contentDisposition: 'inline',
        })
      }
    }

    const defaultSubject = settings.paymentEmailSubject || 'Obavijest o nepodmirenoj članarini - HRD'
    const defaultBody = settings.paymentEmailBody || 'Poštovani/a {{name}},\n\nPrema evidenciji Hrvatskog rodoslovnog društva "Pavao Ritter Vitezović", molimo Vas za podmirenje godišnje članarine za tekuće razdoblje.'
    const defaultSignature = settings.paymentEmailSignature || 'Srdačan pozdrav,\nBlagajništvo Društva\nHRD "Pavao Ritter Vitezović"'

    const rawSubject = customSubject?.trim() || defaultSubject
    const rawBody = customBody?.trim() ? customBody.trim() : `${defaultBody}\n\n${defaultSignature}`

    const now = new Date().toISOString()

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

        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
        const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
        const origin = `${protocol}://${host}`

        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1B2B36; background-color: #F2EFE9; margin: 0; padding: 24px; }
    .card { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E8E4DE; overflow: hidden; box-shadow: 0 4px 20px rgba(27, 43, 54, 0.08); }
    .header { background: #1B2B36; color: #ffffff; padding: 26px 32px; border-bottom: 3px solid #CEA369; text-align: left; }
    .header h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; color: #ffffff; }
    .header p { margin: 6px 0 0; font-size: 13px; color: #CEA369; font-weight: 500; }
    .content { padding: 32px; }
    .greeting { font-size: 16px; font-weight: 700; color: #1B2B36; margin-bottom: 16px; }
    .text { font-size: 14px; color: #334155; margin-bottom: 24px; line-height: 1.7; white-space: pre-wrap; }
    .info-box { background: #FBF9F6; border-radius: 12px; border: 1px solid #E8E4DE; border-left: 4px solid #CEA369; padding: 16px 18px; margin: 22px 0; font-size: 13px; color: #1B2B36; }
    .member-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #334155; }
    .embed-card { margin: 24px 0; background: #FBF9F6; border: 1px solid #E8E4DE; border-radius: 12px; padding: 20px; text-align: center; }
    .embed-title { font-size: 14px; font-weight: 700; color: #1B2B36; margin-bottom: 6px; }
    .embed-desc { margin: 0 0 14px; font-size: 12px; color: #64748B; line-height: 1.5; }
    .btn-container { text-align: center; margin: 32px 0 28px; }
    .btn { display: inline-block; background-color: #1B2B36; color: #ffffff !important; text-decoration: none; padding: 13px 36px; border-radius: 9999px; font-weight: 700; font-size: 14px; letter-spacing: 0.03em; border: 2px solid #CEA369; box-shadow: 0 4px 14px rgba(27, 43, 54, 0.25); }
    .footer { font-size: 13px; color: #6B7280; border-top: 1px solid #E8E4DE; padding-top: 20px; text-align: left; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>Hrvatsko rodoslovno društvo</h2>
      <p>&bdquo;Pavao Ritter Vitezović&rdquo; &mdash; Službena obavijest o članarini</p>
    </div>
    <div class="content">
      <div class="greeting">Poštovani/a ${member.name},</div>
      <div class="text">${memberBody.replace(/\n/g, '<br>')}</div>

      <div class="member-box">
        <div style="font-weight: 700; color: #0F172A; margin-bottom: 4px;">Evidencija primatelja:</div>
        <div>Član: <strong>${member.name}</strong></div>
        ${member.registryNumber ? `<div>Broj matice: <strong>${member.registryNumber}</strong></div>` : ''}
        <div>Status članarine: <strong style="color: #DC2626;">Dug za tekuće razdoblje</strong></div>
      </div>

      ${includeQr && qrBase64 ? `
      <div class="embed-card">
        <div class="embed-title">2D barkod za brzo plaćanje (m-banking)</div>
        <p class="embed-desc">Skenirajte ovaj barkod kamerom unutar aplikacije Vaše banke (&bdquo;Skeniraj i plati&rdquo;) za trenutačno i točno popunjavanje naloga za uplatu.</p>
        <div style="display: inline-block; background: #ffffff; padding: 12px; border-radius: 10px; border: 1px solid #E8E4DE; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
          <img src="cid:qr_cid" alt="2D Barkod za uplatu" style="max-width: 240px; width: 100%; height: auto; display: block; margin: 0 auto;" />
        </div>
      </div>` : ''}

      ${includeSlip && slipBase64 ? `
      <div class="embed-card">
        <div class="embed-title">Uplatnica HUB-3 za uplatu članarine</div>
        <p class="embed-desc">Uplatu možete izvršiti i putem internetskog bankarstva ili na šalteru banke/pošte/FINA-e prema prikazanoj uplatnici.</p>
        <div style="background: #ffffff; padding: 10px; border-radius: 10px; border: 1px solid #E8E4DE; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
          <img src="cid:uplatnica_cid" alt="Uplatnica HUB-3" style="max-width: 100%; width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 4px;" />
        </div>
      </div>` : ''}

      ${attachments.length > 0 ? `
      <div class="info-box">
        <strong style="color: #CEA369;">Ugrađeni prilozi:</strong> Uplatnica i 2D barkod su ugrađeni izravno u poruku iznad, a dostupni su i u privitku ove e-pošte za preuzimanje i ispis.
      </div>` : ''}

      <div class="btn-container">
        <a href="${origin}/" class="btn" target="_blank">Prijavite se u sustav &rarr;</a>
      </div>

      <div class="footer">
        Hrvatsko rodoslovno društvo &bdquo;Pavao Ritter Vitezović&rdquo;<br>
        <span style="font-size: 12px; color: #9CA3AF;">Službena evidencija članstva &bull; Blagajništvo Društva</span>
      </div>
    </div>
  </div>
</body>
</html>`

        await sendEmail({
          to: member.email,
          subject: memberSubject,
          body: memberBody,
          html: htmlBody,
          config: settings,
          attachments
        })
        
        // Trajno zapiši datum i vrijeme slanja opomene kod člana u bazi
        try {
          await memberService.updateMember(member.id, {
            lastPaymentReminderAt: now
          })
        } catch (dbErr) {
          console.error(`Greška pri ažuriranju datuma opomene za člana ${member.id}:`, dbErr)
        }

        // Trajno zabilježi slanje opomene u dnevnik aktivnosti sustava (activity_logs)
        try {
          DatabaseService.insertLog({
            userId: sender?.userId || 'system',
            userName: sender?.userName || 'Administrator',
            userRole: sender?.userRole || 'admin',
            action: 'Slanje podsjetnika za članarinu',
            details: `Poslan podsjetnik za članarinu članu: ${member.name} (${member.email}). Predmet: "${memberSubject}"`,
            timestamp: now
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
      return NextResponse.json({ 
        success: false, 
        count: 0, 
        errors: errorCount,
        error: `Slanje nije uspjelo za niti jednog primatelja. ${errorsList[0] || 'Provjerite SMTP postavke.'}`,
        details: errorsList
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      count: sentCount, 
      errors: errorCount,
      sentAt: now,
      message: `Uspješno poslano ${sentCount} obavijest(i). ${errorCount > 0 ? `Neuspjelo: ${errorCount}.` : ''}`,
      details: errorsList
    })

  } catch (error: any) {
    console.error('Payment notification error:', error)
    return NextResponse.json({ error: error.message || 'Interna greška poslužitelja.' }, { status: 500 })
  }
}
