import { NextRequest, NextResponse } from 'next/server'
import {
  getCampaignSettings,
  insertLead,
  updateLead,
  createKnownEntitiesTracker,
} from '@/lib/mailcrawl/db'
import { crawlCompanyWebsite, runWithConcurrency } from '@/lib/mailcrawl/scraper'
import { buildSmartFallbackEmail, generatePersonalizedEmail } from '@/lib/mailcrawl/ai'
import {
  currentCrawlJob,
  addCrawlLog,
  startCrawlAbortController,
  clearCrawlAbortController,
} from '@/lib/mailcrawl/crawler-state'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'
import type { Lead } from '@/lib/mailcrawl/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response

  if (currentCrawlJob.running) {
    return NextResponse.json(
      { ok: false, error: 'Pretraživanje ili analiza URL-ova je već u tijeku.' },
      { status: 409 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const { urls, entityType, city = '', activityCategory = '', aiMode = 'template' } = body || {}

  const rawList: string[] = Array.isArray(urls)
    ? urls
    : typeof urls === 'string'
    ? urls.split(/[\r\n,;]+/)
    : []

  const cleanUrls = Array.from(
    new Set(
      rawList
        .map((u) => String(u || '').trim())
        .filter((u) => u.length >= 4 && u.includes('.'))
        .map((u) => (u.startsWith('http://') || u.startsWith('https://') ? u : `https://${u}`))
    )
  ).slice(0, 50)

  if (cleanUrls.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Unesite barem jednu valjanu web adresu (do 50 URL-ova odjednom).' },
      { status: 400 }
    )
  }

  const resolvedAiMode: 'none' | 'template' | 'gemini' =
    aiMode === 'none' || aiMode === 'template' || aiMode === 'gemini' ? aiMode : 'template'

  const settings = getCampaignSettings()
  const firecrawlApiKey = (settings.firecrawl_api_key || process.env.FIRECRAWL_API_KEY || '').trim()
  const signal = startCrawlAbortController()

  currentCrawlJob.running = true
  currentCrawlJob.cancelled = false
  currentCrawlJob.phase = 'crawl'
  currentCrawlJob.provider = 'urls'
  currentCrawlJob.totalTerms = cleanUrls.length
  currentCrawlJob.completedTerms = 0
  currentCrawlJob.currentTerm = cleanUrls[0]
  currentCrawlJob.firecrawlUsedCount = 0
  currentCrawlJob.logs = []
  currentCrawlJob.foundCount = 0
  currentCrawlJob.insertedCount = 0
  currentCrawlJob.duplicateCount = 0
  currentCrawlJob.startedAt = new Date().toISOString()
  currentCrawlJob.finishedAt = null

  ;(async () => {
    try {
      const tracker = createKnownEntitiesTracker()
      const newlyInserted: Lead[] = []

      addCrawlLog(
        `Pokrećem paralelnu analizu za ${cleanUrls.length} web stranica (6 istovremeno${firecrawlApiKey ? ' + Firecrawl fallback' : ''})...`,
        'info'
      )

      await runWithConcurrency(
        cleanUrls,
        6,
        async (url) => {
          if (signal.aborted) return
          currentCrawlJob.currentTerm = url

          if (tracker.isKnown({ url })) {
            currentCrawlJob.duplicateCount++
            currentCrawlJob.completedTerms++
            addCrawlLog(`Preskočena već poznata domena: ${url}`, 'warn')
            return
          }

          try {
            const crawled = await crawlCompanyWebsite(
              url,
              {
                entity_type: entityType && entityType !== 'all' ? entityType : undefined,
                city,
                activity_category: activityCategory,
                source: 'Masovna analiza URL-ova',
              },
              signal,
              {
                firecrawlApiKey,
                onFirecrawlUsed: (targetUrl) => {
                  currentCrawlJob.firecrawlUsedCount++
                  addCrawlLog(`[Firecrawl fallback] Čitam JS/zaštićenu stranicu: ${targetUrl}`, 'info')
                },
              }
            )

            if (!crawled || !crawled.email) {
              addCrawlLog(`Nije pronađen e-mail na stranici: ${url}`, 'warn')
              currentCrawlJob.completedTerms++
              return
            }

            currentCrawlJob.foundCount++
            const insertRes = insertLead(crawled)
            if (insertRes.inserted && insertRes.lead) {
              currentCrawlJob.insertedCount++
              tracker.markKnown({
                email: insertRes.lead.email,
                domain: insertRes.lead.website,
                oib: insertRes.lead.oib,
                name: insertRes.lead.name,
              })
              addCrawlLog(`Spremljeno: ${insertRes.lead.name} (${insertRes.lead.email})`, 'success')

              if (resolvedAiMode === 'template') {
                const fb = buildSmartFallbackEmail(insertRes.lead, settings)
                updateLead(insertRes.lead.id!, {
                  email_subject: fb.subject,
                  email_body: fb.body,
                  ai_personalization_note: fb.personalization_note,
                  status: 'draft_ready',
                })
              } else if (resolvedAiMode === 'gemini') {
                newlyInserted.push(insertRes.lead)
              }
            } else {
              currentCrawlJob.duplicateCount++
              addCrawlLog(`Preskočen duplikat (${crawled.name}): ${insertRes.reason}`, 'warn')
            }
          } catch (err: any) {
            if (!signal.aborted) {
              addCrawlLog(`Greška za ${url}: ${err?.message || 'Neuspjeh'}`, 'error')
            }
          }

          currentCrawlJob.completedTerms++
        },
        signal
      )

      if (!signal.aborted && resolvedAiMode === 'gemini' && newlyInserted.length > 0) {
        currentCrawlJob.phase = 'analyzing'
        addCrawlLog(
          `Generiram AI nacrte sekvencijalno (9/10 RPM) za ${newlyInserted.length} novih kontakata...`,
          'info'
        )
        for (const lead of newlyInserted) {
          if (signal.aborted || !lead.id) break
          try {
            const aiRes = await generatePersonalizedEmail(lead, settings, '', {
              signal,
              onRateLimitStatus: (evt) => {
                if (evt.phase === 'pacing' || evt.phase === 'window_wait' || evt.phase === 'retry_429') {
                  addCrawlLog(`⏳ ${evt.message}`, evt.phase === 'retry_429' ? 'warn' : 'info')
                }
              },
            })
            updateLead(lead.id, {
              email_subject: aiRes.subject,
              email_body: aiRes.body,
              ai_personalization_note: aiRes.personalization_note,
              activity_summary: aiRes.concise_activity || lead.activity_summary,
              status: 'draft_ready',
            })
            addCrawlLog(`AI nacrt spreman: ${lead.name} (${lead.email})`, 'success')
          } catch (aiErr: any) {
            if (aiErr?.name === 'AbortError' || signal.aborted) break
            addCrawlLog(`Upozorenje pri AI generiranju za ${lead.name}: ${aiErr?.message || 'Greška'}`, 'warn')
          }
        }
      }

      addCrawlLog(
        signal.aborted
          ? `=== Analiza URL-ova zaustavljena (${currentCrawlJob.completedTerms}/${cleanUrls.length}). Spremljeno: ${currentCrawlJob.insertedCount}. ===`
          : `=== Analiza ${cleanUrls.length} URL-ova završena! Pronađeno: ${currentCrawlJob.foundCount}, Novo spremljeno: ${currentCrawlJob.insertedCount}, Preskočeno: ${currentCrawlJob.duplicateCount}. ===`,
        signal.aborted ? 'warn' : 'done'
      )
    } catch (e: any) {
      addCrawlLog(`Greška pri analizi URL-ova: ${e?.message}`, 'error')
    } finally {
      currentCrawlJob.running = false
      currentCrawlJob.phase = currentCrawlJob.cancelled ? 'cancelled' : 'done'
      currentCrawlJob.finishedAt = new Date().toISOString()
      clearCrawlAbortController()
    }
  })()

  return NextResponse.json({
    ok: true,
    urlsCount: cleanUrls.length,
    message: `Pokrenuta paralelna analiza za ${cleanUrls.length} web stranica.`,
  })
}
