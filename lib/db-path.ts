import path from 'path'
import fs from 'fs'

export const PRODUCTION_DB_DIR = '/var/data/prv_data/db'

let resolvedDbDir: string | null = null

/**
 * Vraća primarni direktorij za sve SQLite baze podataka sustava.
 * Prioritet:
 * 1. Varijabla okruženja DB_DIR (ako je postavljena)
 * 2. Direktorij iz varijable DATABASE_PATH (ako je postavljena)
 * 3. Na Linux/produkcijskom sustavu: /var/data/prv_data/db/
 *    (uz automatsku migraciju postojećih baza iz ./data ako je nova mapa prazna)
 * 4. Na Windows lokalnom razvoju: ako postoji lokalni ./data/app.db ili nije moguće pisati u /var, koristi ./data
 */
export function getDatabaseDir(): string {
  if (resolvedDbDir) return resolvedDbDir

  if (process.env.DB_DIR) {
    resolvedDbDir = process.env.DB_DIR
    ensureDirExists(resolvedDbDir)
    return resolvedDbDir
  }

  if (process.env.DATABASE_PATH) {
    resolvedDbDir = path.dirname(process.env.DATABASE_PATH)
    ensureDirExists(resolvedDbDir)
    return resolvedDbDir
  }

  const localDataDir = path.join(process.cwd(), 'data')

  // Na Windows razvojnom okruženju, ako već postoji lokalna baza u ./data, zadrži lokalnu putanju
  // osim ako /var/data/prv_data/db već postoji
  if (process.platform === 'win32') {
    if (fs.existsSync(PRODUCTION_DB_DIR)) {
      resolvedDbDir = PRODUCTION_DB_DIR
      return resolvedDbDir
    }
    ensureDirExists(localDataDir)
    resolvedDbDir = localDataDir
    return resolvedDbDir
  }

  // Na Linux / Docker produkciji primarna lokacija je /var/data/prv_data/db
  try {
    ensureDirExists(PRODUCTION_DB_DIR)
    // Provjera možemo li pisati u direktorij
    const testFile = path.join(PRODUCTION_DB_DIR, '.write_test')
    fs.writeFileSync(testFile, 'ok')
    fs.unlinkSync(testFile)

    // Automatska migracija: ako u /var/data/prv_data/db još nema baza, a postoje u ./data, prekopiraj ih
    migrateExistingDatabasesIfNeeded(localDataDir, PRODUCTION_DB_DIR)

    resolvedDbDir = PRODUCTION_DB_DIR
    return resolvedDbDir
  } catch (err) {
    console.warn(`[DB-Path] Nije moguće koristiti ${PRODUCTION_DB_DIR}, koristim fallback ${localDataDir}:`, err)
    ensureDirExists(localDataDir)
    resolvedDbDir = localDataDir
    return resolvedDbDir
  }
}

function ensureDirExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function migrateExistingDatabasesIfNeeded(sourceDir: string, targetDir: string) {
  if (!fs.existsSync(sourceDir) || sourceDir === targetDir) return

  const dbFiles = ['app.db', 'mailcrawl.db', 'company_scraper.db']
  for (const file of dbFiles) {
    const srcFile = path.join(sourceDir, file)
    const destFile = path.join(targetDir, file)
    if (fs.existsSync(srcFile) && !fs.existsSync(destFile)) {
      try {
        fs.copyFileSync(srcFile, destFile)
        // Kopiraj i WAL/SHM ako postoje
        for (const ext of ['-wal', '-shm']) {
          if (fs.existsSync(srcFile + ext) && !fs.existsSync(destFile + ext)) {
            fs.copyFileSync(srcFile + ext, destFile + ext)
          }
        }
        console.log(`[DB-Path] Migrirana baza ${file} u ${targetDir}`)
      } catch (e) {
        console.warn(`[DB-Path] Greška pri migraciji ${file}:`, e)
      }
    }
  }
}

export function getAppDbPath(): string {
  if (process.env.DATABASE_PATH) {
    ensureDirExists(path.dirname(process.env.DATABASE_PATH))
    return process.env.DATABASE_PATH
  }
  return path.join(getDatabaseDir(), 'app.db')
}

export function getMailcrawlDbPath(): string {
  return path.join(getDatabaseDir(), 'mailcrawl.db')
}

export function getCompanyScraperDbPath(): string {
  return path.join(getDatabaseDir(), 'company_scraper.db')
}
