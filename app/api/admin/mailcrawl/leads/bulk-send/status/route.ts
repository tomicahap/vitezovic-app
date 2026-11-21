import { NextRequest, NextResponse } from 'next/server'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'
import { getBulkSendJobState } from '@/lib/mailcrawl/bulk-send-state'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response
  return NextResponse.json(getBulkSendJobState())
}
