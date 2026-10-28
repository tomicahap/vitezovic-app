import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'
import { MemberService } from '@/src/services/member-service'
import { SettingsService } from '@/src/services/settings-service'
import { DatabaseService } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pollTitle, targetType, selectedMemberIds, customSubject, customBody, sender } = body

    const memberService = new MemberService()
    const settingsService = new SettingsService()
    const settings = await settingsService.getSettings()

    if (!settings || !settings.smtpFrom || !settings.smtpHost) {
      return NextResponse.json({ error: 'SMTP poslužitelj nije konfiguriran u postavkama sustava.' }, { status: 400 })
    }

    const allMembers = await memberService.getAllMembers()
    
    let targetMembers = []
    if (targetType === 'all') {
      targetMembers = allMembers
    } else if (Array.isArray(selectedMemberIds)) {
      targetMembers = allMembers.filter(m => selectedMemberIds.includes(m.id))
    } else {
      targetMembers = allMembers
    }

    // Filtriraj one koji imaju email
    const validMembers = targetMembers.filter(m => m.email && m.email.includes('@'))

    if (validMembers.length === 0) {
      return NextResponse.json({ error: 'Niti jedan primatelj nema valjanu email adresu.' }, { status: 400 })
    }

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
    const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const origin = `${protocol}://${host}`

    const defaultSubject = `Obavezno glasovanje: ${pollTitle}`
    const finalSubject = customSubject?.trim() || defaultSubject

    let sentCount = 0
    let failedCount = 0

    const emailPromises = validMembers.map(async (member) => {
      const defaultText = `Poštovane članice i članovi tijela Društva,

Obavještavamo Vas da je u sustavu HRD otvoreno novo obavezno glasovanje:

"${pollTitle}"

Molimo Vas da se prijavite u sustav kako biste dali svoj glas. Prema pravilniku Društva, Vaše sudjelovanje je obavezno za donošenje pravovaljanih odluka.

Poveznica za prijavu u sustav: ${origin}

Srdačan pozdrav,
Tajništvo Društva
Hrvatsko rodoslovno društvo "Pavao Ritter Vitezović"`

      const memberBody = customBody?.trim()
        ? customBody.replace(/{{name}}/gi, member.name).replace(/{{ime}}/gi, member.name)
        : defaultText

      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1B2B36; background-color: #F2EFE9; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E8E4DE; overflow: hidden; box-shadow: 0 4px 20px rgba(27, 43, 54, 0.08); }
    .header { background: #1B2B36; color: #ffffff; padding: 26px 32px; border-bottom: 3px solid #CEA369; }
    .header h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; color: #ffffff; }
    .header p { margin: 6px 0 0; font-size: 13px; color: #CEA369; font-weight: 500; }
    .content { padding: 32px; }
    .poll-box { background: #FBF9F6; border-radius: 12px; border: 1px solid #E8E4DE; border-left: 4px solid #CEA369; padding: 20px; margin: 24px 0; }
    .btn-container { text-align: center; margin: 32px 0 28px; }
    .btn { display: inline-block; background-color: #1B2B36; color: #ffffff !important; text-decoration: none; padding: 13px 36px; border-radius: 9999px; font-weight: 700; font-size: 14px; letter-spacing: 0.03em; border: 2px solid #CEA369; box-shadow: 0 4px 14px rgba(27, 43, 54, 0.25); }
    .footer { font-size: 13px; color: #6B7280; border-top: 1px solid #E8E4DE; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>Hrvatsko rodoslovno društvo</h2>
      <p>"Pavao Ritter Vitezović" — Službeno glasovanje</p>
    </div>
    <div class="content">
      <div style="font-size: 16px; font-weight: 700; color: #1B2B36; margin-bottom: 12px;">Poštovane članice i članovi tijela Društva,</div>
      <p style="font-size: 14px; color: #334155; margin-bottom: 16px; line-height: 1.6;">
        Obavještavamo Vas da je u sustavu HRD otvoreno novo glasovanje:
      </p>
      <div class="poll-box">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: #CEA369; margin-bottom: 6px;">Naziv ankete:</div>
        <div style="font-size: 16px; font-weight: 700; color: #1B2B36;">${pollTitle}</div>
      </div>
      <div class="btn-container">
        <a href="${origin}/" class="btn" target="_blank">Prijavite se i glasujte &rarr;</a>
      </div>
      <div class="footer">
        Hrvatsko rodoslovno društvo "Pavao Ritter Vitezović"<br>
        <span style="font-size: 12px; color: #9CA3AF;">Službeni sustav za elektroničko glasovanje</span>
      </div>
    </div>
  </div>
</body>
</html>`

      try {
        await sendEmail({
          to: member.email,
          subject: finalSubject,
          body: memberBody,
          html: htmlBody,
          config: settings
        })
        sentCount++
      } catch (e) {
        console.error(`Greška pri slanju maila članu ${member.email}:`, e)
        failedCount++
      }
    })

    await Promise.all(emailPromises)

    if (sentCount === 0 && failedCount > 0) {
      return NextResponse.json({ 
        error: 'Niti jedan e-mail nije poslan! Provjerite SMTP postavke poslužitelja.' 
      }, { status: 500 })
    }

    const now = new Date().toISOString()

    // Trajno bilježenje u bazu activity_logs: kome i kada je poslan mail
    try {
      const recipientSummary = validMembers.length <= 4
        ? validMembers.map(m => `${m.name} (${m.email})`).join(', ')
        : `${validMembers.slice(0, 3).map(m => `${m.name} (${m.email})`).join(', ')} i još ${validMembers.length - 3} primatelja`

      DatabaseService.insertLog({
        userId: sender?.userId || 'system',
        userName: sender?.userName || 'Administrator',
        userRole: sender?.userRole || 'admin',
        action: 'Slanje obavijesti o glasovanju',
        details: `Poslana e-mail obavijest za glasovanje: "${pollTitle}". Uspješno poslano: ${sentCount}/${validMembers.length}. Primatelji: ${recipientSummary}. Predmet: "${finalSubject}"`,
        timestamp: now
      })
    } catch (dbErr) {
      console.error('Greška pri upisu u activity_logs za poll notification:', dbErr)
    }

    return NextResponse.json({ 
      success: true, 
      sentCount,
      failedCount,
      sentAt: now,
      message: `Uspješno poslano ${sentCount} obavijest(i). ${failedCount > 0 ? `Neuspjelo: ${failedCount}.` : ''}` 
    })
  } catch (error: any) {
    console.error('Poll Notification API error:', error)
    return NextResponse.json({ error: error.message || 'Interna greška servera.' }, { status: 500 })
  }
}
