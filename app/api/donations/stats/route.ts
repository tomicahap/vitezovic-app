import { NextResponse } from 'next/server'
import { getDonationPublicStats } from '@/lib/mailcrawl/db'

export async function GET() {
  try {
    const stats = getDonationPublicStats()
    return NextResponse.json(stats)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
