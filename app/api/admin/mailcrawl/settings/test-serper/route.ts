import { NextRequest, NextResponse } from 'next/server'
import { getCampaignSettings } from '@/lib/mailcrawl/db'
import { testSerperApiKey } from '@/lib/mailcrawl/serper'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'

export async function POST(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const settings = getCampaignSettings()
    const apiKey = String(body?.serper_api_key ?? settings.serper_api_key ?? process.env.SERPER_API_KEY ?? '').trim()

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: 'Unesite Serper.dev API ključ prije testiranja.' },
        { status: 400 }
      )
    }

    const result = await testSerperApiKey(apiKey)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Greška pri testiranju Serper.dev API ključa.' },
      { status: 400 }
    )
  }
}
