import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')
    const status = searchParams.get('status') as 'active' | 'archived' | null

    const allMembers = DatabaseService.getMemberNames()

    if (memberId) {
      const showAll = searchParams.get('all') === 'true'
      console.log(`[Polls API] Fetching polls for memberId: ${memberId}, showAll: ${showAll}`)
      
      const polls = showAll 
        ? DatabaseService.getPollsForMember(parseInt(memberId))
        : DatabaseService.getActivePollsForMember(parseInt(memberId))
      
      console.log(`[Polls API] Found ${polls.length} polls for member ${memberId}`)
        
      // If not showAll, filter out those already voted on (redundant but safe)
      const filtered = showAll ? polls : polls.filter(p => !DatabaseService.hasMemberVoted(p.id, parseInt(memberId)))
      
      console.log(`[Polls API] Returning ${filtered.length} polls after filtering`)
      
      return NextResponse.json(filtered.map(p => {
        try {
          const parseRecursive = (val: any): any => {
            if (typeof val !== 'string') return val
            try {
              const parsed = JSON.parse(val)
              if (typeof parsed === 'string') return parseRecursive(parsed)
              return parsed
            } catch (e) { return val }
          }

          let targetIds = parseRecursive(p.target_member_ids)
          if (!targetIds) targetIds = 'all'

          let invitedMembers: string[] = []
          if (targetIds === 'all') {
            invitedMembers = ['Svi članovi']
          } else if (Array.isArray(targetIds)) {
            const idList = targetIds.map(id => String(id))
            invitedMembers = allMembers
              .filter(m => idList.includes(String(m.id)))
              .map(m => m.name)
          }

          return {
            ...p,
            options: typeof p.options === 'string' ? JSON.parse(p.options) : p.options,
            target_member_ids: targetIds,
            invited_members: invitedMembers,
            hasVoted: DatabaseService.hasMemberVoted(p.id, parseInt(memberId))
          }
        } catch (e) {
          console.error(`Error parsing poll ${p.id}:`, e)
          return {
            ...p,
            options: [],
            target_member_ids: [],
            invited_members: [],
            hasVoted: DatabaseService.hasMemberVoted(p.id, parseInt(memberId))
          }
        }
      }))
    }

    const polls = DatabaseService.getPolls(status || undefined)
    return NextResponse.json(polls.map(p => {
      try {
        const parseRecursive = (val: any): any => {
          if (typeof val !== 'string') return val
          try {
            const parsed = JSON.parse(val)
            if (typeof parsed === 'string') return parseRecursive(parsed)
            return parsed
          } catch (e) { return val }
        }

        let targetIds = parseRecursive(p.target_member_ids)
        if (!targetIds) targetIds = 'all'

        let invitedMembers: string[] = []
        if (targetIds === 'all') {
          invitedMembers = ['Svi članovi']
        } else if (Array.isArray(targetIds)) {
          const idList = targetIds.map(id => String(id))
          invitedMembers = allMembers
            .filter(m => idList.includes(String(m.id)))
            .map(m => m.name)
        }

        return {
          ...p,
          options: typeof p.options === 'string' ? JSON.parse(p.options) : p.options,
          target_member_ids: targetIds,
          invited_members: invitedMembers
        }
      } catch (e) {
        console.error(`Error parsing poll ${p.id} for admin:`, e)
        return {
          ...p,
          options: [],
          target_member_ids: [],
          invited_members: []
        }
      }
    }))
  } catch (error) {
    console.error('Error fetching polls:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, options, target_member_ids, meeting_id, created_by } = body

    if (!title || !options || !target_member_ids) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const id = DatabaseService.insertPoll({
      title,
      description,
      options,
      target_member_ids,
      status: 'active',
      meeting_id,
      created_by
    })

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('Error creating poll:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
