import { NextResponse } from 'next/server'
import { db } from '@/lib/mailcrawl/db'

export async function GET() {
  try {
    const rows = db.prepare('SELECT * FROM sent_registry ORDER BY id DESC').all()
    return NextResponse.json(rows)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
