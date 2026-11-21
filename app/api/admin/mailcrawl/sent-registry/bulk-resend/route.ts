import { NextRequest, NextResponse } from 'next/server'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'
import { getCampaignSettings, getDailySentCount } from '@/lib/mailcrawl/db'
import {
  analyzeBulkResendItems,
  getBulkSendJobState,
  startBulkResend,
} from '@/lib/mailcrawl/bulk-send-state'
import { sendDonationEmail } from '@/lib/mailcrawl/mailer'
import { buildGreeting, capitalizeRespectfulPronouns } from '@/lib/mailcrawl/ai'
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
      addReminderPrefix = true,
      dryRunPreflight = false,
      testOnly = false,
      testEmail,
    } = body || {}

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Odaberite barem jedan poslani zapis za slanje podsjetnika.' },
        { status: 400 }
      )
    }

    const numericIds = ids.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id) && id > 0)
    const { eligible, preflight } = analyzeBulkResendItems(numericIds)
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
      const sample = eligible[0]
      if (!sample) {
        return NextResponse.json(
          { ok: false, error: 'Nema valjanog odabranog zapisa za testni uzorak.' },
          { status: 400 }
        )
      }
      const baseSubject = (sample.subject || 'Zamolba za podršku Hrvatskom rodoslovnom društvu').trim()
      const finalSubject =
        addReminderPrefix && !baseSubject.startsWith('[Podsjetnik]')
          ? `[Podsjetnik] ${baseSubject}`
          : baseSubject
      const greeting = buildGreeting({ contact_person: sample.contact_person })
      const finalBody = capitalizeRespectfulPronouns(
        (sample.body || '').trim() ||
          `${greeting}\n\nLjubazno Vam se ponovno obraćamo vezano uz podršku radu Hrvatskog rodoslovnog društva "Pavao Ritter Vitezović".`
      )
      await sendDonationEmail(
        {
          name: sample.company_name || 'Primatelj',
          email: sample.recipient_email || sample.email_norm,
          oib: sample.oib,
          contact_person: sample.contact_person,
          email_subject: `[TEST] ${finalSubject}`,
          email_body: finalBody,
        },
        settings,
        targetEmail
      )
      return NextResponse.json({
        ok: true,
        testOnly: true,
        message: `Testni podsjetnik (uzorak za "${sample.company_name || sample.email_norm}") poslan je na ${targetEmail}!`,
      })
    }

    const res = startBulkResend({
      sentIds: numericIds,
      delaySec,
      addReminderPrefix: Boolean(addReminderPrefix),
      actor: auth.actor,
    })

    return NextResponse.json({
      ok: true,
      started: res.started,
      preflight: res.preflight,
      job: res.job,
      message: `Pokrenuto skupno ponovno slanje za ${res.preflight.eligibleCount} kontakata.`,
    })
  } catch (err: any) {
    if (err instanceof DoNotContactBlockedError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 403 })
    }
    const status = /već u tijeku/i.test(err?.message || '') ? 409 : 400
    return NextResponse.json({ ok: false, error: err?.message || 'Greška pri skupnom ponovnom slanju.' }, { status })
  }
}
