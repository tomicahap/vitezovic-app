import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { poll_id, member_id, option_index } = body

    if (poll_id === undefined || member_id === undefined || option_index === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if poll exists and is active
    const poll = DatabaseService.getPoll(poll_id)
    if (!poll || poll.status !== 'active') {
      return NextResponse.json({ error: 'Poll is not active' }, { status: 400 })
    }

    DatabaseService.insertVote(poll_id, member_id, option_index)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error recording vote:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const poll_id = searchParams.get('poll_id')

    if (!poll_id) {
      return NextResponse.json({ error: 'Missing poll_id' }, { status: 400 })
    }

    const votes = DatabaseService.getVotesForPoll(parseInt(poll_id))
    return NextResponse.json(votes)
  } catch (error) {
    console.error('Error fetching votes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
