import { NextRequest, NextResponse } from 'next/server'
import { db, getCampaignSettings, updateLead } from '@/lib/mailcrawl/db'
import { buildSmartFallbackEmail, generatePersonalizedEmail } from '@/lib/mailcrawl/ai'
import { runWithConcurrency } from '@/lib/mailcrawl/scraper'
import { createNdjsonStreamResponse } from '@/lib/ndjson-stream'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'
import type { Lead } from '@/lib/mailcrawl/types'

export async function POST(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const { ids, mode = 'gemini', stream = false } = body || {}
    const useTemplateOnly = mode === 'template'
    let leadsToProcess: Lead[] = []

    if (Array.isArray(ids) && ids.length > 0) {
      const cleanIds = ids.map((x: any) => Number(x)).filter((x: number) => Number.isFinite(x) && x > 0)
      if (cleanIds.length > 0) {
        const placeholders = cleanIds.map(() => '?').join(',')
        leadsToProcess = db
          .prepare(`SELECT * FROM leads WHERE id IN (${placeholders}) AND status NOT IN ('sent', 'donor', 'rejected')`)
          .all(...cleanIds) as Lead[]
      }
    } else {
      leadsToProcess = db.prepare("SELECT * FROM leads WHERE status = 'new'").all() as Lead[]
    }

    const settings = getCampaignSettings()
    const total = leadsToProcess.length

    const runGeneration = async (emit?: (obj: Record<string, any>) => void) => {
      let generated = 0
      let failed = 0
      let processed = 0
      let cancelled = false

      emit?.({
        type: 'start',
        total,
        skipped: 0,
        startedAt: new Date().toISOString(),
      })

      if (useTemplateOnly) {
        for (const lead of leadsToProcess) {
          if (req.signal.aborted) {
            cancelled = true
            break
          }
          const fallback = buildSmartFallbackEmail(lead, settings)
          updateLead(lead.id!, {
            email_subject: fallback.subject,
            email_body: fallback.body,
            ai_personalization_note: fallback.personalization_note,
            status: 'draft_ready',
          })
          generated++
          processed++
          emit?.({
            type: 'progress',
            total,
            processed,
            sent: generated,
            failed,
            skipped: 0,
            currentName: lead.name,
            currentEmail: lead.email || '',
          })
        }
      } else {
        await runWithConcurrency(
          leadsToProcess,
          3,
          async (lead) => {
            if (req.signal.aborted) {
              cancelled = true
              return
            }
            try {
              const aiRes = await generatePersonalizedEmail(lead, settings)
              updateLead(lead.id!, {
                email_subject: aiRes.subject,
                email_body: aiRes.body,
                ai_personalization_note: aiRes.personalization_note,
                activity_summary: aiRes.concise_activity || lead.activity_summary,
                status: 'draft_ready',
              })
              generated++
              processed++
              emit?.({
                type: 'progress',
                total,
                processed,
                sent: generated,
                failed,
                skipped: 0,
                currentName: lead.name,
                currentEmail: lead.email || '',
              })
            } catch (err: any) {
              failed++
              processed++
              emit?.({
                type: 'progress',
                total,
                processed,
                sent: generated,
                failed,
                skipped: 0,
                currentName: lead.name,
                currentEmail: lead.email || '',
                lastError: `${lead.name}: ${err?.message || 'Greška'}`,
              })
            }
          },
          req.signal
        )
      }

      return {
        ok: true,
        cancelled,
        generated,
        failed,
        total,
        message: `Pripremljeno ${generated} od ${total} nacrta mailova.${failed > 0 ? ` Neuspjelo: ${failed}.` : ''}`,
      }
    }

    if (stream) {
      return createNdjsonStreamResponse(async (emit) => {
        const res = await runGeneration(emit)
        emit({
          type: 'done',
          cancelled: res.cancelled,
          sent: res.generated,
          failed: res.failed,
          skipped: 0,
          processed: res.generated + res.failed,
          total,
          finishedAt: new Date().toISOString(),
          result: res,
        })
      })
    }

    const res = await runGeneration()
    return NextResponse.json(res)
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
