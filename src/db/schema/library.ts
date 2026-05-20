import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const libraryBooks = sqliteTable('library_books', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  broj: integer('broj'),
  autor: text('autor'),
  naslov: text('naslov').notNull(),
  podnaslov: text('podnaslov'),
  izdavac: text('izdavac'),
  mjesto: text('mjesto'),
  godina: text('godina'),
  isbn: text('isbn'),
  uvez: text('uvez'),
  stranice: integer('stranice'),
  jezik: text('jezik').default('Hrvatski'),
  signatura: text('signatura'),
  polica: text('polica'),
  napomena: text('napomena'),
  attachments: text('attachments'), // JSON
  loanMemberId: integer('loan_member_id'),
  loanMemberName: text('loan_member_name'),
  loanDate: text('loan_date'),
  loanReturnDate: text('loan_return_date'),
  loanNotes: text('loan_notes'),
  rightsContacted: integer('rights_contacted').default(0),
  rightsContactDate: text('rights_contact_date'),
  rightsResponded: integer('rights_responded').default(0),
  rightsResponseDate: text('rights_response_date'),
  rightsConsent: integer('rights_consent').default(0),
  rightsAttachment: text('rights_attachment'),
  isScanned: integer('is_scanned').default(0),
  isDigitized: integer('is_digitized').default(0),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const libraryJournals = sqliteTable('library_journals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  broj: integer('broj'),
  naslov: text('naslov').notNull(),
  svesci: text('svesci'),
  podrucje: text('podrucje'),
  izdavac: text('izdavac'),
  issn: text('issn'),
  napomena: text('napomena'),
  attachments: text('attachments'), // JSON
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});
