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
      const defaultText = `Poštovani/a ${member.name},

Obavještavamo Vas da je u sustavu HRD otvoreno novo obavezno glasovanje:

"${pollTitle}"

Molimo Vas da se prijavite u sustav kako biste dali svoj glas. Prema pravilniku Društva, Vaše sudjelovanje je obavezno za donošenje pravovaljanih odluka.

Link za prijavu i glasovanje: ${origin}/login

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
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: #0f766e; color: #ffffff; padding: 24px 32px; }
    .header h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 6px 0 0; font-size: 13px; color: #99f6e4; }
    .content { padding: 32px; }
    .poll-box { background: #f0fdfa; border-radius: 12px; border: 1px solid #ccfbf1; padding: 18px; margin: 20px 0; }
    .btn-container { text-align: center; margin: 24px 0; }
    .btn { display: inline-block; background: #0f766e; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; }
    .footer { font-size: 13px; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>Hrvatsko rodoslovno društvo</h2>
      <p>"Pavao Ritter Vitezović" — Službeno glasovanje</p>
    </div>
    <div class="content">
      <div style="font-size: 15px; font-weight: 600; margin-bottom: 12px;">Poštovani/a ${member.name},</div>
      <p style="font-size: 14px; color: #334155; margin-bottom: 16px;">
        Obavještavamo Vas da je u sustavu HRD otvoreno novo glasovanje za članove društva:
      </p>
      <div class="poll-box">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: #0f766e; margin-bottom: 6px;">Naziv ankete:</div>
        <div style="font-size: 16px; font-weight: 700; color: #134e4a;">${pollTitle}</div>
      </div>
      <div class="btn-container">
        <a href="${origin}/login" class="btn" target="_blank">Prijavite se i glasujte</a>
      </div>
      <p style="font-size: 12px; color: #64748b;">
        Prema pravilniku Društva, sudjelovanje u donošenju odluka je važno za rad udruge.
      </p>
      <div class="footer">
        Srdačan pozdrav,<br>
        <strong>Tajništvo Društva</strong><br>
        <span style="font-size: 12px; color: #94a3b8;">HRD "Pavao Ritter Vitezović"</span>
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
