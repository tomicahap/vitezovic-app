import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'
import { getMailcrawlDbPath, getCompanyScraperDbPath } from '@/lib/db-path'
import { CHANGELOG_DATA } from '@/lib/changelog-data'
import { extractActor } from '@/lib/trash'
import Database from 'better-sqlite3'
import fs from 'fs'

export async function GET(request: NextRequest) {
  const actor = extractActor(request)
  if ((actor.role || '').trim().toLowerCase() !== 'admin') {
    return NextResponse.json(
      { error: 'Pristup odbijen. Izvoz sigurnosne kopije dopušten je isključivo administratoru.' },
      { status: 403 }
    )
  }
  try {
    const dbPath = DatabaseService.getDatabasePath()
    const rawDb = new Database(dbPath, { readonly: true })

    const safeAll = (table: string, dbInstance = rawDb) => {
      try {
        return dbInstance.prepare(`SELECT * FROM ${table}`).all()
      } catch {
        return []
      }
    }

    // Podaci iz sporednih baza ako postoje
    let donationsData: any = {}
    const mcPath = process.env.MAILCRAWL_DATABASE_PATH || getMailcrawlDbPath()
    if (fs.existsSync(mcPath)) {
      try {
        const mcDb = new Database(mcPath, { readonly: true })
        donationsData = {
          leads: safeAll('leads', mcDb),
          sent_registry: safeAll('sent_registry', mcDb),
          search_query_history: safeAll('search_query_history', mcDb),
          opt_out_registry: safeAll('opt_out_registry', mcDb),
          settings: safeAll('settings', mcDb)
        }
        mcDb.close()
      } catch (e) {
        console.warn('Mailcrawl export warning:', e)
      }
    }

    let scraperData: any = {}
    const csPath = getCompanyScraperDbPath()
    if (fs.existsSync(csPath)) {
      try {
        const csDb = new Database(csPath, { readonly: true })
        scraperData = {
          raw: safeAll('company_scraper_raw', csDb),
          enriched: safeAll('company_scraper_enriched', csDb),
          checkpoints: safeAll('company_scraper_checkpoints', csDb)
        }
        csDb.close()
      } catch (e) {
        console.warn('Company scraper export warning:', e)
      }
    }

    const data = {
      exportedAt: new Date().toISOString(),
      appVersion: CHANGELOG_DATA[0]?.version || "v20.11.2026",
      appName: "Rodoslovac",
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
      inquiry_feedback: safeAll('inquiry_feedback'),
      contacts: safeAll('contacts'),
      useful_links: safeAll('useful_links'),
      vault: safeAll('vault'),
      google_drive_assets: safeAll('google_drive_assets'),
      mail_senders: safeAll('mail_senders'),
      mail_reads: safeAll('mail_reads'),
      user_login_tracking: safeAll('user_login_tracking'),
      trash_items: safeAll('trash_items'),
      board_announcements: safeAll('board_announcements'),
      archive_member_contacts: safeAll('archive_member_contacts'),
      settings: DatabaseService.getSettings(),
      activity_logs: DatabaseService.getLogs(10000),
      donations: donationsData,
      companyScraper: scraperData,
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
