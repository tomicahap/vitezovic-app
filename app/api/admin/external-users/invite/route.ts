import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService, ExternalUsersDB } from '@/lib/database'
import { SettingsService } from '@/src/services/settings-service'
import { sendEmail } from '@/lib/mail'
import { buildHrdMasterEmail, escapeHtml } from '@/lib/hrd-email-system'
import { hashPassword } from '@/lib/password-hash'
import { extractActor } from '@/lib/trash'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const settingsService = new SettingsService()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const actor = extractActor(request, body)
    if ((actor.role || '').trim().toLowerCase() !== 'admin') {
      return NextResponse.json(
        { error: 'Samo Administrator može slati pozivnice vanjskim suradnicima.' },
        { status: 403 }
      )
    }

    const { externalUserId, customBody, subject, testOnly, testEmail } = body
    const extId = Number(externalUserId)
    if (!Number.isFinite(extId) || extId <= 0) {
      return NextResponse.json({ error: 'Nedostaje ID vanjskog suradnika.' }, { status: 400 })
    }

    const extUser = ExternalUsersDB.getRawById(extId)
    if (!extUser) {
      return NextResponse.json({ error: 'Vanjski suradnik nije pronađen.' }, { status: 404 })
    }

    if (!testOnly && (extUser.is_active === 0 || extUser.is_active === false)) {
      return NextResponse.json(
        { error: 'Vanjski suradnik je deaktiviran. Aktivirajte ga prije slanja pozivnice.' },
        { status: 400 }
      )
    }

    const settings = await settingsService.getSettings()
    const host =
      request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
    const protocol =
      request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const origin = `${protocol}://${host}`

    const invitationToken = !testOnly ? crypto.randomBytes(32).toString('hex') : 'test-pregled'
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const inviteUrl = `${origin}/pozivnica/${invitationToken}`

    const emailSubject =
      String(subject || '').trim() ||
      'Pozivnica za suradnju u modulu Istraživanja — Rodoslovac (HRD)'

    const defaultText = `Pozivamo Vas da aktivirate svoj pristup modulu „Istraživanja” u informacijskom sustavu Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović” (Rodoslovac) kao vanjski suradnik (bez učlanjenja u Društvo).\n\nKlikom na poveznicu ispod automatski ćete biti prijavljeni u sustav i odmah ćete postaviti svoju osobnu lozinku. Nakon postavljanja lozinke imat ćete izravan pristup dodijeljenim i odobrenim istraživačkim predmetima.`

    const emailText = String(customBody || '').trim() || defaultText

    const infoBoxHtml = `
      <div style="margin-bottom: 8px;"><strong>Vrsta pristupa:</strong> Vanjski suradnik — modul <strong>Istraživanja</strong></div>
      <div style="margin-bottom: 8px;"><strong>Korisničko ime (Username / E-pošta):</strong><br/><code style="background: #FFFFFF; padding: 3px 8px; border: 1px solid #E2E8F0; color: #1E3A5F; font-weight: bold; display: inline-block; margin-top: 2px;">${escapeHtml(extUser.email)}</code></div>
      <div style="margin-bottom: 8px;"><strong>Izravna poveznica za aktivaciju i postavljanje lozinke:</strong><br/><a href="${escapeHtml(inviteUrl)}" style="color: #1F77C5; font-weight: bold; word-break: break-all;">${escapeHtml(inviteUrl)}</a></div>
      <div style="font-size: 12px; color: #475569; margin-top: 6px;">Nakon postavljanja lozinke, za svaku buduću prijavu koristite adresu <a href="${escapeHtml(origin)}/" style="color: #1F77C5;">${escapeHtml(origin)}/</a> te gore navedeno korisničko ime i svoju novu lozinku.</div>
    `

    const built = buildHrdMasterEmail({
      templateType: 'poslovna_korespondencija',
      title: emailSubject,
      greeting: `Poštovani/a ${extUser.name},`,
      bodyTextOrHtml: emailText,
      infoBoxTitle: 'Pristupni podaci za vanjskog suradnika',
      infoBoxHtml,
      ctaText: 'Aktiviraj pristup i postavi lozinku',
      ctaUrl: inviteUrl,
      closingText: 'Zahvaljujemo na suradnji u istraživanjima,',
      settings,
      sender: {
        userId: actor.id || 'admin',
        userName: actor.name || 'Administrator',
        userEmail: actor.email,
        userRole: 'admin',
        userFunction: 'Administrator',
      },
    })

    const recipientEmail = testOnly
      ? String(testEmail || '').trim() || settings?.smtpFrom || extUser.email
      : extUser.email
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

    let updatedUser = null
    if (!testOnly) {
      const randomPassword = crypto.randomBytes(16).toString('hex')
      updatedUser = ExternalUsersDB.update(extId, {
        invitation_sent: 1,
        invitation_sent_at: sentAt,
        password: hashPassword(randomPassword),
        is_temp_password: 1,
        invitation_token: invitationToken,
        invitation_token_expires_at: tokenExpiresAt,
      })

      try {
        DatabaseService.insertLog({
          userId: actor.id || 'admin',
          userName: actor.name || 'Administrator',
          userRole: 'admin',
          action: 'Slanje pozivnice vanjskom suradniku',
          details: `Poslana aktivacijska pozivnica za Istraživanja vanjskom suradniku ${extUser.name} (${extUser.email}).`,
          timestamp: sentAt,
        })
      } catch {}
    }

    return NextResponse.json({
      success: true,
      testOnly: Boolean(testOnly),
      sentTo: recipientEmail,
      sentAt,
      externalUser: updatedUser,
      message: testOnly
        ? `Testna pozivnica uspješno je poslana na ${recipientEmail}.`
        : `Pozivnica za modul Istraživanja uspješno je poslana na ${extUser.email}.`,
    })
  } catch (e: any) {
    console.error('Error in POST /api/admin/external-users/invite:', e)
    return NextResponse.json(
      { error: e.message || 'Greška prilikom slanja pozivnice vanjskom suradniku.' },
      { status: 500 }
    )
  }
}
