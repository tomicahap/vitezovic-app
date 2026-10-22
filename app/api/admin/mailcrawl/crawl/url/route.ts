import { NextRequest, NextResponse } from 'next/server'
import { getCampaignSettings, insertLead, updateLead } from '@/lib/mailcrawl/db'
import { crawlCompanyWebsite } from '@/lib/mailcrawl/scraper'
import { generatePersonalizedEmail } from '@/lib/mailcrawl/ai'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { url, entityType, city, activityCategory, autoGenerateAi } = body || {}

    if (!url || !String(url).trim()) {
      return NextResponse.json({ ok: false, error: 'Unesite URL web stranice subjekta.' }, { status: 400 })
    }

    const crawled = await crawlCompanyWebsite(String(url).trim(), {
      entity_type: entityType || undefined,
      city: city || '',
      activity_category: activityCategory || '',
      source: 'Izravna analiza weba'
    })

    if (!crawled) {
      return NextResponse.json({ ok: false, error: 'Nije moguće dohvatiti navedenu web stranicu.' }, { status: 400 })
    }

    const insertRes = insertLead(crawled)
    if (!insertRes.inserted) {
      return NextResponse.json({
        ok: false,
        duplicate: true,
        error: `Duplikat: ${insertRes.reason}`,
        existing: insertRes.existing
      }, { status: 409 })
    }

    let finalLead = insertRes.lead!
    if (autoGenerateAi) {
      const settings = getCampaignSettings()
      const aiRes = await generatePersonalizedEmail(finalLead, settings)
      const updated = updateLead(finalLead.id!, {
        email_subject: aiRes.subject,
        email_body: aiRes.body,
        ai_personalization_note: aiRes.personalization_note,
        activity_summary: aiRes.concise_activity || finalLead.activity_summary,
        status: 'draft_ready'
      })
      if (updated) finalLead = updated
    }

    return NextResponse.json({ ok: true, lead: finalLead })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
