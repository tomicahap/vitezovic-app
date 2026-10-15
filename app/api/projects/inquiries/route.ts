import { NextRequest, NextResponse } from 'next/server'
import { ResearchInquiriesDB } from '@/lib/database'

function parseInquiry(row: any) {
  if (!row) return row
  let attachments = []
  if (row.attachments) {
    try {
      attachments = typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments
    } catch (e) {
      attachments = []
    }
  }
  return {
    ...row,
    attachments: Array.isArray(attachments) ? attachments : [],
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const status = searchParams.get('status') || 'all'

    if (id) {
      const item = ResearchInquiriesDB.get(parseInt(id, 10))
      if (!item) {
        return NextResponse.json({ error: 'Upit nije pronađen.' }, { status: 404 })
      }
      return NextResponse.json(parseInquiry(item))
    }

    const items = ResearchInquiriesDB.getAll(status).map(parseInquiry)
    return NextResponse.json({ inquiries: items })
  } catch (e: any) {
    console.error('Error in GET /api/projects/inquiries:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, id, ...data } = body

    const serialize = (d: any) => {
      const copy = { ...d }
      if (copy.attachments && typeof copy.attachments !== 'string') {
        copy.attachments = JSON.stringify(copy.attachments)
      }
      return copy
    }

    if (action === 'add') {
      const newId = ResearchInquiriesDB.insert(serialize(data))
      const created = ResearchInquiriesDB.get(newId)
      return NextResponse.json({ success: true, inquiry: parseInquiry(created) })
    }

    if (action === 'update') {
      if (!id) {
        return NextResponse.json({ error: 'Nedostaje ID upita.' }, { status: 400 })
      }
      ResearchInquiriesDB.update(id, serialize(data))
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      if (!id) {
        return NextResponse.json({ error: 'Nedostaje ID upita.' }, { status: 400 })
      }
      ResearchInquiriesDB.delete(id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Nepoznata akcija.' }, { status: 400 })
  } catch (e: any) {
    console.error('Error in POST /api/projects/inquiries:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
