import { NextRequest, NextResponse } from 'next/server'

if (typeof process !== 'undefined' && process.env) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

import {
  db,
  getCampaignSettings,
  insertLead,
  updateLead,
  getKnownEntitiesChecker,
  findPreviousSearch,
  recordSearchHistory,
  listSearchHistory
} from '@/lib/mailcrawl/db'
import { discoverCroatianEntities } from '@/lib/mailcrawl/scraper'
import { generatePersonalizedEmail } from '@/lib/mailcrawl/ai'
import { currentCrawlJob, addCrawlLog } from '@/lib/mailcrawl/crawler-state'

export async function GET() {
  try {
    const history = listSearchHistory(50)
    return NextResponse.json({ ok: true, history })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (currentCrawlJob.running) {
    return NextResponse.json(
      { ok: false, error: 'Pretraživanje je već u tijeku. Pričekajte završetak.' },
      { status: 409 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const { query, city, entityType, registrySource, maxResults, autoGenerateAi, forceRepeat } = body || {}

  const cleanQuery = String(query || '').trim()
  const cleanCity = String(city || '').trim()

  // Provjera je li ovaj pojam već pretražen (kako se ne bi tražilo duplo)
  if (cleanQuery && !forceRepeat) {
    const prev = findPreviousSearch(cleanQuery, cleanCity)
    if (prev) {
      return NextResponse.json({
        ok: false,
        alreadySearched: true,
        previousSearch: prev,
        error: `Pojam "${cleanQuery}"${cleanCity ? ` (${cleanCity})` : ''} je već pretraživan dana ${prev.searched_at} (pronađeno: ${prev.found_count}, spremljeno: ${prev.inserted_count}).`
      })
    }
  }

  currentCrawlJob.running = true
  currentCrawlJob.logs = []
  currentCrawlJob.foundCount = 0
  currentCrawlJob.insertedCount = 0
  currentCrawlJob.duplicateCount = 0
  currentCrawlJob.startedAt = new Date().toISOString()
  currentCrawlJob.finishedAt = null

  // Run asynchronously
  ;(async () => {
    try {
      const settings = getCampaignSettings()
      const isKnown = getKnownEntitiesChecker()

      const results = await discoverCroatianEntities(
        {
          query: cleanQuery,
          city: cleanCity,
          entityType: entityType || 'all',
          registrySource: registrySource || 'all',
          maxResults: Number(maxResults) || 20,
          isKnownEntity: isKnown
        },
        (progress) => {
          addCrawlLog(progress.message, progress.phase === 'found' ? 'success' : 'info')
        }
      )

      currentCrawlJob.foundCount = results.length

      for (const item of results) {
        const resInsert = insertLead(item)
        if (resInsert.inserted && resInsert.lead) {
          currentCrawlJob.insertedCount++
          addCrawlLog(`Spremljeno u bazu: ${item.name} (${item.email})`, 'success')

          if (autoGenerateAi) {
            try {
              addCrawlLog(`Generiram personalizirani mail za: ${item.name}...`, 'info')
              const aiRes = await generatePersonalizedEmail(resInsert.lead, settings)
              updateLead(resInsert.lead.id!, {
                email_subject: aiRes.subject,
                email_body: aiRes.body,
                ai_personalization_note: aiRes.personalization_note,
                activity_summary: aiRes.concise_activity || resInsert.lead.activity_summary,
                status: 'draft_ready'
              })
              addCrawlLog(`Pripremljen nacrt maila za: ${item.name} (čeka Vaše odobrenje)`, 'success')
            } catch (aiErr: any) {
              addCrawlLog(`Upozorenje pri AI generiranju za ${item.name}: ${aiErr.message}`, 'warn')
            }
          }
        } else {
          currentCrawlJob.duplicateCount++
          addCrawlLog(`Preskočen duplikat (${item.name}): ${resInsert.reason}`, 'warn')
        }
      }

      // Zapiši pojam u povijest pretraživanja
      if (cleanQuery || cleanCity) {
        recordSearchHistory({
          query: cleanQuery || `Opća pretraga (${cleanCity})`,
          city: cleanCity,
          entity_type: entityType || 'all',
          source: registrySource || 'google_registar',
          found_count: currentCrawlJob.foundCount,
          inserted_count: currentCrawlJob.insertedCount
        })
      }

      addCrawlLog(
        `Pretraživanje završeno! Pronađeno: ${currentCrawlJob.foundCount}, Novo spremljeno: ${currentCrawlJob.insertedCount}, Preskočeno duplikata: ${currentCrawlJob.duplicateCount}.`,
        'done'
      )
    } catch (err: any) {
      addCrawlLog(`Greška tijekom pretraživanja: ${err.message}`, 'error')
    } finally {
      currentCrawlJob.running = false
      currentCrawlJob.finishedAt = new Date().toISOString()
    }
  })()

  return NextResponse.json({ ok: true, message: 'Pretraživanje pokrenuto.' })
}
