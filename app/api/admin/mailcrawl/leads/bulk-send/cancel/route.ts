import { NextRequest, NextResponse } from 'next/server'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'
import { cancelBulkSendJob, getBulkSendJobState } from '@/lib/mailcrawl/bulk-send-state'

export async function POST(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response

  const cancelled = cancelBulkSendJob()
  return NextResponse.json({
    ok: true,
    cancelled,
    job: getBulkSendJobState(),
  })
}
