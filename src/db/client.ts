import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

// Load DATABASE_PATH from process.env if available, otherwise fallback to local path
const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

function ensureColumn(table: string, col: string, def: string) {
  try {
    const info = sqlite.pragma(`table_info(${table})`) as any[];
    if (Array.isArray(info) && info.length > 0 && !info.some((c: any) => c.name === col)) {
      sqlite.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`).run();
      console.log(`[DB Migration] Dodana kolona ${col} u tablicu ${table}.`);
    }
  } catch (err) {
    // Ignore if table doesn't exist yet or column already exists
  }
}

// Ensure schema columns exist on startup safely
try {
  // Members
  ensureColumn('members', 'invitation_sent_at', 'TEXT');
  ensureColumn('members', 'last_payment_reminder_at', 'TEXT');
  ensureColumn('members', 'last_login_at', 'TEXT');
  ensureColumn('members', 'previous_login_at', 'TEXT');
  ensureColumn('members', 'last_summary_acknowledged_at', 'TEXT');
  ensureColumn('members', 'is_temp_password', 'INTEGER DEFAULT 0');
  ensureColumn('members', 'access_rights', 'TEXT');
  ensureColumn('members', 'personal_notes', 'TEXT DEFAULT ""');
  ensureColumn('members', 'personal_todos', 'TEXT DEFAULT "[]"');
  ensureColumn('members', 'status_clana', 'TEXT DEFAULT "AKTIVAN"');
  ensureColumn('members', 'datum_zadnje_uplate', 'TEXT');
  ensureColumn('members', 'research_areas', 'TEXT DEFAULT "[]"');
  ensureColumn('members', 'exempt_from_payment', 'TEXT');
  ensureColumn('members', 'expulsion_date', 'TEXT');
  ensureColumn('members', 'expulsion_reason', 'TEXT');
  ensureColumn('members', 'death_date', 'TEXT');

  // Meetings
  ensureColumn('meetings', 'attendee_ids', 'TEXT');
  ensureColumn('meetings', 'agenda', 'TEXT');
  ensureColumn('meetings', 'attachments', 'TEXT');
  ensureColumn('meetings', 'status', 'TEXT DEFAULT "scheduled"');
  ensureColumn('meetings', 'next_meeting_date', 'TEXT');
  ensureColumn('meetings', 'next_meeting_time', 'TEXT');
  ensureColumn('meetings', 'next_meeting_location', 'TEXT');
  ensureColumn('meetings', 'next_meeting_agenda', 'TEXT');
  ensureColumn('meetings', 'chairperson', 'TEXT');
  ensureColumn('meetings', 'minute_taker', 'TEXT');
  ensureColumn('meetings', 'youtube_url', 'TEXT');
  ensureColumn('meetings', 'notification_sent_at', 'TEXT');
  ensureColumn('meetings', 'notification_recipients', 'TEXT');
  ensureColumn('meetings', 'created_by', 'TEXT');

  // Lectures
  ensureColumn('lectures', 'youtube_url', 'TEXT');
  ensureColumn('lectures', 'hosts', 'TEXT');
  ensureColumn('lectures', 'notification_sent_at', 'TEXT');
  ensureColumn('lectures', 'notification_recipients', 'TEXT');
  ensureColumn('lectures', 'attendee_ids', 'TEXT');
  ensureColumn('lectures', 'attachments', 'TEXT');
  ensureColumn('lectures', 'status', 'TEXT DEFAULT "scheduled"');
  ensureColumn('lectures', 'created_by', 'TEXT');

  // Votes
  ensureColumn('votes', 'updated_at', 'DATETIME');
  ensureColumn('votes', 'target_member_ids', 'TEXT');
  ensureColumn('votes', 'created_by', 'TEXT');

  // Library Books
  ensureColumn('library_books', 'attachments', 'TEXT');
  ensureColumn('library_books', 'is_scanned', 'INTEGER DEFAULT 0');
  ensureColumn('library_books', 'is_digitized', 'INTEGER DEFAULT 0');
  ensureColumn('library_books', 'rights_contacted', 'INTEGER DEFAULT 0');
  ensureColumn('library_books', 'rights_contact_date', 'TEXT');
  ensureColumn('library_books', 'rights_responded', 'INTEGER DEFAULT 0');
  ensureColumn('library_books', 'rights_response_date', 'TEXT');
  ensureColumn('library_books', 'rights_consent', 'INTEGER DEFAULT 0');
  ensureColumn('library_books', 'rights_attachment', 'TEXT');

  // Projects
  ensureColumn('projects', 'contributors', 'TEXT');
  ensureColumn('projects', 'contributor_template_id', 'TEXT');

  // Research Inquiries
  ensureColumn('research_inquiries', 'project_id', 'TEXT');
  ensureColumn('research_inquiries', 'project_name', 'TEXT');

  // Settings
  ensureColumn('settings', 'boardNotice', 'TEXT DEFAULT ""');
  ensureColumn('settings', 'boardNoticeAuthor', 'TEXT DEFAULT ""');
  ensureColumn('settings', 'boardNoticeDate', 'TEXT DEFAULT ""');
  ensureColumn('settings', 'invitationEmailSubject', 'TEXT');
  ensureColumn('settings', 'invitationEmailBody', 'TEXT');
  ensureColumn('settings', 'pollEmailSubject', 'TEXT');
  ensureColumn('settings', 'pollEmailBody', 'TEXT');
  ensureColumn('settings', 'meetingNotificationSubject', 'TEXT');
  ensureColumn('settings', 'meetingNotificationBody', 'TEXT');
  ensureColumn('settings', 'meetingSummarySubject', 'TEXT');
  ensureColumn('settings', 'meetingSummaryBody', 'TEXT');
  ensureColumn('settings', 'lectureNotificationSubject', 'TEXT');
  ensureColumn('settings', 'lectureNotificationBody', 'TEXT');
  ensureColumn('settings', 'lectureSummarySubject', 'TEXT');
  ensureColumn('settings', 'lectureSummaryBody', 'TEXT');
  ensureColumn('settings', 'paymentEmailSubject', 'TEXT DEFAULT "Obavijest o članarini"');
  ensureColumn('settings', 'paymentEmailBody', 'TEXT');
  ensureColumn('settings', 'paymentSlipUrl', 'TEXT');
  ensureColumn('settings', 'paymentQrUrl', 'TEXT');
  ensureColumn('settings', 'paymentEmailSignature', 'TEXT');
  ensureColumn('settings', 'projectContributorTemplates', 'TEXT');

  // Automatski ispravi eventualno dvostruko kodirane funkcije
  try {
    const doubleEncoded = sqlite.prepare("SELECT id, functions FROM members WHERE functions LIKE '\"[%'").all() as any[];
    if (doubleEncoded && doubleEncoded.length > 0) {
      const fixStmt = sqlite.prepare('UPDATE members SET functions = ? WHERE id = ?');
      for (const row of doubleEncoded) {
        try {
          const parsed = JSON.parse(row.functions);
          if (typeof parsed === 'string') {
            const inner = JSON.parse(parsed);
            fixStmt.run(JSON.stringify(inner), row.id);
          }
        } catch {}
      }
      console.log(`Automatski ispravljeno ${doubleEncoded.length} članova s dvostruko kodiranim funkcijama.`);
    }
  } catch {}
} catch (migrationErr) {
  console.warn('Napomena pri provjeri tablica:', migrationErr);
}

export const db = drizzle(sqlite, { schema });

import { startBackupScheduler } from '@/lib/backup-scheduler';
startBackupScheduler();
