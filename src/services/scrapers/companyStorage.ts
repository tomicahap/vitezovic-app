import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { RawCompanyRecord, EnrichedCompanyRecord, ScraperStatus } from "../../types/company-search";

/**
 * SQLite pohrana i cache sustav za resume capability (nastavak rada).
 */
export class CompanyStorage {
  private db: Database.Database;

  constructor(customDbPath?: string) {
    const resolvedPath = customDbPath || CompanyStorage.resolveDefaultDbPath();
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(resolvedPath);
    this.db.pragma("journal_mode = WAL");
    this.initTables();
  }

  public static resolveDefaultDbPath(): string {
    if (process.env.DATABASE_PATH) {
      return path.join(path.dirname(process.env.DATABASE_PATH), "company_scraper.db");
    }
    return path.join(process.cwd(), "data", "company_scraper.db");
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS company_scraper_raw (
        id TEXT PRIMARY KEY,
        company_name TEXT NOT NULL,
        legal_full_name TEXT,
        place TEXT NOT NULL,
        postal_code TEXT,
        address TEXT,
        oib TEXT,
        mbs TEXT,
        phone TEXT,
        fax TEXT,
        activity_code TEXT,
        activity_name TEXT,
        company_size TEXT,
        entity_type TEXT,
        active_status TEXT,
        website_url TEXT,
        source_url TEXT UNIQUE,
        status TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS company_scraper_enriched (
        id TEXT PRIMARY KEY,
        company_name TEXT NOT NULL,
        oib TEXT,
        place TEXT NOT NULL,
        address TEXT,
        website_url TEXT,
        emails TEXT NOT NULL, -- JSON array
        primary_email TEXT,
        legal_representative TEXT, -- JSON object
        phone TEXT,
        activity TEXT,
        source_url TEXT,
        enrichment_status TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS company_scraper_checkpoints (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_raw_status ON company_scraper_raw(status);
      CREATE INDEX IF NOT EXISTS idx_raw_place ON company_scraper_raw(place);
      CREATE INDEX IF NOT EXISTS idx_enriched_place ON company_scraper_enriched(place);
    `);
  }

  public isUrlScraped(sourceUrl: string): boolean {
    const stmt = this.db.prepare("SELECT id FROM company_scraper_raw WHERE source_url = ?");
    const row = stmt.get(sourceUrl);
    return !!row;
  }

  public upsertRaw(record: RawCompanyRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO company_scraper_raw (
        id, company_name, legal_full_name, place, postal_code, address,
        oib, mbs, phone, fax, activity_code, activity_name, company_size,
        entity_type, active_status, website_url, source_url, status, metadata,
        created_at, updated_at
      ) VALUES (
        @id, @companyName, @legalFullName, @place, @postalCode, @address,
        @oib, @mbs, @phone, @fax, @activityCode, @activityName, @companySize,
        @entityType, @activeStatus, @websiteUrl, @sourceUrl, @status, @metadata,
        @createdAt, @updatedAt
      )
      ON CONFLICT(source_url) DO UPDATE SET
        company_name = excluded.company_name,
        legal_full_name = excluded.legal_full_name,
        place = excluded.place,
        postal_code = excluded.postal_code,
        address = excluded.address,
        oib = excluded.oib,
        phone = excluded.phone,
        website_url = excluded.website_url,
        status = excluded.status,
        updated_at = excluded.updated_at
    `);

    stmt.run({
      id: record.id,
      companyName: record.companyName,
      legalFullName: record.legalFullName || null,
      place: record.place,
      postalCode: record.postalCode || null,
      address: record.address || null,
      oib: record.oib || null,
      mbs: record.mbs || null,
      phone: record.phone || null,
      fax: record.fax || null,
      activityCode: record.activityCode || null,
      activityName: record.activityName || null,
      companySize: record.companySize || null,
      entityType: record.entityType || null,
      activeStatus: record.activeStatus || null,
      websiteUrl: record.websiteUrl || null,
      sourceUrl: record.sourceUrl,
      status: record.status,
      metadata: record.metadata ? JSON.stringify(record.metadata) : null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  public getPendingRawRecords(place?: string, limit?: number): RawCompanyRecord[] {
    let query = "SELECT * FROM company_scraper_raw WHERE status = 'PENDING_ENRICHMENT'";
    const params: any[] = [];

    if (place) {
      query += " AND LOWER(place) = LOWER(?)";
      params.push(place);
    }

    query += " ORDER BY created_at ASC";

    if (limit && limit > 0) {
      query += " LIMIT ?";
      params.push(limit);
    }

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((r) => this.mapRawRow(r));
  }

  public getAllRawRecords(place?: string): RawCompanyRecord[] {
    let query = "SELECT * FROM company_scraper_raw";
    const params: any[] = [];
    if (place) {
      query += " WHERE LOWER(place) = LOWER(?)";
      params.push(place);
    }
    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((r) => this.mapRawRow(r));
  }

  public updateRawStatus(id: string, status: ScraperStatus): void {
    const stmt = this.db.prepare(
      "UPDATE company_scraper_raw SET status = ?, updated_at = ? WHERE id = ?"
    );
    stmt.run(status, new Date().toISOString(), id);
  }

  public upsertEnriched(record: EnrichedCompanyRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO company_scraper_enriched (
        id, company_name, oib, place, address, website_url,
        emails, primary_email, legal_representative, phone, activity,
        source_url, enrichment_status, updated_at
      ) VALUES (
        @id, @companyName, @oib, @place, @address, @websiteUrl,
        @emails, @primaryEmail, @legalRepresentative, @phone, @activity,
        @sourceUrl, @enrichmentStatus, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        emails = excluded.emails,
        primary_email = excluded.primary_email,
        legal_representative = excluded.legal_representative,
        website_url = excluded.website_url,
        enrichment_status = excluded.enrichment_status,
        updated_at = excluded.updated_at
    `);

    stmt.run({
      id: record.id,
      companyName: record.companyName,
      oib: record.oib || null,
      place: record.place,
      address: record.address || null,
      websiteUrl: record.websiteUrl || null,
      emails: JSON.stringify(record.emails || []),
      primaryEmail: record.primaryEmail || null,
      legalRepresentative: record.legalRepresentative ? JSON.stringify(record.legalRepresentative) : null,
      phone: record.phone || null,
      activity: record.activity || null,
      sourceUrl: record.sourceUrl,
      enrichmentStatus: record.enrichmentStatus,
      updatedAt: record.updatedAt,
    });
  }

  public getAllEnriched(place?: string): EnrichedCompanyRecord[] {
    let query = "SELECT * FROM company_scraper_enriched";
    const params: any[] = [];
    if (place) {
      query += " WHERE LOWER(place) = LOWER(?)";
      params.push(place);
    }
    query += " ORDER BY updated_at DESC";
    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((r) => this.mapEnrichedRow(r));
  }

  public setCheckpoint(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO company_scraper_checkpoints (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    stmt.run(key, value, new Date().toISOString());
  }

  public getCheckpoint(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM company_scraper_checkpoints WHERE key = ?").get(key) as any;
    return row ? row.value : null;
  }

  private mapRawRow(row: any): RawCompanyRecord {
    return {
      id: row.id,
      companyName: row.company_name,
      legalFullName: row.legal_full_name,
      place: row.place,
      postalCode: row.postal_code,
      address: row.address,
      oib: row.oib,
      mbs: row.mbs,
      phone: row.phone,
      fax: row.fax,
      activityCode: row.activity_code,
      activityName: row.activity_name,
      companySize: row.company_size,
      entityType: row.entity_type,
      activeStatus: row.active_status,
      websiteUrl: row.website_url,
      sourceUrl: row.source_url,
      status: row.status as ScraperStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  private mapEnrichedRow(row: any): EnrichedCompanyRecord {
    return {
      id: row.id,
      companyName: row.company_name,
      oib: row.oib,
      place: row.place,
      address: row.address,
      websiteUrl: row.website_url,
      emails: row.emails ? JSON.parse(row.emails) : [],
      primaryEmail: row.primary_email,
      legalRepresentative: row.legal_representative ? JSON.parse(row.legal_representative) : null,
      phone: row.phone,
      activity: row.activity,
      sourceUrl: row.source_url,
      enrichmentStatus: row.enrichment_status,
      updatedAt: row.updated_at,
    };
  }

  public close(): void {
    try {
      this.db.close();
    } catch {}
  }
}
