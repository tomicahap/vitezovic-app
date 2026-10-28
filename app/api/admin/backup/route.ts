import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService, LibraryDB, ProjectsDB, ContactsDB, LinksDB, VaultDB, ExternalLibrariesDB, ResearchInquiriesDB } from '@/lib/database'
import Database from 'better-sqlite3'

export async function GET(request: NextRequest) {
  try {
    const dbPath = DatabaseService.getDatabasePath()
    const rawDb = new Database(dbPath, { readonly: true })

    const safeAll = (table: string) => {
      try {
        return rawDb.prepare(`SELECT * FROM ${table}`).all()
      } catch {
        return []
      }
    }

    const data = {
      exportedAt: new Date().toISOString(),
      members: safeAll('members'),
      payments: safeAll('payments'),
      meetings: safeAll('meetings'),
      meeting_participants: safeAll('meeting_participants'),
      attendance: safeAll('attendance'),
      lectures: safeAll('lectures'),
      votes: safeAll('votes'),
      vote_results: safeAll('vote_results'),
      polls: safeAll('polls'),
      poll_votes: safeAll('poll_votes'),
      library_books: safeAll('library_books'),
      library_journals: safeAll('library_journals'),
      external_libraries: safeAll('external_libraries'),
      library_contact_logs: safeAll('library_contact_logs'),
      projects: safeAll('projects'),
      research_inquiries: safeAll('research_inquiries'),
      contacts: safeAll('contacts'),
      useful_links: safeAll('useful_links'),
      vault: safeAll('vault'),
      google_drive_assets: safeAll('google_drive_assets'),
      settings: DatabaseService.getSettings(),
      activity_logs: DatabaseService.getLogs(10000),
    }

    rawDb.close()

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
