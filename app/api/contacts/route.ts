import { NextRequest, NextResponse } from 'next/server'
import { ContactsDB } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const contacts = ContactsDB.getAll()
    return NextResponse.json(contacts)
  } catch (error) {
    console.error('Error fetching contacts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'add': {
        const id = ContactsDB.insert(data)
        return NextResponse.json({ id })
      }
      case 'update': {
        const { id, ...updates } = data
        ContactsDB.update(id, updates)
        return NextResponse.json({ success: true })
      }
      case 'delete': {
        const { id } = data
        ContactsDB.delete(id)
        return NextResponse.json({ success: true })
      }
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error processing contact operation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
