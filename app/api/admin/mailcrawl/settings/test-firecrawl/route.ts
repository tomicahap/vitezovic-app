import { NextRequest, NextResponse } from 'next/server'
import { getCampaignSettings } from '@/lib/mailcrawl/db'
import { testFirecrawlApiKey } from '@/lib/mailcrawl/firecrawl'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'

export async function POST(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const settings = getCampaignSettings()
    const apiKey = String(
      body?.firecrawl_api_key ?? settings.firecrawl_api_key ?? process.env.FIRECRAWL_API_KEY ?? ''
    ).trim()

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: 'Unesite Firecrawl API ključ (fc-...) prije testiranja.' },
        { status: 400 }
      )
    }

    const result = await testFirecrawlApiKey(apiKey)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Greška pri testiranju Firecrawl API ključa.' },
      { status: 400 }
    )
  }
}
