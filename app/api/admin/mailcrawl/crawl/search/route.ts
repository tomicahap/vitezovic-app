import { NextRequest, NextResponse } from 'next/server'
import { db, getCampaignSettings, insertLead, updateLead, getKnownEntitiesChecker } from '@/lib/mailcrawl/db'
import { discoverCroatianEntities } from '@/lib/mailcrawl/scraper'
import { generatePersonalizedEmail } from '@/lib/mailcrawl/ai'
import { currentCrawlJob, addCrawlLog } from '@/lib/mailcrawl/crawler-state'

export async function POST(req: NextRequest) {
  if (currentCrawlJob.running) {
    return NextResponse.json(
      { ok: false, error: 'Pretraživanje je već u tijeku. Pričekajte završetak.' },
      { status: 409 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const { query, city, entityType, registrySource, maxResults, autoGenerateAi } = body || {}

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
          query: String(query || '').trim(),
          city: String(city || '').trim(),
          entityType: entityType || 'all',
          registrySource: registrySource || 'all',
          maxResults: Number(maxResults) || 10,
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
