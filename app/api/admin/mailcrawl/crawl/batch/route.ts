import { NextRequest, NextResponse } from 'next/server'
import {
  getCampaignSettings,
  insertLead,
  updateLead,
  createKnownEntitiesTracker,
  recordSearchHistory,
} from '@/lib/mailcrawl/db'
import { discoverCroatianEntities, runWithConcurrency } from '@/lib/mailcrawl/scraper'
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
      { ok: false, error: 'Pretraživanje je već u tijeku. Pričekajte završetak ili ga zaustavite.' },
      { status: 409 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const { terms, entityType = 'all', registrySource = 'all', maxPerTerm = 5, aiMode } = body || {}

  if (!Array.isArray(terms) || terms.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Potrebno je proslijediti barem jedan pojam za pretraživanje.' },
      { status: 400 }
    )
  }

  const sanitizedTerms: Array<{ query: string; city: string }> = terms
    .slice(0, 20)
    .map((t: any) => ({
      query: String(t.query || '').trim(),
      city: String(t.city || '').trim(),
    }))
    .filter((t) => Boolean(t.query))

  if (sanitizedTerms.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Nijedan valjani pojam nije pronađen u zahtjevu.' },
      { status: 400 }
    )
  }

  const resolvedAiMode: 'none' | 'template' | 'gemini' =
    aiMode === 'none' || aiMode === 'template' || aiMode === 'gemini' ? aiMode : 'template'

  const settings = getCampaignSettings()
  const serperApiKey = (settings.serper_api_key || process.env.SERPER_API_KEY || '').trim()
  const tavilyApiKey = (settings.tavily_api_key || process.env.TAVILY_API_KEY || '').trim()
  const firecrawlApiKey = (settings.firecrawl_api_key || process.env.FIRECRAWL_API_KEY || '').trim()
  const signal = startCrawlAbortController()

  currentCrawlJob.running = true
  currentCrawlJob.cancelled = false
  currentCrawlJob.phase = 'search'
  currentCrawlJob.provider = serperApiKey ? 'serper' : tavilyApiKey ? 'tavily' : 'web'
  currentCrawlJob.totalTerms = sanitizedTerms.length
  currentCrawlJob.completedTerms = 0
  currentCrawlJob.currentTerm = sanitizedTerms[0]?.query || ''
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
      const newlyInsertedLeads: Lead[] = []

      const sourceLabel = serperApiKey
        ? 'Serper.dev Google'
        : tavilyApiKey
        ? 'Tavily Search'
        : 'paralelni web'

      addCrawlLog(
        `Započinjem paralelnu serijsku obradu za ${sanitizedTerms.length} pojmova (${sourceLabel}${
          firecrawlApiKey ? ' + Firecrawl fallback' : ''
        }, priprema: ${
          resolvedAiMode === 'none'
            ? 'samo adrese'
            : resolvedAiMode === 'template'
            ? 'brzi pametni predložak'
            : 'Gemini AI'
        })...`,
        'info'
      )

      await runWithConcurrency(
        sanitizedTerms,
        2,
        async (item, idx) => {
          if (signal.aborted) return

          const cleanQuery = item.query
          const cleanCity = item.city
          currentCrawlJob.currentTerm = `${cleanQuery}${cleanCity ? ` (${cleanCity})` : ''}`

          addCrawlLog(
            `--- [${idx + 1}/${sanitizedTerms.length}] Pretražujem: "${cleanQuery}"${cleanCity ? ` (${cleanCity})` : ''} ---`,
            'info'
          )

          let termFoundCount = 0
          let termInsertedCount = 0

          try {
            const results = await discoverCroatianEntities(
              {
                query: cleanQuery,
                city: cleanCity,
                entityType: entityType || 'all',
                registrySource: registrySource || 'all',
                maxResults: Math.min(Math.max(Number(maxPerTerm) || 5, 1), 15),
                serperApiKey,
                tavilyApiKey,
                firecrawlApiKey,
                onProviderUsed: (provider) => {
                  currentCrawlJob.provider = provider
                },
                onFirecrawlUsed: (targetUrl) => {
                  currentCrawlJob.firecrawlUsedCount++
                  addCrawlLog(`[Firecrawl fallback] Čitam JS/zaštićenu stranicu: ${targetUrl}`, 'info')
                },
                signal,
                isKnownEntity: tracker.isKnown,
                markKnownEntity: tracker.markKnown,
              },
              (progress) => {
                addCrawlLog(`[${cleanQuery}] ${progress.message}`, progress.phase === 'found' ? 'success' : 'info')
              }
            )

            termFoundCount = results.length
            currentCrawlJob.foundCount += termFoundCount

            for (const discovered of results) {
              if (signal.aborted) break
              const resInsert = insertLead(discovered)
              if (resInsert.inserted && resInsert.lead) {
                termInsertedCount++
                currentCrawlJob.insertedCount++
                tracker.markKnown({
                  email: resInsert.lead.email,
                  domain: resInsert.lead.website,
                  oib: resInsert.lead.oib,
                  name: resInsert.lead.name,
                })
                addCrawlLog(`Spremljeno u bazu: ${discovered.name} (${discovered.email})`, 'success')

                if (resolvedAiMode === 'template') {
                  const fallback = buildSmartFallbackEmail(resInsert.lead, settings)
                  updateLead(resInsert.lead.id!, {
                    email_subject: fallback.subject,
                    email_body: fallback.body,
                    ai_personalization_note: fallback.personalization_note,
                    status: 'draft_ready',
                  })
                } else if (resolvedAiMode === 'gemini') {
                  newlyInsertedLeads.push(resInsert.lead)
                }
              } else {
                currentCrawlJob.duplicateCount++
                addCrawlLog(`Preskočen postojeći subjekt (${discovered.name}): ${resInsert.reason}`, 'warn')
              }
            }
          } catch (termErr: any) {
            if (!signal.aborted) {
              addCrawlLog(`Greška pri obradi pojma "${cleanQuery}": ${termErr.message}`, 'error')
            }
          }

          if (!signal.aborted || termFoundCount > 0 || termInsertedCount > 0) {
            recordSearchHistory({
              query: cleanQuery,
              city: cleanCity,
              entity_type: entityType,
              source: serperApiKey ? 'serper' : registrySource,
              found_count: termFoundCount,
              inserted_count: termInsertedCount,
            })
          }

          currentCrawlJob.completedTerms++
        },
        signal
      )

      if (!signal.aborted && resolvedAiMode === 'gemini' && newlyInsertedLeads.length > 0) {
        currentCrawlJob.phase = 'analyzing'
        addCrawlLog(
          `Prikupljanje završeno! Pokrećem sekvencijalnu Gemini AI izradu nacrta za ${newlyInsertedLeads.length} novih subjekata (9/10 RPM)...`,
          'info'
        )
        for (const lead of newlyInsertedLeads) {
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
            addCrawlLog(`Upozorenje pri AI generiranju za ${lead.name}: ${aiErr.message}`, 'warn')
          }
        }
      }

      addCrawlLog(
        signal.aborted
          ? `=== Obrada zaustavljena! Obrađeno ${currentCrawlJob.completedTerms}/${sanitizedTerms.length} pojmova. Spremljeno: ${currentCrawlJob.insertedCount} novih kontakata. ===`
          : `=== Serijska obrada završena! Obrađeno ${sanitizedTerms.length} pojmova. Ukupno spremljeno: ${currentCrawlJob.insertedCount} novih subjekata. ===`,
        signal.aborted ? 'warn' : 'done'
      )
    } catch (e: any) {
      addCrawlLog(`Kritična greška u serijskoj obradi: ${e.message}`, 'error')
    } finally {
      currentCrawlJob.running = false
      currentCrawlJob.phase = currentCrawlJob.cancelled ? 'cancelled' : 'done'
      currentCrawlJob.finishedAt = new Date().toISOString()
      clearCrawlAbortController()
    }
  })()

  return NextResponse.json({
    ok: true,
    message: `Pokrenuta je brza obrada za ${sanitizedTerms.length} pojmova.`,
    termsCount: sanitizedTerms.length,
  })
}
