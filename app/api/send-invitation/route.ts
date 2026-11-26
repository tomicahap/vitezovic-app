import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'
import { MemberService } from '@/src/services/member-service'
import { SettingsService } from '@/src/services/settings-service'
import { buildHrdMasterEmail, escapeHtml } from '@/lib/hrd-email-system'
import { DatabaseService } from '@/lib/database'
import { DoNotContactBlockedError, formatDoNotContactError } from '@/lib/do-not-contact'
import { hashPassword } from '@/lib/password-hash'

const memberService = new MemberService()
const settingsService = new SettingsService()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { memberId, email, name, tempPassword, subject, customBody, testOnly, testEmail, sender } = body

    if (!email || !name) {
      return NextResponse.json(
        { error: 'Nedostaju obvezni podaci za slanje pozivnice (email ili ime).' },
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

    const resolvedPassword =
      typeof tempPassword === 'string' && tempPassword.trim()
        ? tempPassword.trim()
        : crypto.randomBytes(16).toString('hex')

    const invitationToken = !testOnly && memberId ? crypto.randomBytes(32).toString('hex') : 'test-pregled'
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const inviteUrl = `${origin}/pozivnica/${invitationToken}`

    const emailSubject = subject?.trim() || settings?.invitationEmailSubject || 'Pozivnica za pristup sustavu HRD'

    const defaultText = `Pozivamo Vas da aktivirate svoj pristup u službeni informacijski sustav Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović” (Rodoslovac).\n\nKlikom na poveznicu ispod automatski ćete biti prijavljeni u sustav, gdje ćete odmah postaviti svoju novu osobnu lozinku (bez potrebe za unosom stare lozinke). Nakon postavljanja lozinke, ubuduće se prijavljujete svojim korisničkim imenom i novom lozinkom.`

    const emailText = customBody?.trim() ? customBody.trim() : defaultText

    const infoBoxHtml = `
      <div style="margin-bottom: 8px;"><strong>Korisničko ime (Username / E-pošta):</strong><br/><code style="background: #FFFFFF; padding: 3px 8px; border: 1px solid #E2E8F0; color: #1E3A5F; font-weight: bold; display: inline-block; margin-top: 2px;">${escapeHtml(email)}</code></div>
      <div style="margin-bottom: 8px;"><strong>Izravna poveznica za aktivaciju i postavljanje lozinke:</strong><br/><a href="${escapeHtml(inviteUrl)}" style="color: #1F77C5; font-weight: bold; word-break: break-all;">${escapeHtml(inviteUrl)}</a></div>
      <div style="font-size: 12px; color: #475569; margin-top: 6px;">Nakon postavljanja lozinke, za svaku buduću prijavu koristite adresu <a href="${escapeHtml(origin)}/" style="color: #1F77C5;">${escapeHtml(origin)}/</a> te gore navedeno korisničko ime i svoju novu lozinku.</div>
    `

    const built = buildHrdMasterEmail({
      templateType: 'informacije_clanstvo',
      title: emailSubject,
      greeting: `Poštovani/a ${name},`,
      bodyTextOrHtml: emailText,
      infoBoxTitle: 'Vaši pristupni podaci za sustav Rodoslovac',
      infoBoxHtml,
      ctaText: 'Aktiviraj pristup i postavi lozinku',
      ctaUrl: inviteUrl,
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
          password: hashPassword(resolvedPassword),
          is_temp_password: 1,
          isTempPassword: true,
          invitation_token: invitationToken,
          invitationToken: invitationToken,
          invitation_token_expires_at: tokenExpiresAt,
          invitationTokenExpiresAt: tokenExpiresAt,
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
          details: `Poslana pozivnica s izravnom poveznicom za aktivaciju članu: ${name} (${email}).`,
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
