import { NextRequest, NextResponse } from 'next/server'
import { getCampaignSettings } from '@/lib/mailcrawl/db'
import { verifySmtpConnection } from '@/lib/mailcrawl/mailer'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const settings = { ...getCampaignSettings(), ...(body || {}) }
    await verifySmtpConnection(settings)
    return NextResponse.json({ ok: true, message: 'SMTP veza uspješno uspostavljena!' })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Greška pri provjeri SMTP poslužitelja' }, { status: 400 })
  }
}
