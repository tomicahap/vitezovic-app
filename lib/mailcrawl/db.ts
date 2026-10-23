import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import type { Lead, SentRegistryItem, CampaignSettings } from './types'

export function getMailcrawlDbPath(): string {
  if (process.env.MAILCRAWL_DATABASE_PATH) {
    return process.env.MAILCRAWL_DATABASE_PATH
  }
  if (process.env.DATABASE_PATH) {
    const mainDir = path.dirname(process.env.DATABASE_PATH)
    return path.join(mainDir, 'mailcrawl.db')
  }
  return path.join(process.cwd(), 'data', 'mailcrawl.db')
}

const dbPath = getMailcrawlDbPath()
const dbDir = path.dirname(dbPath)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

// Automatically migrate from legacy path if exists
const legacyPath = path.join(process.cwd(), 'data', 'mailcrawl.db')
if (dbPath !== legacyPath && fs.existsSync(legacyPath) && !fs.existsSync(dbPath)) {
  try {
    fs.copyFileSync(legacyPath, dbPath)
    console.log(`[Mailcrawl DB] Uspješno migrirana baza donacija u persistentni direktorij: ${dbPath}`)
  } catch (e: any) {
    console.warn(`[Mailcrawl DB] Upozorenje pri migraciji legacy baze:`, e.message)
  }
}

export const db = new Database(dbPath)

// Initialize schema
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    entity_type TEXT DEFAULT 'tvrtka',
    oib TEXT DEFAULT '',
    city TEXT DEFAULT '',
    address TEXT DEFAULT '',
    website TEXT DEFAULT '',
    domain_norm TEXT DEFAULT '',
    email TEXT DEFAULT '',
    email_norm TEXT DEFAULT '',
    all_emails TEXT DEFAULT '[]',
    phone TEXT DEFAULT '',
    contact_person TEXT DEFAULT '',
    contact_role TEXT DEFAULT '',
    activity_category TEXT DEFAULT '',
    activity_summary TEXT DEFAULT '',
    raw_scraped_text TEXT DEFAULT '',
    source TEXT DEFAULT '',
    source_url TEXT DEFAULT '',
    email_subject TEXT DEFAULT '',
    email_body TEXT DEFAULT '',
    ai_personalization_note TEXT DEFAULT '',
    status TEXT DEFAULT 'new',
    sent_at TEXT DEFAULT '',
    donated_at TEXT DEFAULT '',
    donated_amount TEXT DEFAULT '',
    donation_note TEXT DEFAULT '',
    error_message TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_leads_email_norm ON leads(email_norm);
  CREATE INDEX IF NOT EXISTS idx_leads_domain_norm ON leads(domain_norm);
  CREATE INDEX IF NOT EXISTS idx_leads_oib ON leads(oib);
  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

  CREATE TABLE IF NOT EXISTS sent_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_norm TEXT UNIQUE,
    domain_norm TEXT DEFAULT '',
    oib TEXT DEFAULT '',
    company_name TEXT DEFAULT '',
    subject TEXT DEFAULT '',
    body TEXT DEFAULT '',
    sent_at TEXT DEFAULT (datetime('now', 'localtime'))
  );
