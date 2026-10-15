import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';

// Load DATABASE_PATH from process.env if available, otherwise fallback to local path
const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db');

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

// Ensure schema columns exist on startup safely
try {
  const tableInfo = sqlite.pragma('table_info(members)') as any[];
  if (Array.isArray(tableInfo) && tableInfo.length > 0) {
    const hasCol = tableInfo.some((c: any) => c.name === 'invitation_sent_at');
    if (!hasCol) {
      sqlite.prepare('ALTER TABLE members ADD COLUMN invitation_sent_at TEXT').run();
      console.log('Automatski dodana kolona invitation_sent_at u tablicu members.');
    }
  }
} catch (migrationErr) {
  console.warn('Napomena pri provjeri tablice members:', migrationErr);
}

export const db = drizzle(sqlite, { schema });

import { startBackupScheduler } from '@/lib/backup-scheduler';
startBackupScheduler();

