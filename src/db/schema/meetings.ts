import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { members } from './members';

export const meetings = sqliteTable('meetings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  type: text('type', { enum: ['general', 'board', 'committee', 'workshop', 'emergency'] }).default('general'),
  date: text('date').notNull(),
  startTime: text('start_time'),
  endTime: text('end_time'),
  location: text('location'),
  minutes: text('minutes'),
  agenda: text('agenda'), // JSON
  attachments: text('attachments'), // JSON
  status: text('status', { enum: ['scheduled', 'completed', 'cancelled'] }).default('scheduled'),
  nextMeetingDate: text('next_meeting_date'),
  nextMeetingTime: text('next_meeting_time'),
  nextMeetingLocation: text('next_meeting_location'),
  nextMeetingAgenda: text('next_meeting_agenda'), // JSON
  chairperson: text('chairperson'),
  minuteTaker: text('minute_taker'),
  createdBy: text('created_by'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const meetingParticipants = sqliteTable('meeting_participants', {
  meetingId: integer('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  memberId: integer('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['present', 'absent', 'excused'] }).default('present'),
}, (t) => ({
  pk: primaryKey({ columns: [t.meetingId, t.memberId] }),
}));

export const attendance = sqliteTable('attendance', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  meetingId: integer('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  memberId: integer('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('present'),
});
