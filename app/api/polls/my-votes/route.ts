import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'
import Database from 'better-sqlite3'
import path from 'path'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const member_id = searchParams.get('member_id')

    if (!member_id) {
      return NextResponse.json({ error: 'Missing member_id' }, { status: 400 })
    }

    // Direct query to the database for simplicity as DatabaseService doesn't have a dedicated method for this yet
    const dbPath = path.join(process.cwd(), 'data', 'app.db')
    const db = new Database(dbPath)
    
    try {
      const votes = db.prepare('SELECT poll_id, option_index FROM poll_votes WHERE member_id = ?').all(member_id)
      return NextResponse.json(votes)
    } finally {
      db.close()
    }
  } catch (error) {
    console.error('Error fetching member votes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