`)

// Safe column migrations for existing databases
try {
  const cols = db.pragma('table_info(leads)') as any[]
  if (Array.isArray(cols)) {
    const colNames = cols.map((c: any) => c.name)
    if (!colNames.includes('donated_at')) {
      db.prepare('ALTER TABLE leads ADD COLUMN donated_at TEXT DEFAULT ""').run()
    }
    if (!colNames.includes('donated_amount')) {
      db.prepare('ALTER TABLE leads ADD COLUMN donated_amount TEXT DEFAULT ""').run()
    }
    if (!colNames.includes('donation_note')) {
      db.prepare('ALTER TABLE leads ADD COLUMN donation_note TEXT DEFAULT ""').run()
    }
    if (!colNames.includes('send_count')) {
      db.prepare('ALTER TABLE leads ADD COLUMN send_count INTEGER DEFAULT 0').run()
    }
    if (!colNames.includes('sent_history')) {
      db.prepare('ALTER TABLE leads ADD COLUMN sent_history TEXT DEFAULT "[]"').run()
    }
  }

  const sentCols = db.pragma('table_info(sent_registry)') as any[]
  if (Array.isArray(sentCols)) {
    const sentColNames = sentCols.map((c: any) => c.name)
    if (!sentColNames.includes('lead_id')) {
      db.prepare('ALTER TABLE sent_registry ADD COLUMN lead_id INTEGER DEFAULT 0').run()
    }
    if (!sentColNames.includes('recipient_email')) {
      db.prepare('ALTER TABLE sent_registry ADD COLUMN recipient_email TEXT DEFAULT ""').run()
    }
    if (!sentColNames.includes('contact_person')) {
      db.prepare('ALTER TABLE sent_registry ADD COLUMN contact_person TEXT DEFAULT ""').run()
    }
    if (!sentColNames.includes('send_count')) {
      db.prepare('ALTER TABLE sent_registry ADD COLUMN send_count INTEGER DEFAULT 1').run()
    }
    if (!sentColNames.includes('sent_history')) {
      db.prepare('ALTER TABLE sent_registry ADD COLUMN sent_history TEXT DEFAULT "[]"').run()
    }
    if (!sentColNames.includes('donated_at')) {
      db.prepare('ALTER TABLE sent_registry ADD COLUMN donated_at TEXT DEFAULT ""').run()
    }
    if (!sentColNames.includes('donated_amount')) {
      db.prepare('ALTER TABLE sent_registry ADD COLUMN donated_amount TEXT DEFAULT ""').run()
    }
    if (!sentColNames.includes('donor_name')) {
      db.prepare('ALTER TABLE sent_registry ADD COLUMN donor_name TEXT DEFAULT ""').run()
    }
    if (!sentColNames.includes('donation_note')) {
      db.prepare('ALTER TABLE sent_registry ADD COLUMN donation_note TEXT DEFAULT ""').run()
    }
    if (!sentColNames.includes('status')) {
      db.prepare('ALTER TABLE sent_registry ADD COLUMN status TEXT DEFAULT "sent"').run()
    }
  }

  // Populate recipient_email in sent_registry if empty
  db.prepare("UPDATE sent_registry SET recipient_email = email_norm WHERE recipient_email = '' OR recipient_email IS NULL").run()
  // Ensure send_count is at least 1
  db.prepare("UPDATE sent_registry SET send_count = 1 WHERE send_count = 0 OR send_count IS NULL").run()
} catch (e) {}

export const defaultCampaignSettings: CampaignSettings = {
  org_name: 'Hrvatsko rodoslovno društvo “Pavao Ritter Vitezović”',
  org_street: 'Trg Marka Marulića 21',
  org_city: '10000 Zagreb',
  org_oib: '17328479414',
  org_iban: 'HR6523600001102892498',
  payment_model: 'HR00',
  payment_reference: '2026-DONACIJA',
  payment_purpose: 'CHAR',
  payment_description: 'Donacija za opremu i digitalizaciju rodoslovlja',
  suggested_amount_eur: '50.00',
  include_hub3_barcode: 'true',
  campaign_goal: 'Prikupljamo sredstva za nabavu profesionalnih skenera i računala kako bismo digitalizirali istražena rodoslovlja, stare matične knjige i obiteljsku baštinu te ih trajno sačuvali od zaborava za buduće generacije.',
  sender_name: 'Hrvatsko rodoslovno društvo “Pavao Ritter Vitezović”',
  sender_email: 'rodoslovlje@rodoslovlje.hr',
  email_signature: `Hrvatsko rodoslovno društvo “Pavao Ritter Vitezović”
(LOGO)
OIB: 17328479414
IBAN: HR6523600001102892498

📍 Trg Marka Marulića 21, 10000 Zagreb
📧 rodoslovlje@rodoslovlje.hr
🌐 www.rodoslovlje.hr
🔗 https://www.facebook.com/groups/rodoslovlje`,
  gemini_api_key: '',
  gemini_model: 'gemini-flash-latest',
  smtp_host: 'mail.rodoslovlje.hr',
  smtp_port: '465',
  smtp_secure: 'true',
  smtp_user: 'rodoslovlje@rodoslovlje.hr',
  smtp_pass: '',
  custom_logo: ''
}

const insertSettingStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
for (const [k, v] of Object.entries(defaultCampaignSettings)) {
  insertSettingStmt.run(k, v)
}

