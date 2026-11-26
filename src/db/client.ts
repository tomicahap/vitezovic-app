import 'server-only';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';
import { getAppDbPath } from '@/lib/db-path';

// Load DATABASE_PATH from process.env if available, otherwise fallback to local path
const dbPath = getAppDbPath();
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const DRIZZLE_SCHEMA_VERSION = 29

const globalForDrizzle = globalThis as unknown as {
  __hrdDrizzleSqlite?: Database.Database
  __hrdDrizzleSchemaChecked?: boolean
}

const sqlite = globalForDrizzle.__hrdDrizzleSqlite ?? new Database(dbPath);
globalForDrizzle.__hrdDrizzleSqlite = sqlite;

try { sqlite.pragma('journal_mode = WAL'); } catch {}
try { sqlite.pragma('busy_timeout = 5000'); } catch {}
try { sqlite.pragma('synchronous = NORMAL'); } catch {}
try { sqlite.pragma('temp_store = MEMORY'); } catch {}
try { sqlite.pragma('cache_size = -16000'); } catch {}

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

// Ensure schema columns exist on startup safely (skipped once DB reaches DRIZZLE_SCHEMA_VERSION)
try {
  const currentVersion = Number(sqlite.pragma('user_version', { simple: true }) || 0);
  if (!globalForDrizzle.__hrdDrizzleSchemaChecked && currentVersion < DRIZZLE_SCHEMA_VERSION) {
  // Members
  ensureColumn('members', 'invitation_sent_at', 'TEXT');
  ensureColumn('members', 'invitation_token', 'TEXT');
  ensureColumn('members', 'invitation_token_expires_at', 'TEXT');
  ensureColumn('members', 'last_payment_reminder_at', 'TEXT');
  ensureColumn('members', 'last_birthday_email_at', 'TEXT');
  ensureColumn('members', 'last_missing_data_email_at', 'TEXT');
  ensureColumn('members', 'data_form_token', 'TEXT');
  ensureColumn('members', 'data_form_viewed_at', 'TEXT');
  ensureColumn('members', 'data_form_submitted_at', 'TEXT');
  ensureColumn('members', 'data_form_updated_fields', 'TEXT');
  ensureColumn('members', 'data_form_single_use', 'INTEGER DEFAULT 0');
  ensureColumn('members', 'data_form_session_nonce', 'TEXT');
  try {
    sqlite.exec(`
      UPDATE members
      SET data_form_token = NULL,
          data_form_session_nonce = NULL,
          data_form_single_use = 0
      WHERE data_form_submitted_at IS NOT NULL
        AND TRIM(data_form_submitted_at) != ''
        AND (data_form_token IS NOT NULL OR data_form_session_nonce IS NOT NULL OR COALESCE(data_form_single_use, 0) != 0)
    `);
  } catch {}
  ensureColumn('members', 'maiden_name', 'TEXT');
  ensureColumn('members', 'oib', 'TEXT');
  ensureColumn('members', 'birth_place', 'TEXT');
  ensureColumn('members', 'birth_country', 'TEXT');
  ensureColumn('members', 'landline_phone', 'TEXT');
  ensureColumn('members', 'occupation', 'TEXT');
  ensureColumn('members', 'work_experience', 'TEXT');
  ensureColumn('members', 'hobbies_skills', 'TEXT');
  ensureColumn('members', 'foreign_languages', 'TEXT');
  ensureColumn('members', 'do_not_contact', 'INTEGER DEFAULT 0');
  ensureColumn('members', 'do_not_contact_date', 'TEXT');
  ensureColumn('members', 'do_not_contact_note', 'TEXT');
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
  ensureColumn('meetings', 'external_attendees', 'TEXT DEFAULT "[]"');
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
  ensureColumn('lectures', 'external_attendees', 'TEXT DEFAULT "[]"');
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
  ensureColumn('research_inquiries', 'requester_email', 'TEXT');
  ensureColumn('research_inquiries', 'email_logs', 'TEXT');
  ensureColumn('research_inquiries', 'gmail_message_id', 'TEXT');
  ensureColumn('research_inquiries', 'gmail_thread_id', 'TEXT');

  // Settings
  ensureColumn('settings', 'adminName', 'TEXT');
  ensureColumn('settings', 'adminPassword', 'TEXT');
  ensureColumn('settings', 'adminPersonalNotes', 'TEXT DEFAULT ""');
  ensureColumn('settings', 'adminPersonalTodos', 'TEXT DEFAULT "[]"');
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
  ensureColumn('settings', 'requirePaymentToBeActive', 'INTEGER DEFAULT 0');
  ensureColumn('settings', 'maintenanceMode', 'INTEGER DEFAULT 0');
  ensureColumn('settings', 'adminInactivityEnabled', 'INTEGER DEFAULT 0');
  ensureColumn('settings', 'adminInactivityDays', 'INTEGER DEFAULT 30');
  ensureColumn('settings', 'lastAdminLoginAt', 'TEXT');
  ensureColumn('settings', 'adminInactivityAlertSentAt', 'TEXT');

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

  // Trajno ukloni Administratora iz tablice članova (uz prijenos lozinke i bilješki u settings ako postoje)
  try {
    const adminRows = sqlite.prepare(`
      SELECT id, name, email, password, personal_notes, personal_todos
      FROM members
      WHERE LOWER(TRIM(COALESCE(role, ''))) = 'admin'
         OR LOWER(TRIM(COALESCE(email, ''))) = 'admin'
         OR LOWER(TRIM(COALESCE(name, ''))) IN ('administrator', 'rezervni administrator')
    `).all() as any[];

    if (adminRows && adminRows.length > 0) {
      const currentSettings = sqlite.prepare('SELECT adminPassword, adminPersonalNotes, adminPersonalTodos FROM settings WHERE id = 1').get() as any;
      for (const row of adminRows) {
        if (row.password && (!currentSettings?.adminPassword || currentSettings.adminPassword === 'admin')) {
          sqlite.prepare('UPDATE settings SET adminPassword = ? WHERE id = 1').run(row.password);
        }
        if (row.personal_notes && !currentSettings?.adminPersonalNotes) {
          sqlite.prepare('UPDATE settings SET adminPersonalNotes = ? WHERE id = 1').run(row.personal_notes);
        }
        if (row.personal_todos && (!currentSettings?.adminPersonalTodos || currentSettings.adminPersonalTodos === '[]')) {
          sqlite.prepare('UPDATE settings SET adminPersonalTodos = ? WHERE id = 1').run(row.personal_todos);
        }
      }
      sqlite.prepare(`
        DELETE FROM members
        WHERE LOWER(TRIM(COALESCE(role, ''))) = 'admin'
           OR LOWER(TRIM(COALESCE(email, ''))) = 'admin'
           OR LOWER(TRIM(COALESCE(name, ''))) IN ('administrator', 'rezervni administrator')
      `).run();
      console.log(`[DB Cleanup] Trajno uklonjeno ${adminRows.length} administratorskih zapisa iz tablice članova.`);
    }
  } catch (cleanupErr) {
    console.warn('Upozorenje pri čišćenju administratora iz tablice članova:', cleanupErr);
  }
  // Trash items (Smeće)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS trash_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_table TEXT NOT NULL,
      original_id TEXT NOT NULL,
      parent_id TEXT,
      title TEXT NOT NULL,
      subtitle TEXT,
      data_json TEXT NOT NULL,
      related_json TEXT,
      deleted_by_id TEXT,
      deleted_by_name TEXT NOT NULL,
      deleted_by_role TEXT,
      deleted_by_email TEXT,
      deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'trashed',
      restored_at DATETIME,
      restored_by_id TEXT,
      restored_by_name TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_trash_items_status ON trash_items(status);
    CREATE INDEX IF NOT EXISTS idx_trash_items_entity_type ON trash_items(entity_type);
    CREATE INDEX IF NOT EXISTS idx_trash_items_deleted_at ON trash_items(deleted_at);

    CREATE TABLE IF NOT EXISTS board_announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      sender_id TEXT,
      sender_name TEXT NOT NULL,
      sender_role TEXT,
      sender_email TEXT,
      recipients_json TEXT NOT NULL DEFAULT '[]',
      attachments TEXT NOT NULL DEFAULT '[]',
      sent_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      total_recipients INTEGER NOT NULL DEFAULT 0,
      synced_board_notice INTEGER NOT NULL DEFAULT 0,
      sent_at TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_board_announcements_sent_at ON board_announcements(sent_at DESC);

    CREATE TABLE IF NOT EXISTS archive_member_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER UNIQUE NOT NULL,
      contacted INTEGER NOT NULL DEFAULT 0,
      contacted_at TEXT DEFAULT '',
      contact_result TEXT DEFAULT '',
      note TEXT DEFAULT '',
      updated_by_id TEXT DEFAULT '',
      updated_by_name TEXT DEFAULT '',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_archive_member_contacts_member_id ON archive_member_contacts(member_id);
    CREATE INDEX IF NOT EXISTS idx_archive_member_contacts_contacted ON archive_member_contacts(contacted);

    CREATE TABLE IF NOT EXISTS inquiry_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inquiry_id INTEGER NOT NULL UNIQUE,
      token TEXT,
      sent_at TEXT,
      sent_by_id TEXT,
      sent_by_name TEXT,
      recipient_name TEXT,
      recipient_email TEXT,
      opened_at TEXT,
      submitted_at TEXT,
      rating_overall INTEGER,
      rating_clarity INTEGER,
      rating_communication INTEGER,
      rating_timeliness INTEGER,
      rating_recommendation INTEGER,
      average_rating REAL,
      financial_support TEXT,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inquiry_id) REFERENCES research_inquiries (id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_inquiry_feedback_inquiry_id ON inquiry_feedback(inquiry_id);
    CREATE INDEX IF NOT EXISTS idx_inquiry_feedback_token ON inquiry_feedback(token);
    CREATE INDEX IF NOT EXISTS idx_inquiry_feedback_submitted_at ON inquiry_feedback(submitted_at DESC);

    CREATE TABLE IF NOT EXISTS external_users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT DEFAULT '',
      organization TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      password TEXT NOT NULL,
      is_temp_password INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      access_rights TEXT DEFAULT '{}',
      invitation_sent INTEGER DEFAULT 0,
      invitation_sent_at TEXT,
      invitation_token TEXT,
      invitation_token_expires_at TEXT,
      last_login_at TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_external_users_email ON external_users(email);
    CREATE INDEX IF NOT EXISTS idx_external_users_invitation_token ON external_users(invitation_token);
  `);
    ensureColumn('board_announcements', 'attachments', "TEXT NOT NULL DEFAULT '[]'");
    const hasCoreTables = (sqlite.pragma('table_info(members)') as any[]).length > 0;
    if (hasCoreTables && currentVersion >= 19) {
      try { sqlite.pragma(`user_version = ${DRIZZLE_SCHEMA_VERSION}`); } catch {}
    }
  }
  globalForDrizzle.__hrdDrizzleSchemaChecked = true;
} catch (migrationErr) {
  console.warn('Napomena pri provjeri tablica:', migrationErr);
}

export const db = drizzle(sqlite, { schema });

import { startBackupScheduler } from '@/lib/backup-scheduler';
startBackupScheduler();
