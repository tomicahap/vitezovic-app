import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'

const db = DatabaseService as any

function parseLecture(row: any) {
  return {
    ...row,
    attendee_ids: JSON.parse(row.attendee_ids || '[]'),
    attachments: JSON.parse(row.attachments || '[]'),
    hosts: JSON.parse(row.hosts || '[]'),
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (id) {
      const lecture = db.getLecture(parseInt(id))
      if (!lecture) return NextResponse.json({ error: 'Predavanje nije pronađeno.' }, { status: 404 })
      return NextResponse.json(parseLecture(lecture))
    }
    const lectures = db.getAllLectures().map(parseLecture)
    return NextResponse.json({ lectures })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body
    const id = body.id ? parseInt(body.id.toString()) : null

    console.log(`[Lectures API] Action: ${action}, ID: ${id}`, data)

    if (action === 'add') {
      const lectureId = db.insertLecture({
        title: data.title,
        type: data.type ?? 'lecture',
        date: data.date,
        start_time: data.start_time ?? null,
        end_time: data.end_time ?? null,
        location: data.location ?? null,
        description: data.description ?? null,
        host: data.host ?? null,
        hosts: data.hosts ?? [],
        attendee_ids: JSON.stringify(data.attendee_ids ?? []),
        attachments: JSON.stringify(data.attachments ?? []),
        status: data.status ?? 'scheduled',
        youtube_url: data.youtube_url ?? null,
        created_by: data.created_by ?? null,
      })
      const lecture = db.getLecture(lectureId)
      return NextResponse.json({ success: true, lecture: parseLecture(lecture) })
    }

    if (action === 'update') {
      db.updateLecture(id, {
        title: data.title,
        type: data.type,
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        location: data.location,
        description: data.description,
        host: data.host,
        hosts: data.hosts ?? [],
        attendee_ids: JSON.stringify(data.attendee_ids ?? []),
        attachments: JSON.stringify(data.attachments ?? []),
        status: data.status,
        youtube_url: data.youtube_url ?? null,
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'delete' && id) {
      db.deleteLecture(id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Nepoznata akcija.' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
