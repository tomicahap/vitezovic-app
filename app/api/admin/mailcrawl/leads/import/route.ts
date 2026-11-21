import { NextRequest, NextResponse } from 'next/server'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'
import {
  createKnownEntitiesTracker,
  getCampaignSettings,
  insertLead,
  updateLead,
} from '@/lib/mailcrawl/db'
import { crawlCompanyWebsite, runWithConcurrency } from '@/lib/mailcrawl/scraper'
import { buildSmartFallbackEmail } from '@/lib/mailcrawl/ai'
import { DatabaseService } from '@/lib/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ImportLeadRow {
  name?: string
  email?: string
  website?: string
  oib?: string
  city?: string
  address?: string
  phone?: string
  contact_person?: string
  contact_role?: string
  entity_type?: string
  activity_category?: string
}

export async function POST(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const { rows, crawlMissingEmails = false, prepareTemplate = true } = body || {}

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Datoteka ne sadrži nijedan redak za uvoz.' },
        { status: 400 }
      )
    }

    const inputRows = (rows as ImportLeadRow[]).slice(0, 500)
    const settings = getCampaignSettings()
    const tracker = createKnownEntitiesTracker()

    let insertedCount = 0
    let duplicateCount = 0
    let skippedNoEmail = 0
    let crawledCount = 0
    const errors: string[] = []

    const preparedRows: ImportLeadRow[] = []

    // 1. Razdvoji retke s već postojećim e-mailom i one kojima treba izvući e-mail s weba
    const rowsNeedingCrawl: ImportLeadRow[] = []
    for (const r of inputRows) {
      const name = String(r?.name || '').trim()
      const email = String(r?.email || '').trim()
      const website = String(r?.website || '').trim()
      const oib = String(r?.oib || '').trim()

      if (!name && !website && !email) continue

      if (tracker.isKnown({ name, email, domain: website, oib })) {
        duplicateCount++
        continue
      }

      if (email && email.includes('@')) {
        preparedRows.push(r)
      } else if (crawlMissingEmails && website) {
        rowsNeedingCrawl.push(r)
      } else {
        skippedNoEmail++
      }
    }

    // 2. Paralelno izvlačenje e-mailova s web stranica za retke bez e-maila
    if (rowsNeedingCrawl.length > 0) {
      await runWithConcurrency(
        rowsNeedingCrawl,
        6,
        async (row) => {
          try {
            const crawled = await crawlCompanyWebsite(String(row.website), {
              name: row.name ? String(row.name).trim() : undefined,
              oib: row.oib ? String(row.oib).trim() : undefined,
              city: row.city ? String(row.city).trim() : undefined,
              address: row.address ? String(row.address).trim() : undefined,
              phone: row.phone ? String(row.phone).trim() : undefined,
              contact_person: row.contact_person ? String(row.contact_person).trim() : undefined,
              contact_role: row.contact_role ? String(row.contact_role).trim() : undefined,
              entity_type: row.entity_type ? String(row.entity_type).trim() : undefined,
              activity_category: row.activity_category ? String(row.activity_category).trim() : undefined,
              source: 'Excel/CSV uvoz + Web analiza',
            })
            if (crawled && crawled.email) {
              crawledCount++
              preparedRows.push({
                ...row,
                name: row.name?.trim() || crawled.name,
                email: crawled.email,
                website: crawled.website || row.website,
                oib: row.oib?.trim() || crawled.oib,
                city: row.city?.trim() || crawled.city,
                phone: row.phone?.trim() || crawled.phone,
                contact_person: row.contact_person?.trim() || crawled.contact_person,
                contact_role: row.contact_role?.trim() || crawled.contact_role,
                entity_type: row.entity_type?.trim() || crawled.entity_type,
                activity_category: row.activity_category?.trim() || crawled.activity_category,
              })
            } else {
              skippedNoEmail++
            }
          } catch {
            skippedNoEmail++
          }
        },
        req.signal
      )
    }

    // 3. Upis u bazu uz punu deduplikaciju i opcionalni pametni predložak
    for (const r of preparedRows) {
      const name = String(r.name || '').trim() || String(r.website || r.email || 'Uvezeni subjekt').trim()
      const email = String(r.email || '').trim()
      if (!email || !email.includes('@')) {
        skippedNoEmail++
        continue
      }

      try {
        const resInsert = insertLead({
          name,
          email,
          website: r.website ? String(r.website).trim() : '',
          oib: r.oib ? String(r.oib).trim() : '',
          city: r.city ? String(r.city).trim() : '',
          address: r.address ? String(r.address).trim() : '',
          phone: r.phone ? String(r.phone).trim() : '',
          contact_person: r.contact_person ? String(r.contact_person).trim() : '',
          contact_role: r.contact_role ? String(r.contact_role).trim() : '',
          entity_type: r.entity_type ? String(r.entity_type).trim() : 'tvrtka',
          activity_category: r.activity_category ? String(r.activity_category).trim() : '',
          source: 'Excel / CSV uvoz',
        })

        if (resInsert.inserted && resInsert.lead) {
          insertedCount++
          tracker.markKnown({
            email: resInsert.lead.email,
            domain: resInsert.lead.website,
            oib: resInsert.lead.oib,
            name: resInsert.lead.name,
          })

          if (prepareTemplate) {
            const fb = buildSmartFallbackEmail(resInsert.lead, settings)
            updateLead(resInsert.lead.id!, {
              email_subject: fb.subject,
              email_body: fb.body,
              ai_personalization_note: fb.personalization_note,
              status: 'draft_ready',
            })
          }
        } else {
          duplicateCount++
        }
      } catch (e: any) {
        errors.push(`${name}: ${e?.message || 'Greška pri unosu'}`)
      }
    }

    try {
      DatabaseService.insertLog({
        userId: auth.actor.id || 'system',
        userName: auth.actor.name || 'Administrator',
        userRole: auth.actor.role || 'admin',
        action: 'Masovni uvoz kontakata za donacije',
        details: `Uvezeno novih subjekata: ${insertedCount} (duplikata/odjava preskočeno: ${duplicateCount}, bez e-maila: ${skippedNoEmail}, s weba izvučeno: ${crawledCount}).`,
        timestamp: new Date().toISOString(),
      })
    } catch {}

    return NextResponse.json({
      ok: true,
      totalRows: inputRows.length,
      insertedCount,
      duplicateCount,
      skippedNoEmail,
      crawledCount,
      errors,
      message: `Uspješno uvezeno ${insertedCount} novih kontakata! Preskočeno duplikata/odjava: ${duplicateCount}${
        skippedNoEmail > 0 ? `, bez valjanog e-maila: ${skippedNoEmail}` : ''
      }.`,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Greška pri uvozu kontakata.' }, { status: 500 })
  }
}
