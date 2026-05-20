import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const data = {
      members: DatabaseService.getAllMembers(),
      meetings: (DatabaseService as any).getAllMeetings ? (DatabaseService as any).getAllMeetings() : [],
      settings: DatabaseService.getSettings(),
      library_books: (DatabaseService as any).LibraryDB?.getAllBooks() || [],
      library_journals: (DatabaseService as any).LibraryDB?.getAllJournals() || [],
      projects: (DatabaseService as any).ProjectsDB?.getAll() || [],
      contacts: (DatabaseService as any).ContactsDB?.getAll() || [],
      links: (DatabaseService as any).LinksDB?.getAll() || [],
      lectures: (DatabaseService as any).getAllLectures ? (DatabaseService as any).getAllLectures() : [],
      activity_logs: DatabaseService.getLogs(5000), // Max 5000 logs
    }

    const json = JSON.stringify(data, null, 2)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    
    return new Response(json, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="vitezovic-backup-${timestamp}.json"`,
      },
    })
  } catch (error: any) {
    console.error('Backup error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
