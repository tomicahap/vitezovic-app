import { NextRequest, NextResponse } from 'next/server'
import { ProjectsDB } from '../../../lib/database'

function parse(p: any) {
  return {
    ...p,
    member_ids: JSON.parse(p.member_ids || '[]'),
    goals: JSON.parse(p.goals || '[]'),
    attachments: JSON.parse(p.attachments || '[]'),
    records: JSON.parse(p.records || '[]'),
    contributors: JSON.parse(p.contributors || '[]'),
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (id) {
      const p = ProjectsDB.get(parseInt(id))
      if (!p) return NextResponse.json({ error: 'Nije pronađeno.' }, { status: 404 })
      return NextResponse.json(parse(p))
    }
    return NextResponse.json({ projects: ProjectsDB.getAll().map(parse) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, id, ...data } = body

    const toDb = (d: any) => ({
      ...d,
      member_ids: JSON.stringify(d.member_ids ?? []),
      goals: JSON.stringify(d.goals ?? []),
      attachments: JSON.stringify(d.attachments ?? []),
      records: JSON.stringify(d.records ?? []),
      contributors: JSON.stringify(d.contributors ?? []),
    })

    if (action === 'add') {
      const newId = ProjectsDB.insert(toDb(data))
      return NextResponse.json({ success: true, project: parse(ProjectsDB.get(newId)!) })
    }
    if (action === 'update') { ProjectsDB.update(id, toDb(data)); return NextResponse.json({ success: true }) }
    if (action === 'delete') { ProjectsDB.delete(id); return NextResponse.json({ success: true }) }
    return NextResponse.json({ error: 'Nepoznata akcija.' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
