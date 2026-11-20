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
  adminName: text('adminName'),
  adminPassword: text('adminPassword'),
  adminPersonalNotes: text('adminPersonalNotes'),
  adminPersonalTodos: text('adminPersonalTodos'),
  logoUrl: text('logoUrl'),
  overdueAfterDays: integer('overdueAfterDays').default(365),
  expiredAfterDays: integer('inactiveAfterDays').default(730),
  requirePaymentToBeActive: integer('requirePaymentToBeActive').default(0),
  maintenanceMode: integer('maintenanceMode').default(0),
  adminInactivityEnabled: integer('adminInactivityEnabled').default(0),
  adminInactivityDays: integer('adminInactivityDays').default(30),
  lastAdminLoginAt: text('lastAdminLoginAt'),
  adminInactivityAlertSentAt: text('adminInactivityAlertSentAt'),
  availableFunctions: text('availableFunctions'), // JSON
  googleDriveUrl: text('googleDriveUrl'),
  googleServiceAccountJson: text('googleServiceAccountJson'),
  googleDriveFolderId: text('googleDriveFolderId'),
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
  googleDriveOnlyDownload: integer('googleDriveOnlyDownload').default(0),
  dropboxAppKey: text('dropboxAppKey'),
  dropboxAppSecret: text('dropboxAppSecret'),
  dropboxRefreshToken: text('dropboxRefreshToken'),
  dropboxFolderPath: text('dropboxFolderPath'),
  lastBackupTimestamp: text('lastBackupTimestamp'),
  lastBackupStatus: text('lastBackupStatus'),
  backupIntervalDays: integer('backupIntervalDays').default(7),
  boardNotice: text('boardNotice'),
  boardNoticeAuthor: text('boardNoticeAuthor'),
  boardNoticeDate: text('boardNoticeDate'),
  invitationEmailSubject: text('invitationEmailSubject'),
  invitationEmailBody: text('invitationEmailBody'),
  pollEmailSubject: text('pollEmailSubject'),
  pollEmailBody: text('pollEmailBody'),
  meetingNotificationSubject: text('meetingNotificationSubject'),
  meetingNotificationBody: text('meetingNotificationBody'),
  meetingSummarySubject: text('meetingSummarySubject'),
  meetingSummaryBody: text('meetingSummaryBody'),
  lectureNotificationSubject: text('lectureNotificationSubject'),
  lectureNotificationBody: text('lectureNotificationBody'),
  lectureSummarySubject: text('lectureSummarySubject'),
  lectureSummaryBody: text('lectureSummaryBody'),
  birthdayEmailSubject: text('birthdayEmailSubject'),
  birthdayEmailBody: text('birthdayEmailBody'),
  missingDataEmailSubject: text('missingDataEmailSubject'),
  missingDataEmailBody: text('missingDataEmailBody'),
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
  meetingId: integer('meeting_id').references(() => meetings.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  options: text('options').notNull(), // JSON
  targetMemberIds: text('target_member_ids'), // JSON
  status: text('status').default('open'),
  createdBy: text('created_by'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at'),
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
  city: text('city'),
  location: text('location'),
  description: text('description'),
  host: text('host'),
  notificationSentAt: text('notification_sent_at'),
  notificationRecipients: text('notification_recipients'),
  hosts: text('hosts'), // JSON: Array<{ name: string, memberId?: number }>
  attendeeIds: text('attendee_ids'), // JSON
  attachments: text('attachments'),   // JSON
  status: text('status').default('scheduled'),
  youtubeUrl: text('youtube_url'),
  createdBy: text('created_by'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const boardAnnouncements = sqliteTable('board_announcements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  senderId: text('sender_id'),
  senderName: text('sender_name').notNull(),
  senderRole: text('sender_role'),
  senderEmail: text('sender_email'),
  recipientsJson: text('recipients_json').notNull().default('[]'),
  sentCount: integer('sent_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  totalRecipients: integer('total_recipients').notNull().default(0),
  syncedBoardNotice: integer('synced_board_notice').notNull().default(0),
  sentAt: text('sent_at').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const archiveMemberContacts = sqliteTable('archive_member_contacts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  memberId: integer('member_id').notNull().unique(),
  contacted: integer('contacted').notNull().default(0),
  contactedAt: text('contacted_at').default(''),
  contactResult: text('contact_result').default(''),
  note: text('note').default(''),
  updatedById: text('updated_by_id').default(''),
  updatedByName: text('updated_by_name').default(''),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});
