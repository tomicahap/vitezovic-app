import { NextRequest, NextResponse } from 'next/server'
import { getCampaignSettings } from '@/lib/mailcrawl/db'
import { listAvailableGeminiModels } from '@/lib/mailcrawl/ai'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const settings = { ...getCampaignSettings(), ...(body || {}) }
    const models = await listAvailableGeminiModels(settings.gemini_api_key)
    return NextResponse.json({ ok: true, models })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 })
  }
}
