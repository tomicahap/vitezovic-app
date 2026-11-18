import { NextRequest, NextResponse } from 'next/server'
import { MemberService } from '@/src/services/member-service'
import { SettingsService } from '@/src/services/settings-service'
import { getAppDb, DatabaseService } from '@/lib/database'
import { sendEmail } from '@/lib/mail'
import { buildHrdMasterEmail, escapeHtml } from '@/lib/hrd-email-system'
import { isBoardMember, getMemberActiveFunctions, formatDateTimeDMY } from '@/lib/utils'
import { extractActor } from '@/lib/trash'

export const dynamic = 'force-dynamic'
export const revalidate = 0

let lastAutoCheckRunAt = 0
let inactivitySendInProgress = false

function isAdminEntry(m: any): boolean {
  const r = String(m?.role || '').trim().toLowerCase()
  const e = String(m?.email || '').trim().toLowerCase()
  const n = String(m?.name || '').trim().toLowerCase()
  return r === 'admin' || e === 'admin' || n === 'administrator' || n === 'rezervni administrator'
}

function resolveLastAdminLoginIso(settings: any): string | null {
  if (settings?.lastAdminLoginAt) return String(settings.lastAdminLoginAt)
  try {
    const db = getAppDb()
    const row = db
      .prepare(
        "SELECT current_login_at FROM user_login_tracking WHERE user_id IN ('2579', '0') ORDER BY current_login_at DESC LIMIT 1"
      )
      .get() as any
    if (row?.current_login_at) {
      const normalized = String(row.current_login_at).includes('T')
        ? String(row.current_login_at)
        : String(row.current_login_at).replace(' ', 'T') + 'Z'
      const d = new Date(normalized)
      if (!isNaN(d.getTime())) return d.toISOString()
    }
  } catch {}
  return null
}

function getBoardRecipients(members: any[]) {
  const seen = new Set<string>()
  const recipients: Array<{ id: number; name: string; email: string; roleLabel: string }> = []

  for (const m of members) {
    if (!m || m.deceased || m.expelled || isAdminEntry(m)) continue
    const email = String(m.email || '').trim()
    if (!email || !email.includes('@')) continue

    const hasActiveBoardFn = isBoardMember(m)
    const isMod = String(m.role || '').trim().toLowerCase() === 'moderator'
    if (!hasActiveBoardFn && !isMod) continue

    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const activeFns = getMemberActiveFunctions(m)
    const roleLabel =
      activeFns.length > 0
        ? activeFns.join(', ')
        : isMod
        ? 'Moderator (tijelo društva)'
        : 'Član tijela društva'

    recipients.push({
      id: m.id,
      name: m.name || email,
      email,
      roleLabel,
    })
  }

  return recipients
}

