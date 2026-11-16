import { NextRequest, NextResponse } from 'next/server'
import { MemberService } from '@/src/services/member-service'
import { SettingsService } from '@/src/services/settings-service'
import { sendEmail } from '@/lib/mail'
import { DatabaseService } from '@/lib/database'
import { buildHrdMasterEmail, escapeHtml } from '@/lib/hrd-email-system'
import { formatDateDMY } from '@/lib/utils'

const memberService = new MemberService()
const settingsService = new SettingsService()

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
    const { memberId, customSubject, customBody, sender, testOnly, testEmail } = body

    if (!memberId) {
      return NextResponse.json({ error: 'Nedostaje ID člana.' }, { status: 400 })
    }

    const member = await memberService.getMember(Number(memberId))
    if (!member) {
      return NextResponse.json({ error: 'Član nije pronađen.' }, { status: 404 })
    }

    if (!testOnly && (!member.email || !member.email.includes('@'))) {
      return NextResponse.json(
        { error: `${member.name} nema unesenu valjanu email adresu.` },
        { status: 400 }
      )
    }

    const defaultSubject =
      (settings as any).birthdayEmailSubject ||
      'Sretan rođendan želi Vam HRD „Pavao Ritter Vitezović”!'
    const defaultBody =
      (settings as any).birthdayEmailBody ||
      'Poštovani/a {{name}},\n\nU ime Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović” od srca Vam želimo sretan rođendan, puno zdravlja, radosti i uspjeha u daljnjem radu i istraživanju!'

    const rawSubject = customSubject?.trim() || defaultSubject
    const rawBody = customBody?.trim() || defaultBody

    const memberSubject = rawSubject
      .replace(/{{name}}/gi, member.name)
      .replace(/{{ime}}/gi, member.name)

    const memberBody = rawBody
      .replace(/{{name}}/gi, member.name)
      .replace(/{{ime}}/gi, member.name)
      .replace(/{{email}}/gi, member.email || '')

    const built = buildHrdMasterEmail({
      templateType: 'obavijest_clanovima',
      title: memberSubject,
      subtitle: 'Rođendanska čestitka članu Društva',
      bodyTextOrHtml: memberBody,
      infoBoxTitle: `Sretan rođendan, ${member.name}!`,
      infoBoxHtml: `<div>Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović” želi Vam sve najbolje povodom Vašeg rođendana${
        member.birthDate ? ` (${escapeHtml(formatDateDMY(member.birthDate, member.birthDate))})` : ''
      }!</div>`,
      settings,
      sender,
    })

    const now = new Date().toISOString()
    const targetRecipient = testOnly
      ? testEmail?.trim() || settings.smtpFrom
      : member.email

    await sendEmail({
      to: targetRecipient,
      subject: testOnly ? `[TEST] ${memberSubject}` : memberSubject,
      body: built.plainText,
      html: built.html,
      config: settings,
      attachments: built.inlineAttachments,
    })

    if (!testOnly) {
      try {
        await memberService.updateMember(member.id, {
          lastBirthdayEmailAt: now,
        })
      } catch (dbErr) {
        console.error(`Greška pri ažuriranju datuma rođendanske čestitke za člana ${member.id}:`, dbErr)
      }

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
    }

    return NextResponse.json({
      success: true,
      testOnly: Boolean(testOnly),
      sentAt: now,
      message: testOnly
        ? `Testna rođendanska čestitka poslana je na ${targetRecipient}!`
        : `Rođendanska čestitka je uspješno poslana na ${member.email}!`,
      warnings: built.warnings,
    })
  } catch (error: any) {
    console.error('Birthday email error:', error)
    return NextResponse.json(
      { error: error.message || 'Interna greška poslužitelja prilikom slanja rođendanske čestitke.' },
      { status: 500 }
    )
  }
}
