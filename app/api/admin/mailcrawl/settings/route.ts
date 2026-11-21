import { NextRequest, NextResponse } from 'next/server'
import { getCampaignSettings, updateCampaignSettings } from '@/lib/mailcrawl/db'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'

export async function GET(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response
  try {
    const settings = getCampaignSettings()
    return NextResponse.json(settings)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response
  try {
    const body = await req.json()
    const updated = updateCampaignSettings(body || {})
    return NextResponse.json({ ok: true, settings: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
