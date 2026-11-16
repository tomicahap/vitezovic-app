import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'
import { SettingsService } from '@/src/services/settings-service'
import { buildHrdMasterEmail, escapeHtml, HrdEmailTemplateTypeId } from '@/lib/hrd-email-system'
import { DatabaseService } from '@/lib/database'

const settingsService = new SettingsService()

export async function POST(request: NextRequest) {
  try {
    const settings: any = await settingsService.getSettings()
    if (!settings || !settings.smtpHost || !settings.smtpFrom) {
      return NextResponse.json(
        { error: 'SMTP poslužitelj nije konfiguriran u postavkama sustava.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      action = 'send',
      to,
      cc,
      bcc,
      subject,
      templateType = 'sluzbena_obavijest',
      title,
      greeting,
      bodyText,
      infoBoxTitle,
      infoBoxContent,
      ctaText,
      ctaUrl,
      closingText,
      sender,
      testOnly,
      testEmail,
    } = body

    const built = buildHrdMasterEmail({
      templateType: templateType as HrdEmailTemplateTypeId,
      title: title || subject || 'Službena poruka',
      greeting: greeting?.trim() || undefined,
      bodyTextOrHtml: bodyText || '',
      infoBoxTitle: infoBoxTitle?.trim() || undefined,
      infoBoxHtml: infoBoxContent?.trim()
        ? `<div>${escapeHtml(infoBoxContent).replace(/\n/g, '<br/>')}</div>`
        : undefined,
      ctaText: ctaText?.trim() || undefined,
      ctaUrl: ctaUrl?.trim() || undefined,
      closingText: closingText?.trim() || undefined,
      settings,
      sender,
      forBrowserPreview: action === 'preview',
    })

    if (action === 'preview') {
      return NextResponse.json({
        success: true,
        html: built.html,
        plainText: built.plainText,
        warnings: built.warnings,
      })
    }

    const targetRecipient = testOnly
      ? testEmail?.trim() || settings.smtpFrom
      : String(to || '').trim()

    if (!targetRecipient) {
      return NextResponse.json({ error: 'Unesite primatelja e-pošte.' }, { status: 400 })
    }

    const finalSubject = testOnly
      ? `[TEST] ${subject || title || 'Službena poruka'}`
      : subject || title || 'Službena poruka'

    await sendEmail({
      to: targetRecipient,
      cc: testOnly ? undefined : cc?.trim() || undefined,
      bcc: testOnly ? undefined : bcc?.trim() || undefined,
      subject: finalSubject,
      body: built.plainText,
      html: built.html,
      config: settings,
      attachments: built.inlineAttachments,
    })

    const now = new Date().toISOString()
    if (!testOnly) {
      try {
        DatabaseService.insertLog({
          userId: sender?.userId || 'system',
          userName: sender?.userName || 'Administrator',
          userRole: sender?.userRole || 'admin',
          action: 'Slanje službenog e-maila (HRD uređivač)',
          details: `Poslan službeni e-mail (${templateType}) primatelju: ${targetRecipient}. Predmet: "${finalSubject}"`,
          timestamp: now,
        })
      } catch {}
    }

    return NextResponse.json({
      success: true,
      testOnly: Boolean(testOnly),
      sentTo: targetRecipient,
      sentAt: now,
      message: testOnly
        ? `Testni e-mail uspješno je poslan na ${targetRecipient}.`
        : `Službeni e-mail uspješno je poslan primatelju ${targetRecipient}.`,
      warnings: built.warnings,
    })
  } catch (error: any) {
    console.error('Compose official email error:', error)
    return NextResponse.json(
      { error: error.message || 'Greška prilikom slanja službenog e-maila.' },
      { status: 500 }
    )
  }
}
