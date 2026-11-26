import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAppDb, DatabaseService } from '@/lib/database'
import { SettingsService } from '@/src/services/settings-service'
import { sendEmail } from '@/lib/mail'
import { buildHrdMasterEmail, escapeHtml } from '@/lib/hrd-email-system'

const resetRateLimiter = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 3

const NEUTRAL_RESPONSE_MESSAGE =
  'Ako je upisana e-mail adresa registrirana u sustavu, poslana joj je jednokratna poveznica za postavljanje nove lozinke (vrijedi 60 minuta).'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawEmail = typeof body?.email === 'string' ? body.email.trim() : ''
    const normalizedEmail = rawEmail.toLowerCase()

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Unesite valjanu e-mail adresu.' },
        { status: 400 }
      )
    }

    const now = Date.now()
    const existing = resetRateLimiter.get(normalizedEmail)
    if (existing && existing.resetAt > now) {
      if (existing.count >= MAX_REQUESTS_PER_WINDOW) {
        return NextResponse.json({ success: true, message: NEUTRAL_RESPONSE_MESSAGE })
      }
      existing.count += 1
    } else {
      resetRateLimiter.set(normalizedEmail, { count: 1, resetAt: now + WINDOW_MS })
    }

    const db = getAppDb()
    const member = db
      .prepare('SELECT * FROM members WHERE lower(trim(email)) = ? LIMIT 1')
      .get(normalizedEmail) as any

    // Nikada ne otkrivati postoji li adresa u bazi
    if (!member || member.deceased === 1 || member.deceased === true) {
      return NextResponse.json({ success: true, message: NEUTRAL_RESPONSE_MESSAGE })
    }

    const settingsService = new SettingsService()
    const settings = await settingsService.getSettings()
    const host =
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host') ||
      request.nextUrl.host
    const protocol =
      request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const origin = `${protocol}://${host}`

    const resetToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(now + 60 * 60 * 1000).toISOString() // 60 minuta
    const resetUrl = `${origin}/pozivnica/${resetToken}`

    const infoBoxHtml = `
      <div style="margin-bottom: 8px;"><strong>Korisničko ime (Username / E-pošta):</strong><br/><code style="background: #FFFFFF; padding: 3px 8px; border: 1px solid #E2E8F0; color: #1E3A5F; font-weight: bold; display: inline-block; margin-top: 2px;">${escapeHtml(member.email)}</code></div>
      <div style="margin-bottom: 8px;"><strong>Poveznica za postavljanje nove lozinke:</strong><br/><a href="${escapeHtml(resetUrl)}" style="color: #1F77C5; font-weight: bold; word-break: break-all;">${escapeHtml(resetUrl)}</a></div>
      <div style="font-size: 12px; color: #7C2D12; margin-top: 6px;"><strong>Napomena:</strong> Poveznica je jednokratna i vrijedi 60 minuta. Ako niste zatražili promjenu lozinke, zanemarite ovu poruku.</div>
    `

    const built = buildHrdMasterEmail({
      templateType: 'informacije_clanstvo',
      title: 'Postavljanje nove lozinke — Rodoslovac',
      greeting: `Poštovani/a ${member.name},`,
      bodyTextOrHtml:
        'Zaprimili smo zahtjev za postavljanje nove lozinke za Vaš korisnički račun u sustavu Rodoslovac.\n\nKlikom na gumb ispod automatski ćete se prijaviti i postaviti svoju novu lozinku (bez upisivanja stare lozinke).',
      infoBoxTitle: 'Jednokratna poveznica za oporavak pristupa',
      infoBoxHtml,
      ctaText: 'Postavi novu lozinku',
      ctaUrl: resetUrl,
      closingText: 'Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”',
      settings,
    })

    await sendEmail({
      to: member.email,
      subject: 'Postavljanje nove lozinke — Rodoslovac (HRD)',
      body: built.plainText,
      html: built.html,
      config: settings,
      attachments: built.inlineAttachments,
    })

    db.prepare(
      'UPDATE members SET invitation_token = ?, invitation_token_expires_at = ?, is_temp_password = 1 WHERE id = ?'
    ).run(resetToken, expiresAt, member.id)

    try {
      DatabaseService.insertLog({
        userId: String(member.id),
        userName: member.name || 'Član',
        userRole: member.role || 'member',
        action: 'Zahtjev za novu lozinku',
        details: `Poslana jednokratna poveznica za oporavak lozinke članu ${member.name} (${member.email}).`,
      })
    } catch {}

    return NextResponse.json({ success: true, message: NEUTRAL_RESPONSE_MESSAGE })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Trenutno nije moguće poslati poveznicu za oporavak lozinke.' },
      { status: 500 }
    )
  }
}
