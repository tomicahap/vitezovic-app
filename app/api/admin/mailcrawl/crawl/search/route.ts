import { NextRequest, NextResponse } from 'next/server'
import {
  getCampaignSettings,
  insertLead,
  updateLead,
  createKnownEntitiesTracker,
  findPreviousSearch,
  recordSearchHistory,
  listSearchHistory,
} from '@/lib/mailcrawl/db'
import { discoverCroatianEntities } from '@/lib/mailcrawl/scraper'
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

export async function GET(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const history = listSearchHistory(50)
    return NextResponse.json({ ok: true, history })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

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
  const { query, city, entityType, registrySource, maxResults, autoGenerateAi, aiMode, forceRepeat } = body || {}

  const cleanQuery = String(query || '').trim()
  const cleanCity = String(city || '').trim()

  if (cleanQuery && !forceRepeat) {
    const prev = findPreviousSearch(cleanQuery, cleanCity)
    if (prev) {
      return NextResponse.json({
        ok: false,
        alreadySearched: true,
        previousSearch: prev,
        error: `Pojam "${cleanQuery}"${cleanCity ? ` (${cleanCity})` : ''} je već pretraživan dana ${prev.searched_at} (pronađeno: ${prev.found_count}, spremljeno: ${prev.inserted_count}).`,
      })
    }
  }

  const resolvedAiMode: 'none' | 'template' | 'gemini' =
    aiMode === 'none' || aiMode === 'template' || aiMode === 'gemini'
      ? aiMode
      : autoGenerateAi === false
      ? 'none'
      : 'gemini'

  const settings = getCampaignSettings()
  const serperApiKey = (settings.serper_api_key || process.env.SERPER_API_KEY || '').trim()
  const tavilyApiKey = (settings.tavily_api_key || process.env.TAVILY_API_KEY || '').trim()
  const firecrawlApiKey = (settings.firecrawl_api_key || process.env.FIRECRAWL_API_KEY || '').trim()
  const signal = startCrawlAbortController()

  currentCrawlJob.running = true
  currentCrawlJob.cancelled = false
  currentCrawlJob.phase = 'search'
  currentCrawlJob.provider = serperApiKey ? 'serper' : tavilyApiKey ? 'tavily' : 'web'
  currentCrawlJob.totalTerms = 1
  currentCrawlJob.completedTerms = 0
  currentCrawlJob.currentTerm = cleanQuery || (cleanCity ? `Opća pretraga (${cleanCity})` : 'Opća pretraga')
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

      const results = await discoverCroatianEntities(
        {
          query: cleanQuery,
          city: cleanCity,
          entityType: entityType || 'all',
          registrySource: registrySource || 'all',
          maxResults: Number(maxResults) || 20,
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
          addCrawlLog(progress.message, progress.phase === 'found' ? 'success' : 'info')
        }
      )

      currentCrawlJob.foundCount = results.length

      for (const item of results) {
        if (signal.aborted) break
        const resInsert = insertLead(item)
        if (resInsert.inserted && resInsert.lead) {
          currentCrawlJob.insertedCount++
          addCrawlLog(`Spremljeno u bazu: ${item.name} (${item.email})`, 'success')

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
          addCrawlLog(`Preskočen duplikat (${item.name}): ${resInsert.reason}`, 'warn')
        }
      }

      if (!signal.aborted && resolvedAiMode === 'gemini' && newlyInsertedLeads.length > 0) {
        currentCrawlJob.phase = 'analyzing'
        addCrawlLog(
          `Generiram personalizirane AI nacrte sekvencijalno (9/10 RPM) za ${newlyInsertedLeads.length} novih subjekata...`,
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
            addCrawlLog(`Pripremljen nacrt maila za: ${lead.name} (čeka Vaše odobrenje)`, 'success')
          } catch (aiErr: any) {
            if (aiErr?.name === 'AbortError' || signal.aborted) break
            addCrawlLog(`Upozorenje pri AI generiranju za ${lead.name}: ${aiErr.message}`, 'warn')
          }
        }
      }

      if (cleanQuery || cleanCity) {
        recordSearchHistory({
          query: cleanQuery || `Opća pretraga (${cleanCity})`,
          city: cleanCity,
          entity_type: entityType || 'all',
          source: serperApiKey ? 'serper' : registrySource || 'google_registar',
          found_count: currentCrawlJob.foundCount,
          inserted_count: currentCrawlJob.insertedCount,
        })
      }

      currentCrawlJob.completedTerms = 1
      addCrawlLog(
        signal.aborted
          ? `Pretraživanje zaustavljeno! Pronađeno: ${currentCrawlJob.foundCount}, Novo spremljeno: ${currentCrawlJob.insertedCount}.`
          : `Pretraživanje završeno! Pronađeno: ${currentCrawlJob.foundCount}, Novo spremljeno: ${currentCrawlJob.insertedCount}, Preskočeno duplikata: ${currentCrawlJob.duplicateCount}.`,
        signal.aborted ? 'warn' : 'done'
      )
    } catch (err: any) {
      addCrawlLog(`Greška tijekom pretraživanja: ${err.message}`, 'error')
    } finally {
      currentCrawlJob.running = false
      currentCrawlJob.phase = currentCrawlJob.cancelled ? 'cancelled' : 'done'
      currentCrawlJob.finishedAt = new Date().toISOString()
      clearCrawlAbortController()
    }
  })()

  return NextResponse.json({ ok: true, message: 'Pretraživanje pokrenuto.' })
}
