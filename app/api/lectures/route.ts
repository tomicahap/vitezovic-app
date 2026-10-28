import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'

const db = DatabaseService as any

function parseLecture(row: any) {
  if (!row) return row
  let attendee_ids = []
  let attachments = []
  let hosts = []
  try { attendee_ids = typeof row.attendee_ids === 'string' ? JSON.parse(row.attendee_ids || '[]') : (row.attendee_ids || []) } catch {}
  try { attachments = typeof row.attachments === 'string' ? JSON.parse(row.attachments || '[]') : (row.attachments || []) } catch {}
  try { hosts = typeof row.hosts === 'string' ? JSON.parse(row.hosts || '[]') : (row.hosts || []) } catch {}

  return {
    ...row,
    attendee_ids,
    attachments,
    hosts,
    notification_sent_at: row.notification_sent_at || null,
    notification_recipients: row.notification_recipients || null,
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

    if (action === 'update' && id) {
      const updatePayload: any = {
        title: data.title,
        type: data.type,
        date: data.date,
        start_time: data.start_time ?? null,
        end_time: data.end_time ?? null,
        location: data.location ?? null,
        description: data.description ?? null,
        host: data.host ?? null,
        hosts: data.hosts ?? [],
        attendee_ids: JSON.stringify(data.attendee_ids ?? []),
        attachments: JSON.stringify(data.attachments ?? []),
        status: data.status,
        youtube_url: data.youtube_url ?? null,
      }
      if (data.notification_sent_at !== undefined) {
        updatePayload.notification_sent_at = data.notification_sent_at
      }
      if (data.notification_recipients !== undefined) {
        updatePayload.notification_recipients = typeof data.notification_recipients === 'string'
          ? data.notification_recipients
          : JSON.stringify(data.notification_recipients || [])
      }
      db.updateLecture(id, updatePayload)
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
