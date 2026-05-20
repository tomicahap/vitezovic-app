import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService, serializeActivityLog, deserializeActivityLog } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const logs = DatabaseService.getLogs(1000)
    return NextResponse.json(logs.map(deserializeActivityLog))
  } catch (error) {
    console.error('Error fetching activity logs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { operation, ...data } = body

    switch (operation) {
      case 'add': {
        const dbLog = serializeActivityLog(data)
        const id = DatabaseService.insertLog(dbLog)
        return NextResponse.json({ id })
      }

      case 'clear': {
        DatabaseService.clearLogs()
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error processing activity log operation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}