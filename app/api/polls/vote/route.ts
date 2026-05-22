import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const role = authHeader?.replace('Bearer ', '').trim()
    const userIdHeader = request.headers.get('x-user-id')

    if (!role) {
      return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 })
    }

    const body = await request.json()
    const { poll_id, member_id, option_index } = body

    if (poll_id === undefined || member_id === undefined || option_index === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if poll exists and is active
    const poll = DatabaseService.getPoll(poll_id)
    if (!poll || poll.status !== 'active') {
      return NextResponse.json({ error: 'Glasovanje nije aktivno.' }, { status: 400 })
    }

    if (role !== 'admin') {
      // Regular users can only vote for themselves
      if (!userIdHeader || parseInt(userIdHeader) !== parseInt(member_id)) {
        return NextResponse.json({ error: 'Nemate dozvolu glasovati u ime drugog člana.' }, { status: 403 })
      }
      
      // Regular users cannot vote twice
      const alreadyVoted = DatabaseService.hasMemberVoted(poll_id, member_id)
      if (alreadyVoted) {
        return NextResponse.json({ error: 'Već ste glasovali.' }, { status: 400 })
      }
    }

    DatabaseService.insertVote(poll_id, member_id, option_index)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error recording vote:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const role = authHeader?.replace('Bearer ', '').trim()

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Samo administrator može uklanjati glasove.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const poll_id = searchParams.get('poll_id')
    const member_id = searchParams.get('member_id')

    if (!poll_id || !member_id) {
      return NextResponse.json({ error: 'Missing poll_id or member_id' }, { status: 400 })
    }

    DatabaseService.deleteVote(parseInt(poll_id), parseInt(member_id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting vote:', error)
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
