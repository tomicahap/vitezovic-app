import { NextRequest, NextResponse } from 'next/server'
import { generateUniqueSearchTerms, CROATIAN_NICHE_CATEGORIES } from '@/lib/mailcrawl/term-generator'
import { listSearchHistory } from '@/lib/mailcrawl/db'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const history = listSearchHistory(50)
    const categories = CROATIAN_NICHE_CATEGORIES.map((c) => c.category)
    return NextResponse.json({
      ok: true,
      categories,
      historyCount: history.length,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const { count = 5, category, city, mode = 'catalog' } = body || {}

    const numCount = Number(count) || 5
    const res = await generateUniqueSearchTerms({
      count: numCount,
      category,
      city,
      mode: mode === 'gemini' ? 'gemini' : 'catalog',
    })

    return NextResponse.json({
      ok: true,
      terms: res.terms,
      source: res.source,
      usedHistoryCount: res.usedHistoryCount,
    })
  } catch (e: any) {
    console.error('[API terms/generate] Greška pri generiranju pojmova:', e)
    return NextResponse.json(
      { ok: false, error: e.message || 'Greška pri generiranju pojmova' },
      { status: 500 }
    )
  }
}
