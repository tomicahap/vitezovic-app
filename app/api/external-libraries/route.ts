import { NextRequest, NextResponse } from 'next/server'
import { ExternalLibrariesDB } from '@/lib/database'
import { TrashService, extractActor } from '@/lib/trash'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      const lib = ExternalLibrariesDB.getById(parseInt(id))
      if (!lib) return NextResponse.json({ error: 'Nije pronađeno.' }, { status: 404 })
      const logs = ExternalLibrariesDB.getContactLogs(parseInt(id))
      return NextResponse.json({ ...lib, logs })
    }

    const libraries = ExternalLibrariesDB.getAll()
    return NextResponse.json({ libraries })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, id, ...data } = body

    if (action === 'add') {
      const newId = ExternalLibrariesDB.insert(data)
      return NextResponse.json({ success: true, id: newId })
    }
    if (action === 'update') {
      ExternalLibrariesDB.update(id, data)
      return NextResponse.json({ success: true })
    }
    if (action === 'delete') {
      const actor = extractActor(request, body)
      TrashService.trashExternalLibrary(Number(id), actor)
      return NextResponse.json({ success: true })
    }
    if (action === 'addLog') {
        const logId = ExternalLibrariesDB.insertContactLog({ ...data, library_id: id })
        return NextResponse.json({ success: true, id: logId })
    }
    if (action === 'deleteLog') {
        const actor = extractActor(request, body)
        TrashService.trashLibraryContactLog(Number(data.logId), actor)
        return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Nepoznata akcija.' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
