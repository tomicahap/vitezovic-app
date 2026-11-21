import { NextRequest, NextResponse } from 'next/server'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'
import { getCampaignSettings, getDailySentCount } from '@/lib/mailcrawl/db'
import {
  analyzeInitialBulkLeads,
  getBulkSendJobState,
  startBulkDonationSend,
} from '@/lib/mailcrawl/bulk-send-state'
import { sendDonationEmail } from '@/lib/mailcrawl/mailer'
import { buildSmartFallbackEmail } from '@/lib/mailcrawl/ai'
import { DoNotContactBlockedError } from '@/lib/do-not-contact'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const {
      ids = [],
      delaySec,
      autoFillTemplate = true,
      dryRunPreflight = false,
      testOnly = false,
      testEmail,
    } = body || {}

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Odaberite barem jedan kontakt iz tablice.' },
        { status: 400 }
      )
    }

    const numericIds = ids.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id) && id > 0)
    const { eligible, preflight } = analyzeInitialBulkLeads(numericIds, Boolean(autoFillTemplate))
    const settings = getCampaignSettings()
    const dailySentCount = getDailySentCount()
    const parsedLimit = parseInt(String(settings.bulk_send_daily_limit || '150'), 10)
    const dailyLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 150

    if (dryRunPreflight) {
      return NextResponse.json({
        ok: true,
        preflight,
        dailySentCount,
        dailyLimit,
        defaultDelaySec: parseFloat(String(settings.bulk_send_delay_sec || '3.5')) || 3.5,
        jobRunning: getBulkSendJobState().running,
      })
    }

    if (testOnly) {
      const targetEmail = String(testEmail || auth.actor.email || settings.sender_email || '').trim()
      if (!targetEmail || !targetEmail.includes('@')) {
        return NextResponse.json(
          { ok: false, error: 'Unesite valjanu testnu e-mail adresu.' },
          { status: 400 }
        )
      }

      let sample = eligible[0]
      if (!sample) {
        return NextResponse.json(
          { ok: false, error: 'Nema valjanog odabranog kontakta za slanje testnog uzorka.' },
          { status: 400 }
        )
      }
      if (!sample.email_subject?.trim() || !sample.email_body?.trim()) {
        const fb = buildSmartFallbackEmail(sample, settings)
        sample = { ...sample, email_subject: fb.subject, email_body: fb.body }
      }
      await sendDonationEmail(
        { ...sample, email_subject: `[TEST] ${sample.email_subject}` },
        settings,
        targetEmail
      )
      return NextResponse.json({
        ok: true,
        testOnly: true,
        message: `Testni mail (uzorak za "${sample.name}") poslan je na ${targetEmail}!`,
      })
    }

    const res = startBulkDonationSend({
      leadIds: numericIds,
      delaySec,
      autoFillTemplate: Boolean(autoFillTemplate),
      actor: auth.actor,
    })

    return NextResponse.json({
      ok: true,
      started: res.started,
      preflight: res.preflight,
      job: res.job,
      message: `Pokrenuto skupno slanje za ${res.preflight.eligibleCount} kontakata.`,
    })
  } catch (err: any) {
    if (err instanceof DoNotContactBlockedError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 403 })
    }
    const status = /već u tijeku/i.test(err?.message || '') ? 409 : 400
    return NextResponse.json({ ok: false, error: err?.message || 'Greška pri skupnom slanju.' }, { status })
  }
}
