import { NextRequest, NextResponse } from 'next/server'
import { currentCrawlJob } from '@/lib/mailcrawl/crawler-state'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'

export async function GET(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response
  return NextResponse.json(currentCrawlJob)
}
