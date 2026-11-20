import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'
import { MemberService } from '@/src/services/member-service'
import { SettingsService } from '@/src/services/settings-service'
import { buildHrdMasterEmail, escapeHtml } from '@/lib/hrd-email-system'
import { DatabaseService } from '@/lib/database'
import { DoNotContactBlockedError, formatDoNotContactError } from '@/lib/do-not-contact'

const memberService = new MemberService()
const settingsService = new SettingsService()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { memberId, email, name, tempPassword, subject, customBody, testOnly, testEmail, sender } = body

    if (!email || !name || !tempPassword) {
      return NextResponse.json(
        { error: 'Nedostaju obvezni podaci za slanje pozivnice (email, ime ili lozinka).' },
        { status: 400 }
      )
    }

    if (!testOnly && memberId) {
      const targetMember = await memberService.getMember(Number(memberId))
      if (targetMember?.doNotContact) {
        return NextResponse.json(
          {
            error: formatDoNotContactError([
              {
                id: targetMember.id,
                name: targetMember.name || name,
                email: targetMember.email || email,
                doNotContactDate: targetMember.doNotContactDate || '',
                doNotContactNote: targetMember.doNotContactNote || '',
              },
            ]),
          },
          { status: 403 }
        )
      }
    }

    const settings = await settingsService.getSettings()
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
    const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const origin = `${protocol}://${host}`

    const emailSubject = subject?.trim() || settings?.invitationEmailSubject || 'Pozivnica za pristup sustavu HRD'

    const defaultText = `Pozivamo Vas da se prijavite u službeni informacijski sustav Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović”.\n\nSigurnosna napomena: Priložena lozinka je privremena. Molimo Vas da je promijenite odmah prilikom prve prijave.`

    const emailText = customBody?.trim() ? customBody.trim() : defaultText

    const infoBoxHtml = `
      <div style="margin-bottom: 6px;"><strong>Korisničko ime (E-pošta):</strong> <code style="background: #FFFFFF; padding: 2px 6px; border: 1px solid #E2E8F0; color: #1E3A5F;">${escapeHtml(email)}</code></div>
      <div style="margin-bottom: 6px;"><strong>Privremena lozinka:</strong> <code style="background: #FFFFFF; padding: 2px 6px; border: 1px solid #E2E8F0; color: #7C2D12; font-weight: bold;">${escapeHtml(tempPassword)}</code></div>
      <div><strong>Poveznica za prijavu:</strong> <a href="${escapeHtml(origin)}/" style="color: #1F77C5; font-weight: bold;">${escapeHtml(origin)}/</a></div>
    `

    const built = buildHrdMasterEmail({
      templateType: 'informacije_clanstvo',
      title: emailSubject,
      greeting: `Poštovani/a ${name},`,
      bodyTextOrHtml: emailText,
      infoBoxTitle: 'Vaši pristupni podaci za prijavu u sustav',
      infoBoxHtml,
      ctaText: 'Prijavite se u sustav',
      ctaUrl: `${origin}/`,
      closingText: 'Dobro došli u sustav Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović”!',
      settings,
      sender,
    })

    const recipientEmail = testOnly ? (testEmail?.trim() || settings?.smtpFrom || email) : email
    const finalSubject = testOnly ? `[TEST] ${emailSubject}` : emailSubject
    const sentAt = new Date().toISOString()

    await sendEmail({
      to: recipientEmail,
      subject: finalSubject,
      body: built.plainText,
      html: built.html,
      config: settings,
      attachments: built.inlineAttachments,
    })

    if (!testOnly && memberId) {
      try {
        await memberService.updateMember(Number(memberId), {
          invitationSent: 1,
          invitation_sent_at: sentAt,
          invitationSentAt: sentAt,
          password: tempPassword,
          is_temp_password: 1,
          isTempPassword: true,
        })
      } catch (dbErr) {
        console.error('Greška pri ažuriranju statusa pozivnice u bazi:', dbErr)
      }

      try {
        DatabaseService.insertLog({
          userId: sender?.userId || 'system',
          userName: sender?.userName || 'Administrator',
          userRole: sender?.userRole || 'admin',
          action: 'Slanje pozivnice za sustav',
          details: `Poslana pozivnica članu: ${name} (${email}).`,
          timestamp: sentAt,
        })
      } catch {}
    }

    return NextResponse.json({
      success: true,
      testOnly: Boolean(testOnly),
      sentTo: recipientEmail,
      message: testOnly
        ? `Testna pozivnica uspješno je poslana na ${recipientEmail}.`
        : 'Pozivnica je uspješno poslana.',
      sentAt,
      warnings: built.warnings,
    })
  } catch (error: any) {
    if (error instanceof DoNotContactBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Greška u API ruti send-invitation:', error)
    return NextResponse.json(
      { error: error.message || 'Greška prilikom slanja pozivnice.' },
      { status: 500 }
    )
  }
}
