import 'server-only'
import fs from 'fs'
import path from 'path'
import DatabaseConstructor from 'better-sqlite3'
import {
  getAppDbPath,
  getCompanyScraperDbPath,
  getDatabaseDir,
  getMailcrawlDbPath,
} from './db-path'

const Database = (DatabaseConstructor as any).default || DatabaseConstructor

export type UploadFileCategory = 'image' | 'pdf' | 'document' | 'other'

export interface TableStorageStat {
  name: string
  bytes: number
  rowCount: number
}

export interface DatabaseStorageInfo {
  key: 'app' | 'mailcrawl' | 'company_scraper'
  label: string
  fileName: string
  path: string
  exists: boolean
  mainBytes: number
  walBytes: number
  shmBytes: number
  totalDiskBytes: number
  pageSize: number
  pageCount: number
  freelistCount: number
  allocatedBytes: number
  freeBytes: number
  tableCount: number
  totalRows: number
  tables: TableStorageStat[]
}

export interface EmbeddedImageStat {
  key: string
  label: string
  moduleKey: string
  count: number
  bytes: number
}

export interface LargestFileInfo {
  name: string
  relativePath: string
  bytes: number
  category: UploadFileCategory
  moduleKey: string
  moduleLabel: string
}

export interface ModuleStorageInfo {
  key: string
  label: string
  description: string
  dbBytes: number
  dbLogicalBytes: number
  imageBytes: number
  imageCount: number
  otherUploadBytes: number
  otherUploadCount: number
  uploadBytes: number
  uploadCount: number
  embeddedImageBytes: number
  embeddedImageCount: number
  rowCount: number
  totalBytes: number
  sharePercent: number
  tables: TableStorageStat[]
}

export interface StorageStatsReport {
  generatedAt: string
  dbDir: string
  uploadDir: string
  grandTotalBytes: number
  totalDatabasesDiskBytes: number
  totalDatabasesLogicalBytes: number
  databases: DatabaseStorageInfo[]
  images: {
    totalBytes: number
    uploadedImagesBytes: number
    uploadedImagesCount: number
    embeddedDbImagesBytes: number
    embeddedDbImagesCount: number
    embeddedBreakdown: EmbeddedImageStat[]
  }
  uploads: {
    totalBytes: number
    totalFiles: number
    imagesBytes: number
    imagesCount: number
    pdfBytes: number
    pdfCount: number
    documentBytes: number
    documentCount: number
    otherBytes: number
    otherCount: number
    largestFiles: LargestFileInfo[]
  }
  modules: ModuleStorageInfo[]
}

interface ModuleSpec {
  key: string
  label: string
  description: string
}

const MODULE_SPECS: Record<string, ModuleSpec> = {
  members: {
    key: 'members',
    label: 'Članovi i uplate',
    description: 'Matična knjiga članova, avatari u bazi i evidencija članarina',
  },
  meetings: {
    key: 'meetings',
    label: 'Sjednice i glasovanje',
    description: 'Zapisnici, dnevni redovi, prisutnost, ankete i privitci sjednica',
  },
  lectures: {
    key: 'lectures',
    label: 'Predavanja i druženja',
    description: 'Najave, predavači, prisutnost i priloženi materijali predavanja',
  },
  projects: {
    key: 'projects',
    label: 'Projekti',
    description: 'Projekti društva, zapisi napredovanja, suradnici i privitci',
  },
  research: {
    key: 'research',
    label: 'Istraživanja i upiti',
    description: 'Rodoslovni upiti, kronologija e-pošte i priloženi dokumenti istraživanja',
  },
  library: {
    key: 'library',
    label: 'Knjižnica i izvori',
    description: 'Knjige, časopisi, vanjske knjižnice, kontakti, korisni linkovi i skenovi',
  },
  archive_contacts: {
    key: 'archive_contacts',
    label: 'Adresar, Arhiv i Drive',
    description: 'Vanjski kontakti, evidencija kontaktiranja u Arhivu i Google Drive zapisi',
  },
  communications: {
    key: 'communications',
    label: 'E-mail i obavijesti tijelima',
    description: 'Obavijesti članovima tijela, privitci obavijesti i evidencija slanja/čitanja',
  },
  logs: {
    key: 'logs',
    label: 'Dnevnik aktivnosti i prijave',
    description: 'Sigurnosni dnevnik rada (activity_logs) i praćenje prijava korisnika',
  },
  trash: {
    key: 'trash',
    label: 'Smeće (obrisane stavke)',
    description: 'Sigurnosna pohrana obrisanih entiteta i privitaka za povrat',
  },
  settings_vault: {
    key: 'settings_vault',
    label: 'Postavke sustava i Trezor',
    description: 'Konfiguracija aplikacije, uplatnica, logotip, predlošci i Trezor lozinki',
  },
  donations: {
    key: 'donations',
    label: 'Donacije i kampanje',
    description: 'Odvojena baza mailcrawl.db (kandidati, poslani e-mailovi, odjave, postavke)',
  },
  company_scraper: {
    key: 'company_scraper',
    label: 'Scraper registra tvrtki',
    description: 'Odvojena baza company_scraper.db (registar, obogaćeni web kontakti, točke)',
  },
  unreferenced_uploads: {
    key: 'unreferenced_uploads',
    label: 'Nepovezane datoteke u uploads/',
    description: 'Datoteke u mapi privitaka koje trenutno nisu povezane ni s jednim zapisom',
  },
  sqlite_other: {
    key: 'sqlite_other',
    label: 'Ostalo / SQLite sustav',
    description: 'Interne SQLite tablice (shema, sekvence) i neklasificirane tablice',
  },
}

