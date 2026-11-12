import { NextRequest, NextResponse } from 'next/server'
import { generateUniqueSearchTerms, CROATIAN_NICHE_CATEGORIES } from '@/lib/mailcrawl/term-generator'
import { listSearchHistory } from '@/lib/mailcrawl/db'

export async function GET() {
  try {
    const history = listSearchHistory(50)
    const categories = CROATIAN_NICHE_CATEGORIES.map(c => c.category)
    return NextResponse.json({
      ok: true,
      categories,
      historyCount: history.length
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { count = 5, category, city } = body || {}

    const numCount = Number(count) || 5
    const res = await generateUniqueSearchTerms({
      count: numCount,
      category,
      city
    })

    return NextResponse.json({
      ok: true,
      terms: res.terms,
      source: res.source,
      usedHistoryCount: res.usedHistoryCount
    })
  } catch (e: any) {
    console.error('[API terms/generate] Greška pri generiranju pojmova:', e)
    return NextResponse.json(
      { ok: false, error: e.message || 'Greška pri generiranju pojmova' },
      { status: 500 }
    )
  }
}
