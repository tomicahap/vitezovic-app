import { NextRequest, NextResponse } from 'next/server'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'
import { calibrateApiQuota, getApiQuotaSummary } from '@/lib/mailcrawl/usage'
import type { ApiQuotaProviderKey } from '@/lib/mailcrawl/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ALLOWED_PROVIDERS: ApiQuotaProviderKey[] = ['gemini', 'serper', 'tavily', 'firecrawl']

export async function GET(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(req.url)
    const forceLiveRefresh = searchParams.get('refresh') === '1'
    const summary = await getApiQuotaSummary({ forceLiveRefresh })
    return NextResponse.json(summary, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      },
    })
  } catch (err: any) {
    console.error('[Mailcrawl Quota GET Error]:', err)
    return NextResponse.json(
      { error: err?.message || 'Greška pri dohvaćanju kvota API alata.' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const provider = String(body?.provider || '').trim() as ApiQuotaProviderKey
    if (!ALLOWED_PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: 'Nepoznat API alat za kalibraciju.' }, { status: 400 })
    }

    const limit =
      body?.limit !== undefined && body?.limit !== '' ? Number(body.limit) : undefined
    const rpmLimit =
      body?.rpmLimit !== undefined && body?.rpmLimit !== '' ? Number(body.rpmLimit) : undefined
    const desiredRemaining =
      body?.desiredRemaining !== undefined &&
      body?.desiredRemaining !== null &&
      String(body.desiredRemaining).trim() !== ''
        ? Number(String(body.desiredRemaining).replace(',', '.'))
        : null

    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
      return NextResponse.json({ error: 'Limit mora biti pozitivan broj.' }, { status: 400 })
    }
    if (rpmLimit !== undefined && (!Number.isFinite(rpmLimit) || rpmLimit <= 0)) {
      return NextResponse.json({ error: 'RPM limit mora biti pozitivan broj.' }, { status: 400 })
    }
    if (desiredRemaining !== null && (!Number.isFinite(desiredRemaining) || desiredRemaining < 0)) {
      return NextResponse.json(
        { error: 'Preostali krediti ne mogu biti negativan broj.' },
        { status: 400 }
      )
    }

    calibrateApiQuota({
      provider,
      limit,
      rpmLimit,
      desiredRemaining,
      resetLocalCounter: Boolean(body?.resetLocalCounter),
    })

    const summary = await getApiQuotaSummary({
      forceLiveRefresh: provider === 'firecrawl',
    })
    return NextResponse.json({ ok: true, summary })
  } catch (err: any) {
    console.error('[Mailcrawl Quota POST Error]:', err)
    return NextResponse.json(
      { error: err?.message || 'Greška pri spremanju kalibracije kvote.' },
      { status: 500 }
    )
  }
}