export async function GET(request: NextRequest) {
  try {
    const actor = extractActor(request)
    if ((actor.role || '').trim().toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Pristup dopušten samo administratoru.' }, { status: 403 })
    }

    const settingsService = new SettingsService()
    const memberService = new MemberService()
    const settings = (await settingsService.getSettings()) as any
    const members = await memberService.getAllMembers()

    const lastAdminLoginAt = resolveLastAdminLoginIso(settings)
    const boardRecipients = getBoardRecipients(members)

    let elapsedDays = 0
    if (lastAdminLoginAt) {
      const diffMs = Date.now() - new Date(lastAdminLoginAt).getTime()
      elapsedDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
    }

    return NextResponse.json({
      adminInactivityEnabled: Boolean(settings?.adminInactivityEnabled),
      adminInactivityDays: Number(settings?.adminInactivityDays) || 30,
      lastAdminLoginAt,
      adminInactivityAlertSentAt: settings?.adminInactivityAlertSentAt || null,
      elapsedDays,
      boardRecipients,
    })
  } catch (error: any) {
    console.error('[AdminInactivity GET Error]:', error)
    return NextResponse.json({ error: error?.message || 'Greška poslužitelja.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || 'check').trim()
    const testEmail = String(body?.testEmail || '').trim()

    const actor = extractActor(request, body)
    const isAdminActor = (actor.role || '').trim().toLowerCase() === 'admin'

    if ((action === 'send-test' || action === 'trigger-now') && !isAdminActor) {
      return NextResponse.json({ error: 'Samo administrator može pokrenuti ovu radnju.' }, { status: 403 })
    }

    const settingsService = new SettingsService()
    const settings = (await settingsService.getSettings()) as any
    if (!settings) {
      return NextResponse.json({ ok: true, checked: false })
    }

    const nowIso = new Date().toISOString()

    // Ako je administrator aktivan i radi redovnu provjeru, osvježi zadnju aktivnost (najviše jednom na sat radi brzine)
    if (action === 'check' && isAdminActor) {
      const prevIso = resolveLastAdminLoginIso(settings)
      const prevMs = prevIso ? new Date(prevIso).getTime() : 0
      if (!prevIso || Date.now() - prevMs > 60 * 60 * 1000 || settings.adminInactivityAlertSentAt) {
        await settingsService.updateSettings({
          lastAdminLoginAt: nowIso,
          adminInactivityAlertSentAt: null,
        })
      }
      return NextResponse.json({
        ok: true,
        activeAdminHeartbeat: true,
        lastAdminLoginAt: nowIso,
        elapsedDays: 0,
      })
    }

    // Za pozadinske provjere svih ostalih korisnika: throttle u memoriji na 5 min da ne opterećuje bazu
    if (action === 'check') {
      if (Date.now() - lastAutoCheckRunAt < 5 * 60 * 1000) {
        return NextResponse.json({ ok: true, throttled: true })
      }
      lastAutoCheckRunAt = Date.now()
    }

    const enabled = Boolean(settings.adminInactivityEnabled)
    const thresholdDays = Math.max(1, Number(settings.adminInactivityDays) || 30)

    let lastAdminLoginAt = resolveLastAdminLoginIso(settings)
    if (!lastAdminLoginAt) {
      lastAdminLoginAt = nowIso
      await settingsService.updateSettings({ lastAdminLoginAt })
    }

    const lastLoginMs = new Date(lastAdminLoginAt).getTime()
    const elapsedDays = isNaN(lastLoginMs) ? 0 : Math.max(0, Math.floor((Date.now() - lastLoginMs) / (1000 * 60 * 60 * 24)))

    const alreadySentForCurrentCycle =
      Boolean(settings.adminInactivityAlertSentAt) &&
      new Date(settings.adminInactivityAlertSentAt).getTime() >= lastLoginMs

    const shouldSendAutomatic =
      action === 'check' &&
      enabled &&
      elapsedDays >= thresholdDays &&
      !alreadySentForCurrentCycle

    const shouldSendManual = action === 'send-test' || action === 'trigger-now'

    if (!shouldSendAutomatic && !shouldSendManual) {
      return NextResponse.json({
        ok: true,
        enabled,
        thresholdDays,
        lastAdminLoginAt,
        elapsedDays,
        sent: false,
      })
    }

    if (inactivitySendInProgress) {
      return NextResponse.json({ ok: true, inProgress: true })
    }

    inactivitySendInProgress = true
    try {
      if (!settings.smtpHost) {
        if (shouldSendManual) {
          return NextResponse.json(
            { error: 'SMTP poslužitelj nije konfiguriran u Postavkama (E-mail).' },
            { status: 400 }
          )
        }
        return NextResponse.json({ ok: false, error: 'SMTP nije konfiguriran.' })
      }

      const memberService = new MemberService()
      const allMembers = await memberService.getAllMembers()
      const boardRecipients = getBoardRecipients(allMembers)

      const targetRecipients =
        action === 'send-test'
          ? [
              {
                name: actor.name || 'Testni primatelj',
                email: testEmail || settings.smtpFrom || settings.smtpUser || '',
                roleLabel: 'Testna provjera',
              },
            ].filter((r) => r.email && r.email.includes('@'))
          : boardRecipients

      if (targetRecipients.length === 0) {
        if (shouldSendManual) {
          return NextResponse.json(
            {
              error:
                action === 'send-test'
                  ? 'Unesite valjanu testnu e-mail adresu ili podesite SMTP From adresu.'
                  : 'Nije pronađen nijedan aktivni član tijela društva s valjanom e-mail adresom.',
            },
            { status: 400 }
          )
        }
        return NextResponse.json({ ok: false, error: 'Nema primatelja tijela društva.' })
      }

      const originHeader = request.headers.get('origin')
      const hostHeader = request.headers.get('host')
      const proto = request.headers.get('x-forwarded-proto') || 'https'
      const serverOrigin = originHeader || (hostHeader ? `${proto}://${hostHeader}` : 'https://cms.rodoslovlje.hr')

      const adminUsername = 'admin'
      const adminPassword = String(settings.adminPassword || 'admin')
      const backupEmail = String(settings.adminBackupEmail || '').trim()
      const backupPassword = String(settings.adminBackupPassword || 'admin')
      const lastLoginFormatted = formatDateTimeDMY(lastAdminLoginAt, 'Nepoznato')

      const infoBoxHtml = `
        <div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.7; color: #1F2937;">
          <p style="margin: 0 0 8px 0;"><strong>Glavni administratorski račun (Admin pristup):</strong></p>
          <p style="margin: 0 0 4px 0;">Korisničko ime (Username): <code style="background:#FFFFFF;border:1px solid #E2E8F0;padding:2px 6px;border-radius:4px;font-weight:bold;">${escapeHtml(adminUsername)}</code></p>
          <p style="margin: 0 0 10px 0;">Lozinka (Password): <code style="background:#FFFFFF;border:1px solid #E2E8F0;padding:2px 6px;border-radius:4px;font-weight:bold;">${escapeHtml(adminPassword)}</code></p>
          ${
            backupEmail
              ? `<p style="margin: 8px 0 4px 0;"><strong>Rezervni administratorski račun:</strong></p>
                 <p style="margin: 0 0 4px 0;">Email: <code style="background:#FFFFFF;border:1px solid #E2E8F0;padding:2px 6px;border-radius:4px;">${escapeHtml(backupEmail)}</code></p>
                 <p style="margin: 0 0 4px 0;">Lozinka: <code style="background:#FFFFFF;border:1px solid #E2E8F0;padding:2px 6px;border-radius:4px;">${escapeHtml(backupPassword)}</code></p>`
              : ''
          }
        </div>
      `

      const recipientSummaryText =
        boardRecipients.length > 0
          ? boardRecipients.map((r) => `• ${r.name} (${r.roleLabel}) — ${r.email}`).join('\n')
          : '• Nema evidentiranih članova s aktivnom funkcijom u tijelima društva.'

      const bodyText = [
        action === 'send-test'
          ? '[TESTNA PROVJERA SIGURNOSNOG PROTOKOLA — OVA PORUKA JE POSLANA KAO TEST]'
          : '',
        'Ova poruka poslana je automatski prema sigurnosnom pravilu za kontinuitet rada Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović”.',
        '',
        `Sustav nije zabilježio prijavu Administratora ${action === 'send-test' ? `u zadanom roku (postavljeni prag: ${thresholdDays} dana; zadnja prijava: ${lastLoginFormatted}).` : `punih ${elapsedDays} dana (zadana granica: ${thresholdDays} dana; zadnja zabilježena prijava: ${lastLoginFormatted}).`}`,
        '',
        'Radi osiguranja nesmetanog pristupa bazi podataka, dokumentima, financijskoj evidenciji i svim postavkama u slučaju spriječenosti Administratora, u nastavku Vam dostavljamo potpune administratorske pristupne podatke.',
        '',
        'Nakon prijave kao Administrator, u modulu Postavke → Trezor lozinki možete pristupiti i svim ostalim pristupnim računima društva (e-mail, hosting, Dropbox sigurnosne kopije i dr.).',
        '',
        `Obaviješteni članovi tijela društva (${boardRecipients.length}):`,
        recipientSummaryText,
      ]
        .filter((line) => line !== undefined)
        .join('\n')

      const built = buildHrdMasterEmail({
        templateType: 'sluzbena_obavijest',
        title: 'Sigurnosna predaja administratorskog pristupa',
        subtitle:
          action === 'send-test'
            ? `Testni prikaz obavijesti • Prag neaktivnosti: ${thresholdDays} dana`
            : `Automatska obavijest nakon ${elapsedDays} dana neaktivnosti Administratora`,
        greeting: 'Poštovane članice i članovi tijela Društva,',
        bodyTextOrHtml: bodyText,
        infoBoxTitle: 'Administratorski pristupni podaci (Username & Password)',
        infoBoxHtml,
        ctaText: 'Prijavite se u sustav Rodoslovac',
        ctaUrl: serverOrigin,
        closingText: 'Molimo Vas da ove podatke čuvate s najvećom pažnjom u svrhu zaštite rada Društva.',
        settings,
        sender: {
          userId: 'system',
          userName: 'Sigurnosni protokol sustava Rodoslovac',
          userRole: 'admin',
        },
        customWebsiteUrl: serverOrigin,
      })

      const subject =
        action === 'send-test'
          ? `[TEST] Sigurnosni protokol: Pristupni podaci Administratora (prag ${thresholdDays} dana)`
          : `[VAŽNO] Pristupni podaci Administratora sustava Rodoslovac (neaktivnost ${elapsedDays} dana)`

      const sentEmails: string[] = []
      for (const r of targetRecipients) {
        await sendEmail({
          to: r.email,
          subject,
          body: built.plainText,
          html: built.html,
          attachments: built.inlineAttachments,
        })
        sentEmails.push(r.email)
      }

      if (action !== 'send-test') {
        await settingsService.updateSettings({
          adminInactivityAlertSentAt: nowIso,
        })
      }

      DatabaseService.insertLog({
        userId: actor.id || 'system',
        userName: actor.name || 'Sustav Rodoslovac',
        userRole: actor.role || 'admin',
        action:
          action === 'send-test'
            ? 'Test sigurnosne obavijesti neaktivnosti'
            : 'Automatsko slanje admin pristupa zbog neaktivnosti',
        details:
          action === 'send-test'
            ? `Poslan testni e-mail s prikazom sigurnosne predaje administratorskog pristupa na: ${sentEmails.join(', ')}`
            : `Zbog neaktivnosti administratora (${elapsedDays}/${thresholdDays} dana, zadnja prijava ${lastLoginFormatted}), automatski su poslani pristupni podaci administratora svim članovima tijela društva (${sentEmails.length}): ${sentEmails.join(', ')}`,
        timestamp: nowIso,
      })

      return NextResponse.json({
        ok: true,
        sent: true,
        sentCount: sentEmails.length,
        sentTo: sentEmails,
        sentAt: nowIso,
      })
    } finally {
      inactivitySendInProgress = false
    }
  } catch (error: any) {
    console.error('[AdminInactivity POST Error]:', error)
    return NextResponse.json({ error: error?.message || 'Greška pri slanju obavijesti.' }, { status: 500 })
  }
}
