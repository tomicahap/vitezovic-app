import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';

// Load DATABASE_PATH from process.env if available, otherwise fallback to local path
const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db');

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });

import { startBackupScheduler } from '@/lib/backup-scheduler';
startBackupScheduler();