const APP_TABLE_TO_MODULE: Record<string, string> = {
  members: 'members',
  payments: 'members',
  meetings: 'meetings',
  meeting_participants: 'meetings',
  attendance: 'meetings',
  votes: 'meetings',
  vote_results: 'meetings',
  polls: 'meetings',
  poll_votes: 'meetings',
  lectures: 'lectures',
  projects: 'projects',
  research_inquiries: 'research',
  library_books: 'library',
  library_journals: 'library',
  external_libraries: 'library',
  library_contact_logs: 'library',
  useful_links: 'library',
  contacts: 'archive_contacts',
  archive_member_contacts: 'archive_contacts',
  google_drive_assets: 'archive_contacts',
  board_announcements: 'communications',
  mail_senders: 'communications',
  mail_reads: 'communications',
  activity_logs: 'logs',
  user_login_tracking: 'logs',
  trash_items: 'trash',
  settings: 'settings_vault',
  vault: 'settings_vault',
}

const IMAGE_EXTS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.tif',
  '.tiff',
  '.avif',
  '.heic',
])

const DOCUMENT_EXTS = new Set([
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.odt',
  '.ods',
  '.odp',
  '.rtf',
  '.txt',
  '.csv',
  '.ged',
])

function safeFileSize(filePath: string): number {
  try {
    if (fs.existsSync(filePath)) {
      const st = fs.statSync(filePath)
      if (st.isFile()) return st.size
    }
  } catch {}
  return 0
}

function classifyFileCategory(fileName: string): UploadFileCategory {
  const ext = path.extname(fileName).toLowerCase()
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (ext === '.pdf') return 'pdf'
  if (DOCUMENT_EXTS.has(ext)) return 'document'
  return 'other'
}

function quoteIdent(ident: string): string {
  return `"${String(ident).replace(/"/g, '""')}"`
}

