import { NextRequest, NextResponse } from 'next/server'
import { db, getCampaignSettings } from '@/lib/mailcrawl/db'
import { composeEmailContent } from '@/lib/mailcrawl/mailer'
import type { Lead } from '@/lib/mailcrawl/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as Lead | undefined
    if (!lead) return NextResponse.json({ ok: false, error: 'Kontakt nije pronađen.' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const mergedLead = { ...lead, ...(body || {}) }
    const settings = getCampaignSettings()
    const { html, plainText, barcodeDataUrl } = await composeEmailContent(mergedLead, settings, false)

    const contact = (mergedLead.contact_person || '').trim()
    const company = (mergedLead.name || '').trim()
    let formattedTo = mergedLead.email
    if (contact && company) {
      formattedTo = `${contact} (${company}) <${mergedLead.email}>`
    } else if (contact) {
      formattedTo = `${contact} <${mergedLead.email}>`
    } else if (company) {
      formattedTo = `${company} <${mergedLead.email}>`
    }

    return NextResponse.json({
      ok: true,
      html,
      plainText,
      barcodeDataUrl,
      from: `${settings.sender_name} <${settings.sender_email}>`,
      to: formattedTo,
      subject: mergedLead.email_subject
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
