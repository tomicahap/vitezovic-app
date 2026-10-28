import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
    }

    DatabaseService.acknowledgeDashboardSummary(userId)

    return NextResponse.json({
      success: true,
      acknowledgedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Error acknowledging dashboard summary:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
