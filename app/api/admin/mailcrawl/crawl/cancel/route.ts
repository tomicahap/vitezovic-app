import { NextRequest, NextResponse } from 'next/server'
import { cancelActiveCrawl, currentCrawlJob } from '@/lib/mailcrawl/crawler-state'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'

export async function POST(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response

  const cancelled = cancelActiveCrawl()
  return NextResponse.json({
    ok: true,
    cancelled,
    state: currentCrawlJob,
  })
}
