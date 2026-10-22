import { NextRequest, NextResponse } from 'next/server'
import { getCampaignSettings, updateCampaignSettings } from '@/lib/mailcrawl/db'

export async function GET() {
  try {
    const settings = getCampaignSettings()
    return NextResponse.json(settings)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const updated = updateCampaignSettings(body || {})
    return NextResponse.json({ ok: true, settings: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