// Ensure existing databases are updated with official organization details if they still held old placeholders
try {
  const currentIban = db.prepare("SELECT value FROM settings WHERE key = 'org_iban'").get() as any
  if (!currentIban || !currentIban.value || currentIban.value === 'HR1223600001101234567') {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('org_iban', 'HR6523600001102892498')").run()
  }
  const currentOib = db.prepare("SELECT value FROM settings WHERE key = 'org_oib'").get() as any
  if (!currentOib || !currentOib.value) {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('org_oib', '17328479414')").run()
  }
  const currentStreet = db.prepare("SELECT value FROM settings WHERE key = 'org_street'").get() as any
  if (!currentStreet || !currentStreet.value || currentStreet.value === 'Trg Republike Hrvatske 14') {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('org_street', 'Trg Marka Marulića 21')").run()
  }
  const currentOrg = db.prepare("SELECT value FROM settings WHERE key = 'org_name'").get() as any
  if (!currentOrg || !currentOrg.value || !currentOrg.value.includes('Pavao Ritter Vitezović')) {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('org_name', ?)").run(defaultCampaignSettings.org_name)
  }
  const currentSender = db.prepare("SELECT value FROM settings WHERE key = 'sender_name'").get() as any
  if (!currentSender || !currentSender.value || !currentSender.value.includes('Pavao Ritter Vitezović')) {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('sender_name', ?)").run(defaultCampaignSettings.sender_name)
  }
  const currentSig = db.prepare("SELECT value FROM settings WHERE key = 'email_signature'").get() as any
  if (!currentSig || !currentSig.value || !currentSig.value.includes('Pavao Ritter Vitezović') || currentSig.value.includes('Srdačan pozdrav')) {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('email_signature', ?)").run(defaultCampaignSettings.email_signature)
  }
} catch (e: any) {
  console.warn('[Mailcrawl DB] Upozorenje pri ažuriranju zadanih postavki:', e.message)
}

export function getCampaignSettings(): CampaignSettings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const result: any = { ...defaultCampaignSettings }
  for (const r of rows) {
    result[r.key] = r.value
  }
  return result as CampaignSettings
}

export function updateCampaignSettings(newSettings: Partial<CampaignSettings>): CampaignSettings {
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  for (const [k, v] of Object.entries(newSettings)) {
    if (v !== undefined && v !== null) {
      upsert.run(k, String(v))
    }
  }
  return getCampaignSettings()
}

export function normalizeEmail(email?: string): string {
  if (!email) return ''
  return String(email).trim().toLowerCase()
}

export function normalizeDomain(urlOrDomain?: string): string {
  if (!urlOrDomain) return ''
  try {
    let input = String(urlOrDomain).trim().toLowerCase()
    if (!input.startsWith('http://') && !input.startsWith('https://')) {
      input = 'https://' + input
    }
    const u = new URL(input)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return String(urlOrDomain).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  }
}

export function normalizeName(name?: string): string {
  if (!name) return ''
  return String(name)
    .toLowerCase()
    .replace(/\b(d\.o\.o\.|j\.d\.o\.o\.|d\.d\.|obrt|vl\.|udruga|društvo)\b/gi, '')
    .replace(/[^a-z0-9čćžšđ]/gi, '')
    .trim()
}

export function checkDuplicate({ email, website, oib, name }: { email?: string; website?: string; oib?: string; name?: string }): {
  isDuplicate: boolean
  reason?: string
  existing?: any
  alreadySent?: boolean
} {
  const emailNorm = normalizeEmail(email)
  const domainNorm = normalizeDomain(website)
  const cleanOib = (oib || '').trim()

  // 1. Check permanent sent_registry first
  if (emailNorm) {
    const sentByEmail = db.prepare('SELECT * FROM sent_registry WHERE email_norm = ?').get(emailNorm)
    if (sentByEmail) {
      return { isDuplicate: true, reason: `Već poslan mail na ${emailNorm} (${(sentByEmail as any).sent_at})`, existing: sentByEmail, alreadySent: true }
    }
  }
  if (cleanOib && cleanOib.length === 11) {
    const sentByOib = db.prepare("SELECT * FROM sent_registry WHERE oib = ? AND oib != ''").get(cleanOib)
    if (sentByOib) {
      return { isDuplicate: true, reason: `Već poslan mail subjektu s OIB-om ${cleanOib}`, existing: sentByOib, alreadySent: true }
    }
  }

  // 2. Check leads table
  if (emailNorm) {
    const leadByEmail = db.prepare("SELECT * FROM leads WHERE email_norm = ? AND email_norm != ''").get(emailNorm)
    if (leadByEmail) {
      return { isDuplicate: true, reason: `E-mail ${emailNorm} već postoji u bazi (${(leadByEmail as any).name})`, existing: leadByEmail }
    }
  }
  if (cleanOib && cleanOib.length === 11) {
    const leadByOib = db.prepare("SELECT * FROM leads WHERE oib = ? AND oib != ''").get(cleanOib)
    if (leadByOib) {
      return { isDuplicate: true, reason: `Subjekt s OIB-om ${cleanOib} već postoji u bazi (${(leadByOib as any).name})`, existing: leadByOib }
    }
  }
  const socialDomains = ['facebook.com', 'instagram.com', 'linkedin.com', 'fininfo.hr', 'companywall.hr', 'zutestranice.hr', 'mojkvart.hr', 'tvrtke.hr']
  if (domainNorm && !socialDomains.some(d => domainNorm.includes(d))) {
    const leadByDomain = db.prepare("SELECT * FROM leads WHERE domain_norm = ? AND domain_norm != ''").get(domainNorm)
    if (leadByDomain) {
      return { isDuplicate: true, reason: `Domena ${domainNorm} već postoji u bazi (${(leadByDomain as any).name})`, existing: leadByDomain }
    }
  }

  if (name) {
    const normTarget = normalizeName(name)
    if (normTarget.length >= 4) {
      const allNames = db.prepare('SELECT id, name, city, status, email FROM leads').all() as any[]
      for (const row of allNames) {
        if (normalizeName(row.name) === normTarget) {
          return { isDuplicate: true, reason: `Subjekt sličnog naziva "${row.name}" već postoji u bazi`, existing: row }
        }
      }
    }
  }

  return { isDuplicate: false }
}

