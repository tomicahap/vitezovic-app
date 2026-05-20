import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').default('active'),
  priority: text('priority').default('medium'),
  progress: integer('progress').default(0),
  startDate: text('start_date'),
  endDate: text('end_date'),
  leadMemberId: integer('lead_member_id'),
  leadMemberName: text('lead_member_name'),
  memberIds: text('member_ids'), // JSON
  goals: text('goals'),           // JSON
  attachments: text('attachments'), // JSON
  records: text('records'),       // JSON
  contributors: text('contributors'), // JSON
  contributorTemplateId: text('contributor_template_id'),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});
