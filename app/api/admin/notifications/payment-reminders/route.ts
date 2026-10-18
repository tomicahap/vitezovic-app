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
    const attachments: Array<{ filename: string; content: string; encoding: string }> = []
    if (includeSlip && settings.paymentSlipUrl && settings.paymentSlipUrl.includes(',')) {
      attachments.push({
        filename: 'uplatnica.png',
        content: settings.paymentSlipUrl.split(',')[1],
        encoding: 'base64'
      })
    }
    if (includeQr && settings.paymentQrUrl && settings.paymentQrUrl.includes(',')) {
      attachments.push({
        filename: '3d-qr-kod.png',
        content: settings.paymentQrUrl.split(',')[1],
        encoding: 'base64'
      })
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

        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: #b91c1c; color: #ffffff; padding: 24px 32px; }
    .header h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 6px 0 0; font-size: 13px; color: #fecaca; }
    .content { padding: 32px; }
    .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }
    .text { font-size: 14px; color: #334155; margin-bottom: 24px; white-space: pre-wrap; }
    .info-box { background: #fff1f2; border-radius: 12px; border: 1px solid #fecdd3; padding: 18px; margin-bottom: 24px; }
    .footer { font-size: 13px; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>Hrvatsko rodoslovno društvo</h2>
      <p>"Pavao Ritter Vitezović" — Obavijest o članarini</p>
    </div>
    <div class="content">
      <div class="greeting">Poštovani/a ${member.name},</div>
      <div class="text">${memberBody.replace(/\n/g, '<br>')}</div>
      ${attachments.length > 0 ? `
      <div class="info-box">
        <strong>Prilozi za uplatu:</strong> U prilogu ove poruke nalazi se uplatnica i 2D/3D barkod za jednostavno plaćanje putem mobilnog bankarstva.
      </div>` : ''}
      <div class="footer">
        Hrvatsko rodoslovno društvo "Pavao Ritter Vitezović"<br>
        <span style="font-size: 12px; color: #94a3b8;">Službena evidencija članstva</span>
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
