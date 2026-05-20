import { NextRequest, NextResponse } from 'next/server'
import { MeetingService } from '@/src/services/meeting-service'

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
        await meetingService.updateMeeting(Number(id), updates)
        return NextResponse.json({ success: true })
      }

      case 'delete': {
        const { id } = data
        await meetingService.deleteMeeting(Number(id))
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