export function insertLead(data: Partial<Lead>): {
  inserted: boolean
  duplicate?: boolean
  reason?: string
  existing?: any
  lead?: Lead
} {
  const emailNorm = normalizeEmail(data.email)
  const domainNorm = normalizeDomain(data.website)
  const dup = checkDuplicate({
    email: data.email,
    website: data.website,
    oib: data.oib,
    name: data.name
  })

  if (dup.isDuplicate) {
    return { inserted: false, duplicate: true, reason: dup.reason, existing: dup.existing }
  }

  const stmt = db.prepare(`
    INSERT INTO leads (
      name, entity_type, oib, city, address, website, domain_norm,
      email, email_norm, all_emails, phone, contact_person, contact_role,
      activity_category, activity_summary, raw_scraped_text, source, source_url,
      email_subject, email_body, ai_personalization_note, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const info = stmt.run(
    data.name || 'Nepoznati subjekt',
    data.entity_type || 'tvrtka',
    (data.oib || '').trim(),
    (data.city || '').trim(),
    (data.address || '').trim(),
    (data.website || '').trim(),
    domainNorm,
    (data.email || '').trim(),
    emailNorm,
    typeof data.all_emails === 'string' ? data.all_emails : JSON.stringify(data.all_emails || (data.email ? [data.email] : [])),
    (data.phone || '').trim(),
    (data.contact_person || '').trim(),
    (data.contact_role || '').trim(),
    (data.activity_category || '').trim(),
    (data.activity_summary || '').trim(),
    (data.raw_scraped_text || '').slice(0, 6000),
    (data.source || 'Registar / Web').trim(),
    (data.source_url || '').trim(),
    data.email_subject || '',
    data.email_body || '',
    data.ai_personalization_note || '',
    data.status || 'new'
  )

  const created = db.prepare('SELECT * FROM leads WHERE id = ?').get(info.lastInsertRowid) as Lead
  return { inserted: true, lead: created }
}

export function updateLead(id: number | string, fields: Partial<Lead>): Lead | null {
  const existing = db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as Lead | undefined
  if (!existing) return null

  const updated: any = { ...existing, ...fields }
  if (fields.email !== undefined) {
    updated.email_norm = normalizeEmail(fields.email)
  }
  if (fields.website !== undefined) {
    updated.domain_norm = normalizeDomain(fields.website)
  }

  db.prepare(`
    UPDATE leads SET
      name = ?,
      entity_type = ?,
      oib = ?,
      city = ?,
      address = ?,
      website = ?,
      domain_norm = ?,
      email = ?,
      email_norm = ?,
      all_emails = ?,
      phone = ?,
      contact_person = ?,
      contact_role = ?,
      activity_category = ?,
      activity_summary = ?,
      raw_scraped_text = ?,
      email_subject = ?,
      email_body = ?,
      ai_personalization_note = ?,
      status = ?,
      sent_at = ?,
      donated_at = ?,
      donated_amount = ?,
      donation_note = ?,
      send_count = ?,
      sent_history = ?,
      error_message = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    updated.name,
    updated.entity_type,
    updated.oib,
    updated.city,
    updated.address,
    updated.website,
    updated.domain_norm,
    updated.email,
    updated.email_norm,
    typeof updated.all_emails === 'string' ? updated.all_emails : JSON.stringify(updated.all_emails || []),
    updated.phone,
    updated.contact_person,
    updated.contact_role,
    updated.activity_category,
    updated.activity_summary,
    updated.raw_scraped_text,
    updated.email_subject,
    updated.email_body,
    updated.ai_personalization_note,
    updated.status,
    updated.sent_at,
    updated.donated_at || '',
    updated.donated_amount || '',
    updated.donation_note || '',
    Number(updated.send_count) || 0,
    typeof updated.sent_history === 'string' ? updated.sent_history : JSON.stringify(updated.sent_history || []),
    updated.error_message,
    id
  )

  return db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as Lead
}

