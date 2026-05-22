import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization')
    const role = authHeader?.replace('Bearer ', '').trim()
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Nemate dozvolu za izmjenu glasovanja.' }, { status: 403 })
    }

    const { id } = await params
    const pollId = parseInt(id)
    const body = await request.json()
    
    DatabaseService.updatePoll(pollId, body)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating poll:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization')
    const role = authHeader?.replace('Bearer ', '').trim()
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Nemate dozvolu za brisanje glasovanja.' }, { status: 403 })
    }

    const { id } = await params
    const pollId = parseInt(id)
    console.log(`[API] Deleting poll ID: ${pollId}`)
    DatabaseService.deletePoll(pollId)
    console.log(`[API] Successfully deleted poll ID: ${pollId}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting poll:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
