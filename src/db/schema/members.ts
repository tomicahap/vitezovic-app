import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const members = sqliteTable('members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  initials: text('initials').notNull(),
  phone: text('phone'),
  birthDate: text('birthDate'),
  address: text('address'),
  membershipNumber: text('membershipNumber'),
  registryNumber: text('registryNumber'),
  status: text('status').notNull().default('active'),
  paymentStatus: text('paymentStatus').notNull().default('paid'),
  joinDate: text('joinDate').notNull(),
  researchAreas: text('researchAreas'), // Legacy camelCase
  additionalAreas: integer('additionalAreas').default(0),
  functions: text('functions'), // JSON string array
  note: text('note'),
  avatar: text('avatar').notNull().default('/placeholder.svg'),
  role: text('role').default('member'),
  payments: text('payments'), // JSON string
  
  // Legacy/UI mapping fields
  honorary: integer('honorary').default(0),
  exemptFromPayment: integer('exemptFromPayment').default(0),
  expelled: integer('expelled').default(0),
  expulsionDate: text('expulsionDate'),
  expulsionReason: text('expulsionReason'),
  deceased: integer('deceased').default(0),
  deathDate: text('deathDate'),
  lastPayment: text('lastPayment'),
  expiry: text('expiry'),
  allPayments: text('allPayments'),
  notes: text('notes'),
  accessRights: text('accessRights'),

  invitationSent: integer('invitationSent').default(0),
  password: text('password'),
  personalNotes: text('personal_notes').default(''),
  personalTodos: text('personal_todos').default('[]'),
  statusClana: text('status_clana').default('AKTIVAN'),
  datumZadnjeUplate: text('datum_zadnje_uplate'),

  // Snake case aliases that exist in DB
  research_areas: text('research_areas').default('[]'),
  exempt_from_payment: text('exempt_from_payment'),
  expulsion_date: text('expulsion_date'),
  expulsion_reason: text('expulsion_reason'),
  death_date: text('death_date'),
  access_rights: text('access_rights'),
  is_temp_password: integer('is_temp_password').default(0),
  last_payment_reminder_at: text('last_payment_reminder_at'),

  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});
