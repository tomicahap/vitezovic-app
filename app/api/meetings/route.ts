import { NextRequest, NextResponse } from 'next/server'
import { MeetingService } from '@/src/services/meeting-service'
import { getAppDb, MeetingsDB } from '@/lib/database'
import { TrashService, extractActor } from '@/lib/trash'

const meetingService = new MeetingService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      const meeting = await meetingService.getMeeting(Number(id))
      if (!meeting) {
        return NextResponse.json({ error: 'Sastanak nije pronađen' }, { status: 404 })
      }
      return NextResponse.json(meeting)
    } else {
      const meetings = await meetingService.getAllMeetings()
      return NextResponse.json(meetings)
    }
  } catch (error) {
    console.error('Greška pri dohvaćanju sastanaka:', error)
    return NextResponse.json({ error: 'Interna greška poslužitelja' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'add': {
        const id = await meetingService.createNewMeeting(data)
        return NextResponse.json({ id })
      }

      case 'update': {
        const { id, ...updates } = data
        const actor = extractActor(request, body)
        const oldRow = getAppDb().prepare('SELECT * FROM meetings WHERE id = ?').get(Number(id))
        TrashService.checkAndTrashMeetingUpdates(Number(id), oldRow, updates, actor)
        await meetingService.updateMeeting(Number(id), updates)
        return NextResponse.json({ success: true })
      }

      case 'add-next-agenda-item': {
        const { id, item } = data
        const meetingRow = MeetingsDB.getById(Number(id))
        if (!meetingRow) {
          return NextResponse.json({ error: 'Sjednica nije pronađena' }, { status: 404 })
        }
        let currentAgenda: any[] = []
        try {
          currentAgenda = meetingRow.next_meeting_agenda ? JSON.parse(meetingRow.next_meeting_agenda) : []
        } catch {}
        MeetingsDB.update(Number(id), {
          next_meeting_agenda: JSON.stringify([...(Array.isArray(currentAgenda) ? currentAgenda : []), item]),
        })
        return NextResponse.json({ success: true })
      }

      case 'remove-next-agenda-item': {
        const { id, itemId } = data
        const actor = extractActor(request, body)
        const oldRow = MeetingsDB.getById(Number(id))
        if (!oldRow) {
          return NextResponse.json({ error: 'Sjednica nije pronađena' }, { status: 404 })
        }
        let currentAgenda: any[] = []
        try {
          currentAgenda = oldRow.next_meeting_agenda ? JSON.parse(oldRow.next_meeting_agenda) : []
        } catch {}
        const nextAgenda = (Array.isArray(currentAgenda) ? currentAgenda : []).filter((i: any) => i.id !== itemId)
        TrashService.checkAndTrashMeetingUpdates(Number(id), oldRow, { next_meeting_agenda: nextAgenda }, actor)
        MeetingsDB.update(Number(id), {
          next_meeting_agenda: JSON.stringify(nextAgenda),
        })
        return NextResponse.json({ success: true })
      }

      case 'delete': {
        const { id } = data
        const actor = extractActor(request, body)
        TrashService.trashMeeting(Number(id), actor)
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Neispravna akcija' }, { status: 400 })
    }
  } catch (error) {
    console.error('Greška pri obradi operacije sastanka:', error)
    return NextResponse.json({ error: 'Interna greška poslužitelja' }, { status: 500 })
  }
}
