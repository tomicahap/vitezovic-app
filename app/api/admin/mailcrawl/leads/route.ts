import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/mailcrawl/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const entity_type = searchParams.get('entity_type')
    const q = searchParams.get('q')

    let sql = 'SELECT * FROM leads WHERE 1=1'
    const params: any[] = []

    if (status && status !== 'all') {
      sql += ' AND status = ?'
      params.push(status)
    }
    if (entity_type && entity_type !== 'all') {
      sql += ' AND entity_type = ?'
      params.push(entity_type)
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