function inspectSqliteDatabase(
  key: 'app' | 'mailcrawl' | 'company_scraper',
  label: string,
  dbPath: string
): DatabaseStorageInfo {
  const fileName = path.basename(dbPath)
  const mainBytes = safeFileSize(dbPath)
  const walBytes = safeFileSize(`${dbPath}-wal`)
  const shmBytes = safeFileSize(`${dbPath}-shm`)
  const totalDiskBytes = mainBytes + walBytes + shmBytes

  if (mainBytes === 0 && !fs.existsSync(dbPath)) {
    return {
      key,
      label,
      fileName,
      path: dbPath,
      exists: false,
      mainBytes: 0,
      walBytes,
      shmBytes,
      totalDiskBytes,
      pageSize: 0,
      pageCount: 0,
      freelistCount: 0,
      allocatedBytes: 0,
      freeBytes: 0,
      tableCount: 0,
      totalRows: 0,
      tables: [],
    }
  }

  let conn: any = null
  try {
    conn = new Database(dbPath, { readonly: true })
    const pageSize = Number(conn.pragma('page_size', { simple: true }) || 4096)
    const pageCount = Number(conn.pragma('page_count', { simple: true }) || 0)
    const freelistCount = Number(conn.pragma('freelist_count', { simple: true }) || 0)
    const allocatedBytes = pageSize * pageCount
    const freeBytes = pageSize * freelistCount

    const masterTables = (
      conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC")
        .all() as Array<{ name: string }>
    ).map((r) => r.name)

    const bytesByTable = new Map<string, number>()

    try {
      const dbstatRows = conn
        .prepare(
          `SELECT COALESCE(m.tbl_name, d.name) AS tbl, SUM(d.pgsize) AS bytes
           FROM dbstat d
           LEFT JOIN sqlite_master m ON m.name = d.name
           GROUP BY tbl`
        )
        .all() as Array<{ tbl: string; bytes: number }>

      for (const row of dbstatRows) {
        if (!row?.tbl) continue
        bytesByTable.set(row.tbl, Number(row.bytes) || 0)
      }
    } catch {
      // Fallback ako SQLite build ne podržava virtualnu tablicu dbstat
      for (const tbl of masterTables) {
        try {
          const cols = conn.pragma(`table_info(${quoteIdent(tbl)})`) as Array<{ name: string }>
          if (Array.isArray(cols) && cols.length > 0) {
            const sumExpr = cols
              .map((c) => `COALESCE(LENGTH(CAST(${quoteIdent(c.name)} AS BLOB)), 0)`)
              .join(' + ')
            const row = conn
              .prepare(`SELECT COALESCE(SUM(${sumExpr}), 0) AS bytes FROM ${quoteIdent(tbl)}`)
              .get() as { bytes?: number } | undefined
            bytesByTable.set(tbl, Number(row?.bytes) || 0)
          }
        } catch {}
      }
    }

    const tables: TableStorageStat[] = []
    let totalRows = 0

    for (const tbl of masterTables) {
      let rowCount = 0
      if (!tbl.startsWith('sqlite_')) {
        try {
          const res = conn
            .prepare(`SELECT COUNT(*) AS c FROM ${quoteIdent(tbl)}`)
            .get() as { c?: number } | undefined
          rowCount = Number(res?.c) || 0
        } catch {}
      }
      totalRows += rowCount
      tables.push({
        name: tbl,
        bytes: bytesByTable.get(tbl) || 0,
        rowCount,
      })
    }

    // Dodaj sqlite_schema ako ga je dbstat izmjerio, a nije u sqlite_master listi tablica
    for (const [tbl, b] of bytesByTable.entries()) {
      if (!masterTables.includes(tbl) && b > 0) {
        tables.push({ name: tbl, bytes: b, rowCount: 0 })
      }
    }

    tables.sort((a, b) => b.bytes - a.bytes)

    return {
      key,
      label,
      fileName,
      path: dbPath,
      exists: true,
      mainBytes,
      walBytes,
      shmBytes,
      totalDiskBytes,
      pageSize,
      pageCount,
      freelistCount,
      allocatedBytes,
      freeBytes,
      tableCount: masterTables.filter((n) => !n.startsWith('sqlite_')).length,
      totalRows,
      tables,
    }
  } catch (err) {
    console.warn(`[StorageStats] Greška pri čitanju baze ${dbPath}:`, err)
    return {
      key,
      label,
      fileName,
      path: dbPath,
      exists: mainBytes > 0,
      mainBytes,
      walBytes,
      shmBytes,
      totalDiskBytes,
      pageSize: 0,
      pageCount: 0,
      freelistCount: 0,
      allocatedBytes: 0,
      freeBytes: 0,
      tableCount: 0,
      totalRows: 0,
      tables: [],
    }
  } finally {
    if (conn) {
      try {
        conn.close()
      } catch {}
    }
  }
}

