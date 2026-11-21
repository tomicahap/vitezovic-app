import { NextRequest, NextResponse } from 'next/server'
import { getCampaignSettings } from '@/lib/mailcrawl/db'
import { generateHub3BarcodeBuffer } from '@/lib/mailcrawl/hub3'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'

export async function GET(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response
  try {
    const settings = getCampaignSettings()
    const { pngBuffer, payload } = await generateHub3BarcodeBuffer(settings, {
      name: 'Primjer Tvrtke d.o.o.',
      city: '10000 Zagreb'
    })
    return NextResponse.json({
      ok: true,
      dataUrl: `data:image/png;base64,${pngBuffer.toString('base64')}`,
      payload
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
