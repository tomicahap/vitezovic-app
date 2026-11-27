import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/mailcrawl/db'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'

export async function GET(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const entity_type = searchParams.get('entity_type')
    const member_id = searchParams.get('member_id')
    const q = searchParams.get('q')

    let sql = 'SELECT * FROM leads WHERE 1=1'
    const params: any[] = []

    if (status && status !== 'all') {
      if (status === 'pending' || status === 'remaining') {
        sql += " AND status NOT IN ('sent', 'donor', 'rejected')"
      } else {
        sql += ' AND status = ?'
        params.push(status)
      }
    }
    if (entity_type && entity_type !== 'all') {
      sql += ' AND entity_type = ?'
      params.push(entity_type)
    }
    if (member_id && Number.isFinite(Number(member_id)) && Number(member_id) > 0) {
      sql += ' AND member_id = ?'
      params.push(Number(member_id))
    }
    if (q && String(q).trim()) {
      const term = `%${String(q).trim()}%`
      sql += ' AND (name LIKE ? OR email LIKE ? OR city LIKE ? OR contact_person LIKE ? OR activity_summary LIKE ? OR oib LIKE ?)'
      params.push(term, term, term, term, term, term)
    }

    sql += ' ORDER BY id DESC'
    const rows = db.prepare(sql).all(...params)
    return NextResponse.json(rows)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
