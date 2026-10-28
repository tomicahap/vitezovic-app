import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'
import { getDonationPublicStats } from '@/lib/mailcrawl/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
    }

    const { timestamp: sinceTime, hasPreviousLogin } = DatabaseService.getUserSummaryTimestamp(userId)
    const summary = DatabaseService.getDashboardSummarySince(sinceTime)
    const donations = getDonationPublicStats()

    return NextResponse.json({
      hasPreviousLogin,
      previousLoginTime: sinceTime,
      donations,
      ...summary
    })
  } catch (error: any) {
    console.error('Error fetching dashboard summary:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
