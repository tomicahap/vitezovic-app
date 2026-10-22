import { NextResponse } from 'next/server'
import { currentCrawlJob } from '@/lib/mailcrawl/crawler-state'

export async function GET() {
  return NextResponse.json(currentCrawlJob)
}
