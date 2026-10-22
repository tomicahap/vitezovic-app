import { NextRequest, NextResponse } from 'next/server'
import { getCampaignSettings, updateCampaignSettings } from '@/lib/mailcrawl/db'
import { testGeminiApiKey } from '@/lib/mailcrawl/ai'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const settings = { ...getCampaignSettings(), ...(body || {}) }
    if (!settings.gemini_api_key || !settings.gemini_api_key.trim()) {
      return NextResponse.json({ ok: false, error: 'Unesite Gemini API ključ prije testiranja.' }, { status: 400 })
    }
    const result = await testGeminiApiKey(settings.gemini_api_key, settings.gemini_model)
    if (result.used_model && result.used_model !== settings.gemini_model) {
      updateCampaignSettings({ gemini_model: result.used_model })
    }
    return NextResponse.json({
      ok: true,
      message: result.message,
      used_model: result.used_model
    })
  } catch (err: any) {
    const is503 = /503|UNAVAILABLE|high demand/i.test(err?.message || '')
    return NextResponse.json({ ok: false, error: err?.message || 'Greška pri pozivu Gemini API-ja', is503 }, { status: 400 })
  }
}
