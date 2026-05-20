import { NextRequest, NextResponse } from 'next/server'
import { LinksDB } from '@/lib/database'

export async function GET() {
  try {
    const links = LinksDB.getAll()
    return NextResponse.json(links)
  } catch (error) {
    console.error('Error fetching links:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'add': {
        const id = LinksDB.insert(data)
        return NextResponse.json({ id })
      }
      case 'update': {
        const { id, ...updates } = data
        LinksDB.update(id, updates)
        return NextResponse.json({ success: true })
      }
      case 'delete': {
        const { id } = data
        LinksDB.delete(id)
        return NextResponse.json({ success: true })
      }
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error processing link operation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
