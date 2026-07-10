import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
    }

    let prevLoginTime = DatabaseService.getPreviousLoginTimestamp(userId)
    let hasPreviousLogin = true

    if (!prevLoginTime) {
      hasPreviousLogin = false
      // Fallback: 7 days ago if no previous login exists
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      prevLoginTime = sevenDaysAgo.toISOString().replace('T', ' ').substring(0, 19)
    }

    const summary = DatabaseService.getDashboardSummarySince(prevLoginTime)

    return NextResponse.json({
      hasPreviousLogin,
      previousLoginTime: prevLoginTime,
      ...summary
    })
  } catch (error: any) {
    console.error('Error fetching dashboard summary:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