/**
 * Returns a fast in-memory matcher checking whether an entity (domain, email, OIB, or normalized name)
 * already exists anywhere in the database (leads or sent_registry) so search can skip it with 0 network requests.
 */
export function getKnownEntitiesChecker(): (candidate: { name?: string; domain?: string; oib?: string; url?: string; email?: string }) => boolean {
  const knownDomains = new Set<string>()
  const knownEmails = new Set<string>()
  const knownOibs = new Set<string>()
  const knownNames = new Set<string>()

  try {
    const leadRows = db.prepare("SELECT name, domain_norm, email_norm, oib FROM leads").all() as any[]
    for (const r of leadRows) {
      if (r.domain_norm) knownDomains.add(r.domain_norm)
      if (r.email_norm) knownEmails.add(r.email_norm)
      if (r.oib && r.oib.length === 11) knownOibs.add(r.oib)
      const normN = normalizeName(r.name)
      if (normN.length >= 3) knownNames.add(normN)
    }

    const sentRows = db.prepare("SELECT company_name, domain_norm, email_norm, oib FROM sent_registry").all() as any[]
    for (const r of sentRows) {
      if (r.domain_norm) knownDomains.add(r.domain_norm)
      if (r.email_norm) knownEmails.add(r.email_norm)
      if (r.oib && r.oib.length === 11) knownOibs.add(r.oib)
      const normN = normalizeName(r.company_name)
      if (normN.length >= 3) knownNames.add(normN)
    }
  } catch (err: any) {
    console.warn('[Mailcrawl DB] Greška pri dohvatu poznatih subjekata:', err.message)
  }

  const socialDomains = ['facebook.com', 'instagram.com', 'linkedin.com', 'fininfo.hr', 'companywall.hr', 'zutestranice.hr', 'mojkvart.hr', 'tvrtke.hr']

  return (c) => {
    if (c.email) {
      const en = normalizeEmail(c.email)
      if (en && knownEmails.has(en)) return true
    }
    if (c.domain) {
      const dn = normalizeDomain(c.domain)
      if (dn && !socialDomains.some(s => dn.includes(s)) && knownDomains.has(dn)) return true
    }
    if (c.url) {
      const dn = normalizeDomain(c.url)
      if (dn && !socialDomains.some(s => dn.includes(s)) && knownDomains.has(dn)) return true
    }
    if (c.oib && c.oib.trim().length === 11) {
      if (knownOibs.has(c.oib.trim())) return true
    }
    if (c.name) {
      const nn = normalizeName(c.name)
      if (nn.length >= 4 && knownNames.has(nn)) return true
    }
    return false
  }
}

/**
 * Records or updates a sent email in sent_registry and links it with the corresponding lead.
 * Maintains send_count and append-only sent_history log.
 */
