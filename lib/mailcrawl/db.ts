import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import type { Lead, SentRegistryItem, CampaignSettings } from './types'

const dataDir = path.join(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'mailcrawl.db')
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

export const defaultCampaignSettings: CampaignSettings = {
  org_name: 'Hrvatsko rodoslovno društvo',
  org_street: 'Trg Republike Hrvatske 14',
  org_city: '10000 Zagreb',
  org_oib: '',
  org_iban: 'HR1223600001101234567',
  payment_model: 'HR00',
  payment_reference: '2026-DONACIJA',
  payment_purpose: 'CHAR',
  payment_description: 'Donacija za opremu i digitalizaciju rodoslovlja',
  suggested_amount_eur: '50.00',
  include_hub3_barcode: 'true',
  campaign_goal: 'Prikupljamo sredstva za nabavu profesionalnih skenera i računala kako bismo digitalizirali istražena rodoslovlja, stare matične knjige i obiteljsku baštinu te ih trajno sačuvali od zaborava za buduće generacije.',
  sender_name: 'Hrvatsko rodoslovno društvo',
  sender_email: 'rodoslovlje@rodoslovlje.hr',
  email_signature: 'Srdačan pozdrav,\n\nHrvatsko rodoslovno društvo\nE-mail: rodoslovlje@rodoslovlje.hr\nWeb: https://rodoslovlje.hr',
  gemini_api_key: '',
  gemini_model: 'gemini-flash-latest',
  smtp_host: 'mail.rodoslovlje.hr',
  smtp_port: '465',
  smtp_secure: 'true',
  smtp_user: 'rodoslovlje@rodoslovlje.hr',
  smtp_pass: ''
}

const insertSettingStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
for (const [k, v] of Object.entries(defaultCampaignSettings)) {
  insertSettingStmt.run(k, v)
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
    updated.error_message,
    id
  )

  return db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as Lead
}
