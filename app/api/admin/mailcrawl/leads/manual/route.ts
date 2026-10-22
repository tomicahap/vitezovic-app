import { NextRequest, NextResponse } from 'next/server'
import { getCampaignSettings, insertLead, updateLead } from '@/lib/mailcrawl/db'
import { generatePersonalizedEmail } from '@/lib/mailcrawl/ai'

export async function POST(req: NextRequest) {
  try {
    const data = await req.json().catch(() => ({}))
    if (!data.name || !data.email) {
      return NextResponse.json({ ok: false, error: 'Naziv subjekta i e-mail adresa su obavezni.' }, { status: 400 })
    }

    const insertRes = insertLead({
      ...data,
      source: 'Ručni unos'
    })

    if (!insertRes.inserted) {
      return NextResponse.json({
        ok: false,
        duplicate: true,
        error: `Zaštita od duplikata: ${insertRes.reason}`
      }, { status: 409 })
    }

    let finalLead = insertRes.lead!
    if (data.autoGenerateAi) {
      const settings = getCampaignSettings()
      const aiRes = await generatePersonalizedEmail(finalLead, settings)
      const updated = updateLead(finalLead.id!, {
        email_subject: aiRes.subject,
        email_body: aiRes.body,
        ai_personalization_note: aiRes.personalization_note,
        status: 'draft_ready'
      })
      if (updated) finalLead = updated
    }

    return NextResponse.json({ ok: true, lead: finalLead })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