export function recordSentMail({
  leadId,
  recipientEmail,
  companyName,
  oib,
  website,
  contactPerson,
  contactRole,
  subject,
  body,
  timestamp
}: {
  leadId?: number
  recipientEmail: string
  companyName: string
  oib?: string
  website?: string
  contactPerson?: string
  contactRole?: string
  subject: string
  body: string
  timestamp?: string
}) {
  const emailNorm = normalizeEmail(recipientEmail)
  const domainNorm = normalizeDomain(website)
  const nowStr = timestamp || new Date().toLocaleString('hr-HR')

  const existingSent = db.prepare('SELECT * FROM sent_registry WHERE email_norm = ?').get(emailNorm) as any

  let history: Array<{ sent_at: string; recipient: string; subject: string }> = []
  if (existingSent && existingSent.sent_history) {
    try {
      history = JSON.parse(existingSent.sent_history)
    } catch {}
  }
  history.push({
    sent_at: nowStr,
    recipient: recipientEmail,
    subject: subject || 'Poziv za donaciju'
  })

  const newCount = (existingSent ? (Number(existingSent.send_count) || 1) + 1 : 1)

  if (existingSent) {
    db.prepare(`
      UPDATE sent_registry SET
        lead_id = COALESCE(NULLIF(?, 0), lead_id),
        company_name = ?,
        recipient_email = ?,
        domain_norm = ?,
        oib = COALESCE(NULLIF(?, ''), oib),
        contact_person = COALESCE(NULLIF(?, ''), contact_person),
        subject = ?,
        body = ?,
        sent_at = ?,
        send_count = ?,
        sent_history = ?
      WHERE id = ?
    `).run(
      leadId || 0,
      companyName || existingSent.company_name,
      recipientEmail,
      domainNorm || existingSent.domain_norm,
      oib || '',
      contactPerson || '',
      subject,
      body,
      nowStr,
      newCount,
      JSON.stringify(history),
      existingSent.id
    )
  } else {
    db.prepare(`
      INSERT INTO sent_registry (
        lead_id, email_norm, recipient_email, domain_norm, oib, company_name,
        contact_person, subject, body, sent_at, send_count, sent_history, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent')
    `).run(
      leadId || 0,
      emailNorm,
      recipientEmail,
      domainNorm,
      oib || '',
      companyName,
      contactPerson || '',
      subject,
      body,
      nowStr,
      1,
      JSON.stringify(history)
    )
  }

  // Also update lead record if leadId is provided or found by email
  let targetLeadId = leadId
  if (!targetLeadId) {
    const l = db.prepare('SELECT id FROM leads WHERE email_norm = ?').get(emailNorm) as any
    if (l) targetLeadId = l.id
  }

  if (targetLeadId) {
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(targetLeadId) as any
    if (lead) {
      let leadHistory: any[] = []
      try { leadHistory = JSON.parse(lead.sent_history || '[]') } catch {}
      leadHistory.push({ sent_at: nowStr, recipient: recipientEmail, subject })

      updateLead(targetLeadId, {
        status: lead.status === 'donor' ? 'donor' : 'sent',
        sent_at: nowStr,
        send_count: (Number(lead.send_count) || 0) + 1,
        sent_history: JSON.stringify(leadHistory),
        error_message: ''
      })
    }
  }
}

/**
 * Records donation details for a recipient across both sent_registry and leads tables.
 */
export function recordDonation({
  sentId,
  leadId,
  donorName,
  donatedAmount,
  donatedAt,
  donationNote
}: {
  sentId?: number
  leadId?: number
  donorName: string
  donatedAmount: string
  donatedAt: string
  donationNote?: string
}) {
  const cleanAmount = String(donatedAmount || '0').replace(',', '.').trim()
  const cleanDate = donatedAt || new Date().toISOString().split('T')[0]
  const cleanNote = donationNote || 'Uplaćeno prema pozivu za donaciju'

  let targetLeadId = leadId
  let targetSentId = sentId

  // Find linked lead if only sentId provided
  if (!targetLeadId && targetSentId) {
    const sent = db.prepare('SELECT lead_id, email_norm FROM sent_registry WHERE id = ?').get(targetSentId) as any
    if (sent) {
      if (sent.lead_id) targetLeadId = sent.lead_id
      else {
        const l = db.prepare('SELECT id FROM leads WHERE email_norm = ?').get(sent.email_norm) as any
        if (l) targetLeadId = l.id
      }
    }
  }

  // Find linked sent if only leadId provided
  if (!targetSentId && targetLeadId) {
    const l = db.prepare('SELECT email_norm FROM leads WHERE id = ?').get(targetLeadId) as any
    if (l) {
      const sent = db.prepare('SELECT id FROM sent_registry WHERE email_norm = ?').get(l.email_norm) as any
      if (sent) targetSentId = sent.id
    }
  }

  if (targetSentId) {
    db.prepare(`
      UPDATE sent_registry SET
        status = 'donor',
        donor_name = ?,
        donated_amount = ?,
        donated_at = ?,
        donation_note = ?
      WHERE id = ?
    `).run(donorName, cleanAmount, cleanDate, cleanNote, targetSentId)
  }

  if (targetLeadId) {
    updateLead(targetLeadId, {
      status: 'donor',
      donated_amount: cleanAmount,
      donated_at: cleanDate,
      donation_note: cleanNote
    })
  }

  return { ok: true, sentId: targetSentId, leadId: targetLeadId }
}
