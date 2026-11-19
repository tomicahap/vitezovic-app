import { NextResponse } from 'next/server'
import { getAppDb } from '@/lib/database'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const db = getAppDb()
    const row = db
      .prepare(
        `SELECT maintenanceMode, overdueAfterDays, expiredAfterDays, requirePaymentToBeActive,
                boardNotice, boardNoticeAuthor, boardNoticeDate
         FROM settings
         WHERE id = 1`
      )
      .get() as any

    return NextResponse.json(
      {
        maintenanceMode: row?.maintenanceMode === 1 || row?.maintenanceMode === true,
        overdueAfterDays: Number(row?.overdueAfterDays) || 365,
        expiredAfterDays: Number(row?.expiredAfterDays) || 730,
        requirePaymentToBeActive: row?.requirePaymentToBeActive === 1 || row?.requirePaymentToBeActive === true,
        boardNotice: row?.boardNotice ?? null,
        boardNoticeAuthor: row?.boardNoticeAuthor ?? null,
        boardNoticeDate: row?.boardNoticeDate ?? null,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  } catch (error: any) {
    console.error('[System Status GET Error]:', error)
    return NextResponse.json({ error: error?.message || 'Greška poslužitelja.' }, { status: 500 })
  }
}
