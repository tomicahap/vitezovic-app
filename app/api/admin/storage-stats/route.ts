import { NextRequest, NextResponse } from 'next/server'
import { extractActor } from '@/lib/trash'
import { collectStorageStats } from '@/lib/storage-stats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function isAdminRequest(request: NextRequest): boolean {
  const actor = extractActor(request)
  if ((actor.role || '').trim().toLowerCase() === 'admin') {
    return true
  }
  const authHeader = request.headers.get('Authorization') || ''
  if (authHeader.replace('Bearer ', '').trim().toLowerCase() === 'admin') {
    return true
  }
  return false
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json(
      { error: 'Pristup statistikama pohrane dopušten je isključivo administratoru.' },
      { status: 403 }
    )
  }

  try {
    const stats = collectStorageStats()
    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error: any) {
    console.error('[GET /api/admin/storage-stats] Greška:', error)
    return NextResponse.json(
      { error: error?.message || 'Greška pri izračunu veličine baza i modula.' },
      { status: 500 }
    )
  }
}
