import { NextRequest, NextResponse } from 'next/server'

if (typeof process !== 'undefined' && process.env) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

import {
  getCampaignSettings,
  insertLead,
  updateLead,
  getKnownEntitiesChecker,
  recordSearchHistory
} from '@/lib/mailcrawl/db'
import { discoverCroatianEntities } from '@/lib/mailcrawl/scraper'
import { generatePersonalizedEmail } from '@/lib/mailcrawl/ai'
import { currentCrawlJob, addCrawlLog } from '@/lib/mailcrawl/crawler-state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (currentCrawlJob.running) {
    return NextResponse.json(
      { ok: false, error: 'Pretraživanje je već u tijeku. Pričekajte završetak.' },
      { status: 409 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const { terms, entityType = 'all', registrySource = 'all', maxPerTerm = 5 } = body || {}

  if (!Array.isArray(terms) || terms.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Potrebno je proslijediti barem jedan pojam za pretraživanje.' },
      { status: 400 }
    )
  }

  // Ograniči na najviše 20 pojmova po batchu
  const sanitizedTerms: Array<{ query: string; city: string }> = terms
    .slice(0, 20)
    .map(t => ({
      query: String(t.query || '').trim(),
      city: String(t.city || '').trim()
    }))
    .filter(t => Boolean(t.query))

  if (sanitizedTerms.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Nijedan valjani pojam nije pronađen u zahtjevu.' },
      { status: 400 }
    )
  }

  currentCrawlJob.running = true
  currentCrawlJob.logs = []
  currentCrawlJob.foundCount = 0
  currentCrawlJob.insertedCount = 0
  currentCrawlJob.duplicateCount = 0
  currentCrawlJob.startedAt = new Date().toISOString()
  currentCrawlJob.finishedAt = null

  // Pokreni asinkronu serijsku obradu pojmova
  ;(async () => {
    try {
      const settings = getCampaignSettings()
      const isKnown = getKnownEntitiesChecker()

      addCrawlLog(`Započinjem automatsku serijsku obradu za ${sanitizedTerms.length} pojmova...`, 'info')

      for (let i = 0; i < sanitizedTerms.length; i++) {
        const item = sanitizedTerms[i]
        const cleanQuery = item.query
        const cleanCity = item.city

        addCrawlLog(
          `--- [${i + 1}/${sanitizedTerms.length}] Pretražujem: "${cleanQuery}"${cleanCity ? ` (${cleanCity})` : ''} ---`,
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
              maxResults: Math.min(Math.max(Number(maxPerTerm) || 5, 1), 10),
              isKnownEntity: isKnown
            },
            (progress) => {
              addCrawlLog(`[${cleanQuery}] ${progress.message}`, progress.phase === 'found' ? 'success' : 'info')
            }
          )

          termFoundCount = results.length
          currentCrawlJob.foundCount += termFoundCount

          for (const discovered of results) {
            const resInsert = insertLead(discovered)
            if (resInsert.inserted && resInsert.lead) {
              termInsertedCount++
              currentCrawlJob.insertedCount++
              addCrawlLog(`Spremljeno u bazu: ${discovered.name} (${discovered.email})`, 'success')

              // Automatski generiraj personalizirani mail spreman za slanje
              try {
                addCrawlLog(`Pripremam nacrt maila za: ${discovered.name}...`, 'info')
                const aiRes = await generatePersonalizedEmail(resInsert.lead, settings)
                updateLead(resInsert.lead.id!, {
                  email_subject: aiRes.subject,
                  email_body: aiRes.body,
                  ai_personalization_note: aiRes.personalization_note,
                  activity_summary: aiRes.concise_activity || resInsert.lead.activity_summary,
                  status: 'draft_ready'
                })
                addCrawlLog(`Nacrt maila spreman za slanje: ${discovered.name} (${discovered.email})`, 'success')
              } catch (aiErr: any) {
                addCrawlLog(`Upozorenje pri generiranju nacrta za ${discovered.name}: ${aiErr.message}`, 'warn')
              }
            } else {
              currentCrawlJob.duplicateCount++
              addCrawlLog(`Preskočen postojeći subjekt (${discovered.name}): ${resInsert.reason}`, 'warn')
            }
          }
        } catch (termErr: any) {
          addCrawlLog(`Greška pri obradi pojma "${cleanQuery}": ${termErr.message}`, 'error')
        }

        // Zabilježi pojam u povijest kako se u budućnosti ne bi ponavljao
        recordSearchHistory({
          query: cleanQuery,
          city: cleanCity,
          entity_type: entityType,
          source: registrySource,
          found_count: termFoundCount,
          inserted_count: termInsertedCount
        })

        // Kratka pauza između pojmova za rasterećenje poslužitelja
        if (i < sanitizedTerms.length - 1) {
          await new Promise(r => setTimeout(r, 700))
        }
      }

      addCrawlLog(
        `=== Serijska obrada završena! Obrađeno ${sanitizedTerms.length} pojmova. Ukupno spremljeno: ${currentCrawlJob.insertedCount} novih subjekata s gotovim nacrtima mailova za slanje. ===`,
        'done'
      )
    } catch (e: any) {
      addCrawlLog(`Kritična greška u serijskoj obradi: ${e.message}`, 'error')
    } finally {
      currentCrawlJob.running = false
      currentCrawlJob.finishedAt = new Date().toISOString()
    }
  })()

  return NextResponse.json({
    ok: true,
    message: `Pokrenuta je automatska obrada za ${sanitizedTerms.length} pojmova.`,
    termsCount: sanitizedTerms.length
  })
}
