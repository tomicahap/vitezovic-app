import { sqliteTable, text, integer, real, primaryKey, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { meetings } from './meetings';
import { members } from './members';

export const activityLogs = sqliteTable('activity_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull(),
  userName: text('userName').notNull(),
  userRole: text('userRole').notNull(),
  action: text('action').notNull(),
  details: text('details'),
  userAgent: text('userAgent'),
  timestamp: text('timestamp').default(sql`CURRENT_TIMESTAMP`),
});

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey().default(1),
  logoUrl: text('logoUrl'),
  overdueAfterDays: integer('overdueAfterDays').default(365),
  expiredAfterDays: integer('inactiveAfterDays').default(730),
  availableFunctions: text('availableFunctions'), // JSON
  googleDriveUrl: text('googleDriveUrl'),
  googleServiceAccountJson: text('googleServiceAccountJson'),
  googleDriveFolderId: text('googleDriveFolderId'),
  googleDriveBackupFolderId: text('googleDriveBackupFolderId'),
  googleClientId: text('googleClientId'),
  googleClientSecret: text('googleClientSecret'),
  googleRefreshToken: text('googleRefreshToken'),
  autoBackupIntervalDays: integer('autoBackupIntervalDays').default(0),
  lastBackupTime: text('lastBackupTime').default(''),
  meetingTypes: text('meetingTypes'), // JSON
  meetingLocations: text('meetingLocations'), // JSON
  gmailMailbox: text('gmailMailbox'),
  adminBackupEmail: text('adminBackupEmail'),
  adminBackupPassword: text('adminBackupPassword'),
  vaultNotes: text('vaultNotes'),
  smtpHost: text('smtpHost'),
  smtpPort: integer('smtpPort'),
  smtpUser: text('smtpUser'),
  smtpPass: text('smtpPass'),
  smtpSecure: integer('smtpSecure').default(1),
  smtpFrom: text('smtpFrom'),
  paymentEmailSubject: text('paymentEmailSubject').default('Obavijest o članarini'),
  paymentEmailBody: text('paymentEmailBody'),
  paymentSlipUrl: text('paymentSlipUrl'),
  paymentQrUrl: text('paymentQrUrl'),
  paymentEmailSignature: text('paymentEmailSignature'),
  projectContributorTemplates: text('projectContributorTemplates'), // JSON
});

export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  memberId: integer('memberId').notNull().references(() => members.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  amount: real('amount').notNull(),
  note: text('note'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const vault = sqliteTable('vault', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  username: text('username'),
  password: text('password'),
  url: text('url'),
  category: text('category'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const votes = sqliteTable('votes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  meetingId: integer('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  options: text('options').notNull(), // JSON
  status: text('status').default('open'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const voteResults = sqliteTable('vote_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  voteId: integer('vote_id').notNull().references(() => votes.id, { onDelete: 'cascade' }),
  memberId: integer('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  option: text('option').notNull(),
  timestamp: text('timestamp').default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  unq: unique().on(t.voteId, t.memberId),
}));

export const contacts = sqliteTable('contacts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  address: text('address'),
  email: text('email'),
  phone: text('phone'),
  workplace: text('workplace'),
  category: text('category'),
  notes: text('notes'),
  website: text('website'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const usefulLinks = sqliteTable('useful_links', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  url: text('url').notNull(),
  description: text('description'),
  category: text('category').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const lectures = sqliteTable('lectures', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  type: text('type').default('lecture'),
  date: text('date').notNull(),
  startTime: text('start_time'),
  endTime: text('end_time'),
  location: text('location'),
  description: text('description'),
  host: text('host'),
  hosts: text('hosts'), // JSON: Array<{ name: string, memberId?: number }>
  attendeeIds: text('attendee_ids'), // JSON
  attachments: text('attachments'),   // JSON
  status: text('status').default('scheduled'),
  createdBy: text('created_by'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});
