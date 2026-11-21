import { NextRequest, NextResponse } from 'next/server'
import { getCampaignSettings } from '@/lib/mailcrawl/db'
import { testTavilyApiKey } from '@/lib/mailcrawl/tavily'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'

export async function POST(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const settings = getCampaignSettings()
    const apiKey = String(
      body?.tavily_api_key ?? settings.tavily_api_key ?? process.env.TAVILY_API_KEY ?? ''
    ).trim()

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: 'Unesite Tavily API ključ (tvly-...) prije testiranja.' },
        { status: 400 }
      )
    }

    const result = await testTavilyApiKey(apiKey)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Greška pri testiranju Tavily API ključa.' },
      { status: 400 }
    )
  }
}
