import { NextRequest, NextResponse } from 'next/server'
import { MemberService } from '@/src/services/member-service'
import { SettingsService } from '@/src/services/settings-service'
import { sendEmail } from '@/lib/mail'
import { DatabaseService } from '@/lib/database'

const memberService = new MemberService()
const settingsService = new SettingsService()

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json()
    const { memberId, customSubject, customBody, sender } = body

    if (!memberId) {
      return NextResponse.json({ error: 'Nedostaje ID člana.' }, { status: 400 })
    }

    const member = await memberService.getMember(Number(memberId))
    if (!member) {
      return NextResponse.json({ error: 'Član nije pronađen.' }, { status: 404 })
    }

    if (!member.email || !member.email.includes('@')) {
      return NextResponse.json(
        { error: `${member.name} nema unesenu valjanu email adresu.` },
        { status: 400 }
      )
    }

    const defaultSubject =
      (settings as any).birthdayEmailSubject ||
      'Sretan rođendan želi Vam HRD "Pavao Ritter Vitezović"!'
    const defaultBody =
      (settings as any).birthdayEmailBody ||
      'Poštovani/a {{name}},\n\nU ime Hrvatskog rodoslovnog društva "Pavao Ritter Vitezović" od srca Vam želimo sretan rođendan, puno zdravlja, radosti i uspjeha u daljnjem radu i istraživanju!\n\nSrdačan pozdrav,\nHRD "Pavao Ritter Vitezović"'

    const rawSubject = customSubject?.trim() || defaultSubject
    const rawBody = customBody?.trim() || defaultBody

    const memberSubject = rawSubject
      .replace(/{{name}}/gi, member.name)
      .replace(/{{ime}}/gi, member.name)

    const memberBody = rawBody
      .replace(/{{name}}/gi, member.name)
      .replace(/{{ime}}/gi, member.name)
      .replace(/{{email}}/gi, member.email)

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
    .banner { background: #FDF8F0; border-bottom: 1px solid #E8E4DE; padding: 14px 32px; font-size: 14px; font-weight: 700; color: #9A6B2F; }
    .content { padding: 32px; }
    .text { font-size: 14px; color: #334155; margin-bottom: 24px; line-height: 1.75; }
    .footer { font-size: 13px; color: #6B7280; border-top: 1px solid #E8E4DE; padding-top: 20px; text-align: left; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>Hrvatsko rodoslovno društvo</h2>
      <p>&bdquo;Pavao Ritter Vitezović&rdquo; &mdash; Rođendanska čestitka</p>
    </div>
    <div class="banner">
      &#127874; Sretan rođendan, ${escapeHtml(member.name)}!
    </div>
    <div class="content">
      <div class="text">${escapeHtml(memberBody).replace(/\n/g, '<br>')}</div>
      <div class="footer">
        Hrvatsko rodoslovno društvo &bdquo;Pavao Ritter Vitezović&rdquo;<br>
        <span style="font-size: 12px; color: #9CA3AF;">Službena čestitka Društva</span>
      </div>
    </div>
  </div>
</body>
</html>`

    const now = new Date().toISOString()

    await sendEmail({
      to: member.email,
      subject: memberSubject,
      body: memberBody,
      html: htmlBody,
      config: settings,
    })

    // Trajno zapiši datum i vrijeme slanja rođendanske čestitke u evidenciju člana
    try {
      await memberService.updateMember(member.id, {
        lastBirthdayEmailAt: now,
      })
    } catch (dbErr) {
      console.error(`Greška pri ažuriranju datuma rođendanske čestitke za člana ${member.id}:`, dbErr)
    }

    // Zabilježi u dnevnik aktivnosti sustava
    try {
      DatabaseService.insertLog({
        userId: sender?.userId || 'system',
        userName: sender?.userName || 'Administrator',
        userRole: sender?.userRole || 'admin',
        action: 'Slanje rođendanske čestitke',
        details: `Poslana rođendanska čestitka članu: ${member.name} (${member.email}). Predmet: "${memberSubject}"`,
        timestamp: now,
      })
    } catch (logErr) {
      console.error(`Greška pri upisu aktivnosti za rođendansku čestitku člana ${member.id}:`, logErr)
    }

    return NextResponse.json({
      success: true,
      sentAt: now,
      message: `Rođendanska čestitka je uspješno poslana na ${member.email}!`,
    })
  } catch (error: any) {
    console.error('Birthday email error:', error)
    return NextResponse.json(
      { error: error.message || 'Interna greška poslužitelja prilikom slanja rođendanske čestitke.' },
      { status: 500 }
    )
  }
}
