import { NextRequest, NextResponse } from 'next/server'
import { LibraryDB } from '@/lib/database'
import { TrashService, extractActor } from '@/lib/trash'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') ?? 'books' // 'books' | 'journals'
    const search = searchParams.get('search') ?? undefined
    const loaned = searchParams.get('loaned') === 'true'
    const id = searchParams.get('id')

    if (type === 'journals') {
      if (id) {
        const j = LibraryDB.getJournal(parseInt(id))
        if (!j) return NextResponse.json({ error: 'Nije pronađeno.' }, { status: 404 })
        return NextResponse.json(j)
      }
      const journals = LibraryDB.getAllJournals(search)
      return NextResponse.json({ journals })
    }

    if (id) {
      const book = LibraryDB.getBook(parseInt(id))
      if (!book) return NextResponse.json({ error: 'Nije pronađeno.' }, { status: 404 })
      return NextResponse.json(book)
    }
    const books = LibraryDB.getAllBooks(search, loaned)
    return NextResponse.json({ books })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, type, id, ...data } = body

    const actor = extractActor(request, body)

    if (type === 'journals') {
      if (action === 'add') {
        const jId = LibraryDB.insertJournal(data)
        return NextResponse.json({ success: true, journal: LibraryDB.getJournal(jId) })
      }
      if (action === 'update') {
        const oldJournal = LibraryDB.getJournal(Number(id))
        TrashService.checkAndTrashLibraryUpdates('journals', Number(id), oldJournal, data, actor)
        LibraryDB.updateJournal(id, data)
        return NextResponse.json({ success: true })
      }
      if (action === 'delete') {
        TrashService.trashLibraryJournal(Number(id), actor)
        return NextResponse.json({ success: true })
      }
    } else {
      if (action === 'add') {
        const bId = LibraryDB.insertBook(data)
        return NextResponse.json({ success: true, book: LibraryDB.getBook(bId) })
      }
      if (action === 'update') {
        const oldBook = LibraryDB.getBook(Number(id))
        TrashService.checkAndTrashLibraryUpdates('books', Number(id), oldBook, data, actor)
        LibraryDB.updateBook(id, data)
        return NextResponse.json({ success: true })
      }
      if (action === 'delete') {
        TrashService.trashLibraryBook(Number(id), actor)
        return NextResponse.json({ success: true })
      }
    }

    return NextResponse.json({ error: 'Nepoznata akcija.' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