function extractUploadNamesFromText(raw: unknown): string[] {
  if (!raw) return []
  const str = String(raw)
  if (!str.includes('/api/uploads/')) return []
  const matches = str.match(/\/api\/uploads\/([^"'?&#\s\\\]})]+)/g) || []
  const names: string[] = []
  for (const m of matches) {
    const rawName = m.slice('/api/uploads/'.length)
    let decoded = rawName
    try {
      decoded = decodeURIComponent(rawName)
    } catch {}
    const base = path.basename(decoded).trim()
    if (base) names.push(base)
  }
  return names
}

function collectEmbeddedImages(appDbPath: string): {
  totalBytes: number
  totalCount: number
  breakdown: EmbeddedImageStat[]
} {
  if (!fs.existsSync(appDbPath)) {
    return { totalBytes: 0, totalCount: 0, breakdown: [] }
  }

  let conn: any = null
  const breakdown: EmbeddedImageStat[] = []
  let totalBytes = 0
  let totalCount = 0

  try {
    conn = new Database(appDbPath, { readonly: true })

    try {
      const settingsRow = conn
        .prepare('SELECT logoUrl, paymentSlipUrl, paymentQrUrl FROM settings WHERE id = 1')
        .get() as { logoUrl?: string; paymentSlipUrl?: string; paymentQrUrl?: string } | undefined

      const settingFields: Array<{ key: string; label: string; val?: string }> = [
        { key: 'settings_logo', label: 'Logo društva (Postavke)', val: settingsRow?.logoUrl },
        { key: 'settings_slip', label: 'Predložak uplatnice (HUB-3A)', val: settingsRow?.paymentSlipUrl },
        { key: 'settings_qr', label: 'QR kod za plaćanje (Postavke)', val: settingsRow?.paymentQrUrl },
      ]

      for (const sf of settingFields) {
        const s = typeof sf.val === 'string' ? sf.val.trim() : ''
        if (s && (s.startsWith('data:image/') || (s.length > 200 && !s.startsWith('/') && !s.startsWith('http')))) {
          const bytes = Buffer.byteLength(s, 'utf8')
          totalBytes += bytes
          totalCount += 1
          breakdown.push({
            key: sf.key,
            label: sf.label,
            moduleKey: 'settings_vault',
            count: 1,
            bytes,
          })
        }
      }
    } catch {}

    try {
      const avatarRows = conn
        .prepare("SELECT avatar FROM members WHERE avatar IS NOT NULL AND avatar LIKE 'data:image/%'")
        .all() as Array<{ avatar: string }>

      if (avatarRows.length > 0) {
        let avatarBytes = 0
        for (const row of avatarRows) {
          avatarBytes += Buffer.byteLength(String(row.avatar || ''), 'utf8')
        }
        totalBytes += avatarBytes
        totalCount += avatarRows.length
        breakdown.push({
          key: 'member_avatars',
          label: 'Avatari / fotografije članova u bazi',
          moduleKey: 'members',
          count: avatarRows.length,
          bytes: avatarBytes,
        })
      }
    } catch {}
  } catch (err) {
    console.warn('[StorageStats] Greška pri mjerenju ugrađenih slika:', err)
  } finally {
    if (conn) {
      try {
        conn.close()
      } catch {}
    }
  }

  return { totalBytes, totalCount, breakdown }
}

function collectUploadModuleRefs(appDbPath: string): {
  activeRefs: Map<string, string>
  trashRefs: Set<string>
} {
  const activeRefs = new Map<string, string>()
  const trashRefs = new Set<string>()
  if (!fs.existsSync(appDbPath)) return { activeRefs, trashRefs }

  let conn: any = null
  try {
    conn = new Database(appDbPath, { readonly: true })

    const refQueries: Array<{ sql: string; moduleKey: string }> = [
      { sql: 'SELECT attachments AS raw FROM meetings WHERE attachments IS NOT NULL', moduleKey: 'meetings' },
      { sql: 'SELECT attachments AS raw FROM lectures WHERE attachments IS NOT NULL', moduleKey: 'lectures' },
      { sql: 'SELECT attachments AS raw FROM projects WHERE attachments IS NOT NULL', moduleKey: 'projects' },
      { sql: 'SELECT records AS raw FROM projects WHERE records IS NOT NULL', moduleKey: 'projects' },
      { sql: 'SELECT attachments AS raw FROM research_inquiries WHERE attachments IS NOT NULL', moduleKey: 'research' },
      { sql: 'SELECT attachments AS raw FROM library_books WHERE attachments IS NOT NULL', moduleKey: 'library' },
      { sql: 'SELECT rights_attachment AS raw FROM library_books WHERE rights_attachment IS NOT NULL', moduleKey: 'library' },
      { sql: 'SELECT attachments AS raw FROM library_journals WHERE attachments IS NOT NULL', moduleKey: 'library' },
      { sql: 'SELECT attachments AS raw FROM board_announcements WHERE attachments IS NOT NULL', moduleKey: 'communications' },
    ]

    for (const q of refQueries) {
      try {
        const rows = conn.prepare(q.sql).all() as Array<{ raw: string }>
        for (const r of rows) {
          for (const fname of extractUploadNamesFromText(r.raw)) {
            if (!activeRefs.has(fname)) {
              activeRefs.set(fname, q.moduleKey)
            }
          }
        }
      } catch {}
    }

    try {
      const trashRows = conn
        .prepare("SELECT data_json AS raw FROM trash_items WHERE data_json IS NOT NULL AND COALESCE(status, 'deleted') = 'deleted'")
        .all() as Array<{ raw: string }>
      for (const r of trashRows) {
        for (const fname of extractUploadNamesFromText(r.raw)) {
          trashRefs.add(fname)
        }
      }
    } catch {}
  } catch (err) {
    console.warn('[StorageStats] Greška pri mapiranju referenci uploads/:', err)
  } finally {
    if (conn) {
      try {
        conn.close()
      } catch {}
    }
  }

  return { activeRefs, trashRefs }
}

interface ScannedUploadFile {
  name: string
  relativePath: string
  bytes: number
  category: UploadFileCategory
}

function scanUploadDirectory(uploadDir: string): ScannedUploadFile[] {
  if (!fs.existsSync(uploadDir)) return []
  const files: ScannedUploadFile[] = []

  const walk = (dir: string) => {
    let entries: fs.Dirent[] = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.isFile()) {
        try {
          const st = fs.statSync(fullPath)
          const rel = path.relative(uploadDir, fullPath).replace(/\\/g, '/')
          files.push({
            name: entry.name,
            relativePath: rel,
            bytes: st.size,
            category: classifyFileCategory(entry.name),
          })
        } catch {}
      }
    }
  }

  walk(uploadDir)
  return files
}

export function collectStorageStats(): StorageStatsReport {
  const dbDir = getDatabaseDir()
  const uploadDir = process.env.UPLOAD_FOLDER || path.join(process.cwd(), 'data', 'uploads')

  const appDbPath = getAppDbPath()
  const mailcrawlDbPath = process.env.MAILCRAWL_DATABASE_PATH || getMailcrawlDbPath()
  const scraperDbPath = getCompanyScraperDbPath()

  const databases: DatabaseStorageInfo[] = [
    inspectSqliteDatabase('app', 'Glavna CMS baza (app.db)', appDbPath),
    inspectSqliteDatabase('mailcrawl', 'Donacije i kampanje (mailcrawl.db)', mailcrawlDbPath),
    inspectSqliteDatabase('company_scraper', 'Scraper registra tvrtki (company_scraper.db)', scraperDbPath),
  ]

  const totalDatabasesDiskBytes = databases.reduce((sum, d) => sum + d.totalDiskBytes, 0)
  const totalDatabasesLogicalBytes = databases.reduce(
    (sum, d) => sum + d.tables.reduce((tSum, t) => tSum + t.bytes, 0),
    0
  )

  const embedded = collectEmbeddedImages(appDbPath)
  const { activeRefs, trashRefs } = collectUploadModuleRefs(appDbPath)
  const uploadFiles = scanUploadDirectory(uploadDir)

  // Inicijaliziraj module
  const moduleMap = new Map<string, ModuleStorageInfo>()
  const ensureModule = (key: string): ModuleStorageInfo => {
    const existing = moduleMap.get(key)
    if (existing) return existing
    const spec = MODULE_SPECS[key] || {
      key,
      label: key,
      description: 'Ostali podaci sustava',
    }
    const created: ModuleStorageInfo = {
      key: spec.key,
      label: spec.label,
      description: spec.description,
      dbBytes: 0,
      dbLogicalBytes: 0,
      imageBytes: 0,
      imageCount: 0,
      otherUploadBytes: 0,
      otherUploadCount: 0,
      uploadBytes: 0,
      uploadCount: 0,
      embeddedImageBytes: 0,
      embeddedImageCount: 0,
      rowCount: 0,
      totalBytes: 0,
      sharePercent: 0,
      tables: [],
    }
    moduleMap.set(key, created)
    return created
  }

  for (const specKey of Object.keys(MODULE_SPECS)) {
    if (specKey !== 'unreferenced_uploads' && specKey !== 'sqlite_other') {
      ensureModule(specKey)
    }
  }

  // Dodaj veličine tablica iz svake baze u pripadajuće module
  for (const dbInfo of databases) {
    for (const tbl of dbInfo.tables) {
      let modKey = 'sqlite_other'
      if (tbl.name.startsWith('sqlite_')) {
        modKey = 'sqlite_other'
      } else if (dbInfo.key === 'app') {
        modKey = APP_TABLE_TO_MODULE[tbl.name] || 'sqlite_other'
      } else if (dbInfo.key === 'mailcrawl') {
        modKey = 'donations'
      } else if (dbInfo.key === 'company_scraper') {
        modKey = 'company_scraper'
      }

      if (modKey === 'sqlite_other' && tbl.bytes === 0 && tbl.rowCount === 0) {
        continue
      }

      const mod = ensureModule(modKey)
      mod.dbLogicalBytes += tbl.bytes
      mod.dbBytes += tbl.bytes
      mod.rowCount += tbl.rowCount
      mod.tables.push(tbl)
    }
  }

  // Ugrađene slike prikaži informativno uz modul kojem pripadaju (bez dvostrukog zbrajanja u totalBytes)
  for (const emb of embedded.breakdown) {
    const mod = ensureModule(emb.moduleKey)
    mod.embeddedImageBytes += emb.bytes
    mod.embeddedImageCount += emb.count
  }

  // Skeniraj datoteke u uploads/ i razvrstaj po tipu i modulu
  let uploadsTotalBytes = 0
  let imagesBytes = 0
  let imagesCount = 0
  let pdfBytes = 0
  let pdfCount = 0
  let documentBytes = 0
  let documentCount = 0
  let otherBytes = 0
  let otherCount = 0
  const fileWithModule: LargestFileInfo[] = []

  for (const f of uploadFiles) {
    uploadsTotalBytes += f.bytes
    if (f.category === 'image') {
      imagesBytes += f.bytes
      imagesCount += 1
    } else if (f.category === 'pdf') {
      pdfBytes += f.bytes
      pdfCount += 1
    } else if (f.category === 'document') {
      documentBytes += f.bytes
      documentCount += 1
    } else {
      otherBytes += f.bytes
      otherCount += 1
    }

    const mappedModule =
      activeRefs.get(f.name) ||
      (trashRefs.has(f.name) ? 'trash' : 'unreferenced_uploads')

    const mod = ensureModule(mappedModule)
    if (f.category === 'image') {
      mod.imageBytes += f.bytes
      mod.imageCount += 1
    } else {
      mod.otherUploadBytes += f.bytes
      mod.otherUploadCount += 1
    }
    mod.uploadBytes += f.bytes
    mod.uploadCount += 1

    fileWithModule.push({
      name: f.name,
      relativePath: f.relativePath,
      bytes: f.bytes,
      category: f.category,
      moduleKey: mod.key,
      moduleLabel: mod.label,
    })
  }

  const largestFiles = fileWithModule
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5)

  const modulesList = Array.from(moduleMap.values())
  let modulesAttributedSum = 0
  for (const mod of modulesList) {
    mod.totalBytes = mod.dbBytes + mod.uploadBytes
    mod.tables.sort((a, b) => b.bytes - a.bytes)
    modulesAttributedSum += mod.totalBytes
  }

  for (const mod of modulesList) {
    mod.sharePercent =
      modulesAttributedSum > 0
        ? Math.round((mod.totalBytes / modulesAttributedSum) * 1000) / 10
        : 0
  }

  modulesList.sort((a, b) => b.totalBytes - a.totalBytes)

  const grandTotalBytes = totalDatabasesDiskBytes + uploadsTotalBytes

  return {
    generatedAt: new Date().toISOString(),
    dbDir,
    uploadDir,
    grandTotalBytes,
    totalDatabasesDiskBytes,
    totalDatabasesLogicalBytes,
    databases,
    images: {
      totalBytes: imagesBytes + embedded.totalBytes,
      uploadedImagesBytes: imagesBytes,
      uploadedImagesCount: imagesCount,
      embeddedDbImagesBytes: embedded.totalBytes,
      embeddedDbImagesCount: embedded.totalCount,
      embeddedBreakdown: embedded.breakdown,
    },
    uploads: {
      totalBytes: uploadsTotalBytes,
      totalFiles: uploadFiles.length,
      imagesBytes,
      imagesCount,
      pdfBytes,
      pdfCount,
      documentBytes,
      documentCount,
      otherBytes,
      otherCount,
      largestFiles,
    },
    modules: modulesList,
  }
}
