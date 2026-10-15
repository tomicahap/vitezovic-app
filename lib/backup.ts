import DatabaseConstructor from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
// @ts-ignore
import AdmZip from 'adm-zip';
import { DatabaseService } from './database';

// Safety check for ESM/Next.js environment
const Database = (DatabaseConstructor as any).default || DatabaseConstructor;

export async function createBackupZip(): Promise<string> {
  const dbPath = DatabaseService.getDatabasePath();
  const dbDir = path.dirname(dbPath);

  // 1. Run WAL checkpoint to make sure all data is flushed from WAL to db file
  try {
    const sqlite = new Database(dbPath);
    sqlite.pragma('wal_checkpoint(TRUNCATE)');
    sqlite.close();
    console.log('[Backup] WAL checkpoint completed successfully.');
  } catch (e) {
    console.error('[Backup] Error running WAL checkpoint:', e);
  }

  // 2. Initialize ZIP
  const zip = new AdmZip();

  // 3. Create manifest.json
  const manifest = {
    version: "1.0",
    timestamp: new Date().toISOString(),
    database: "database/app.db",
    uploads: "uploads/"
  };
  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf8"));

  // 4. Add database file into 'database' directory
  if (fs.existsSync(dbPath)) {
    const dbContent = fs.readFileSync(dbPath);
    zip.addFile("database/app.db", dbContent);
  } else {
    throw new Error('Database file does not exist at ' + dbPath);
  }

  // 5. Add uploads folder into 'uploads' directory
  const uploadsPath = process.env.UPLOAD_FOLDER || path.join(process.cwd(), 'data', 'uploads');
  if (fs.existsSync(uploadsPath)) {
    const files = fs.readdirSync(uploadsPath);
    if (files.length > 0) {
      zip.addLocalFolder(uploadsPath, 'uploads');
    } else {
      console.log('[Backup] Uploads folder is empty.');
    }
  } else {
    console.log('[Backup] Uploads folder does not exist at ' + uploadsPath);
  }

  // 6. Write to a temporary file inside data folder
  const tempZipPath = path.join(dbDir, `backup_temp_${Date.now()}.zip`);
  zip.writeZip(tempZipPath);
  return tempZipPath;
}

export function cleanCredential(val: string | null | undefined): string {
  if (!val) return '';
  
  // 1. Remove non-printable and control characters (like \r, \n, \t, etc.), and zero-width spaces
  let str = val.replace(/[\u0000-\u001F\u007F-\u009F\u200B\u200C\u200D\uFEFF]/g, '');
  
  // 2. Trim whitespace
  str = str.trim();
  
  // 3. Strip surrounding double or single quotes if present
  while (str.length >= 2 && (
    (str.startsWith('"') && str.endsWith('"')) || 
    (str.startsWith("'") && str.endsWith("'"))
  )) {
    str = str.slice(1, -1).trim();
  }
  
  return str;
}

export async function getDropboxAccessToken(appKey: string, appSecret: string, refreshToken: string): Promise<string> {
  const tokenUrl = 'https://api.dropboxapi.com/oauth2/token';
  
  const cleanAppKey = cleanCredential(appKey);
  const cleanAppSecret = cleanCredential(appSecret);
  const cleanRefreshToken = cleanCredential(refreshToken);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: cleanRefreshToken,
      client_id: cleanAppKey,
      client_secret: cleanAppSecret,
    }).toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[Dropbox Auth] Refresh failed. Refresh token length: ${cleanRefreshToken.length}. Start: ${cleanRefreshToken.substring(0, 10)}... End: ...${cleanRefreshToken.substring(Math.max(0, cleanRefreshToken.length - 10))}`);
    throw new Error(`Failed to refresh Dropbox token: ${response.statusText} (${errText})`);
  }

  const data = (await response.json()) as any;
  if (!data.access_token) {
    throw new Error('No access token returned from Dropbox OAuth');
  }

  return data.access_token;
}

export async function uploadToDropbox(
  filePath: string,
  fileName: string,
  appKey: string,
  appSecret: string,
  refreshToken: string,
  folderPath: string
): Promise<string> {
  const accessToken = await getDropboxAccessToken(appKey, appSecret, refreshToken);
  
  const fileContent = fs.readFileSync(filePath);
  const cleanFolder = folderPath.startsWith('/') ? folderPath : `/${folderPath}`;
  const cleanFolderNoTrailing = cleanFolder.endsWith('/') && cleanFolder.length > 1 ? cleanFolder.slice(0, -1) : cleanFolder;
  const dropboxDestPath = cleanFolderNoTrailing === '/' ? `/${fileName}` : `${cleanFolderNoTrailing}/${fileName}`;

  const uploadUrl = 'https://content.dropboxapi.com/2/files/upload';
  const apiArgs = {
    path: dropboxDestPath,
    mode: 'add',
    autorename: true,
    mute: false,
    strict_conflict: false,
  };

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Dropbox-API-Arg': JSON.stringify(apiArgs),
      'Content-Type': 'application/octet-stream',
    },
    body: fileContent,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Dropbox upload failed: ${response.statusText} (${errText})`);
  }

  const resData = (await response.json()) as any;
  return resData.path_display || dropboxDestPath;
}

export async function runBackup(): Promise<{ success: boolean; message: string }> {
  const settings = DatabaseService.getSettings();
  if (!settings) {
    return { success: false, message: 'Nije moguće dohvatiti postavke baze podataka.' };
  }

  const { dropboxAppKey, dropboxAppSecret, dropboxRefreshToken, dropboxFolderPath } = settings;
  if (!dropboxAppKey || !dropboxAppSecret || !dropboxRefreshToken) {
    return { success: false, message: 'Dropbox integracija nije u potpunosti konfigurirana.' };
  }

  const folder = dropboxFolderPath || '/backups';
  let tempZipPath = '';

  try {
    console.log('[Backup] Starting backup process...');
    tempZipPath = await createBackupZip();
    console.log('[Backup] Temporary ZIP created at:', tempZipPath);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup_${timestamp}.zip`;

    console.log('[Backup] Uploading to Dropbox...');
    const destPath = await uploadToDropbox(
      tempZipPath,
      fileName,
      dropboxAppKey,
      dropboxAppSecret,
      dropboxRefreshToken,
      folder
    );
    console.log('[Backup] Uploaded successfully to:', destPath);

    // Update status in DB
    const lastBackupTime = new Date().toISOString();
    DatabaseService.updateSettings({
      lastBackupTimestamp: lastBackupTime,
      lastBackupStatus: `Success: Uspješno spremljeno na ${destPath}`
    });

    return { success: true, message: `Backup uspješno spremljen na Dropbox: ${destPath}` };
  } catch (error: any) {
    console.error('[Backup] Backup failed:', error);
    
    DatabaseService.updateSettings({
      lastBackupStatus: `Error: ${error.message}`
    });

    return { success: false, message: `Greška: ${error.message}` };
  } finally {
    if (tempZipPath && fs.existsSync(tempZipPath)) {
      try {
        fs.unlinkSync(tempZipPath);
        console.log('[Backup] Temporary file cleaned up.');
      } catch (err) {
        console.error('[Backup] Failed to delete temp zip:', err);
      }
    }
  }
}

export async function runPreRestoreBackup(): Promise<{ success: boolean; message: string }> {
  const settings = DatabaseService.getSettings();
  if (!settings) {
    return { success: false, message: 'Nije moguće dohvatiti postavke baze podataka.' };
  }

  const { dropboxAppKey, dropboxAppSecret, dropboxRefreshToken, dropboxFolderPath } = settings;
  if (!dropboxAppKey || !dropboxAppSecret || !dropboxRefreshToken) {
    return { success: false, message: 'Dropbox integracija nije u potpunosti konfigurirana. Preskačem automatski pre-restore backup.' };
  }

  const folder = dropboxFolderPath || '/backups';
  let tempZipPath = '';

  try {
    console.log('[Backup] Starting pre-restore backup process...');
    tempZipPath = await createBackupZip();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup_PRE_RESTORE_${timestamp}.zip`;

    console.log('[Backup] Uploading pre-restore backup to Dropbox...');
    const destPath = await uploadToDropbox(
      tempZipPath,
      fileName,
      dropboxAppKey,
      dropboxAppSecret,
      dropboxRefreshToken,
      folder
    );
    console.log('[Backup] Pre-restore backup uploaded successfully to:', destPath);
    return { success: true, message: `Pre-restore backup uspješno spremljen na Dropbox: ${destPath}` };
  } catch (error: any) {
    console.error('[Backup] Pre-restore backup failed:', error);
    return { success: false, message: `Greška pri pre-restore backupu: ${error.message}` };
  } finally {
    if (tempZipPath && fs.existsSync(tempZipPath)) {
      try { fs.unlinkSync(tempZipPath); } catch (err) { console.error(err); }
    }
  }
}

export interface BackupSimulationReport {
  success: boolean
  isReadyForRestore: boolean
  source: string
  integrityCheck: string
  foreignKeyErrors: number
  manifest?: any
  tablesFound: string[]
  missingTables: string[]
  audit: Record<string, { backupCount: number; liveCount: number; diff: number; label: string }>
  uploads: {
    totalFiles: number
    totalSizeMB: number
    missingReferencedFiles: string[]
  }
  warnings: string[]
  testedAt: string
}

export async function simulateBackupRestore(
  providedBuffer?: Buffer | null,
  fileName: string = "automatic_system_backup.zip"
): Promise<BackupSimulationReport> {
  const simId = `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  const simDir = path.join(os.tmpdir(), simId)
  fs.mkdirSync(simDir, { recursive: true })

  let tempCreatedZip: string | null = null

  try {
    let zipBuffer: Buffer

    if (providedBuffer && providedBuffer.length > 0) {
      zipBuffer = providedBuffer
    } else {
      // Generate a fresh backup zip to test the exact automated backup pipeline
      tempCreatedZip = await createBackupZip()
      zipBuffer = fs.readFileSync(tempCreatedZip)
    }

    const zip = new AdmZip(zipBuffer)
    const zipEntries = zip.getEntries()

    let dbBuffer: Buffer | null = null
    let manifestData: any = null

    const manifestEntry = zipEntries.find((e: any) => e.entryName === "manifest.json")
    if (manifestEntry) {
      try {
        manifestData = JSON.parse(manifestEntry.getData().toString("utf8"))
        if (manifestData.database) {
          const dbEntry = zipEntries.find((e: any) => e.entryName === manifestData.database)
          if (dbEntry) {
            dbBuffer = dbEntry.getData()
          }
        }
      } catch (e) {
        console.warn("[Simulate Backup] Manifest parsing failed:", e)
      }
    }

    if (!dbBuffer) {
      // Fallback: look for any .db file
      const dbEntry = zipEntries.find(
        (e: any) => e.entryName === "database/app.db" || e.entryName === "db" || e.entryName.endsWith(".db")
      )
      if (dbEntry) {
        dbBuffer = dbEntry.getData()
      }
    }

    if (!dbBuffer) {
      throw new Error("Datoteka baze podataka (app.db) nije pronađena unutar ZIP arhive.")
    }

    // Extract database to isolated simulation folder
    const simDbPath = path.join(simDir, "sim_test.db")
    fs.writeFileSync(simDbPath, dbBuffer)

    // Open isolated test database in read-only mode
    const testDb = new Database(simDbPath, { readonly: true })

    // 1. Run PRAGMA integrity_check
    const integrityRows = testDb.pragma("integrity_check") as any[]
    const integrityCheck = integrityRows?.[0]?.integrity_check || "unknown"

    // 2. Run PRAGMA foreign_key_check
    const fkRows = testDb.pragma("foreign_key_check") as any[]
    const foreignKeyErrors = Array.isArray(fkRows) ? fkRows.length : 0

    // 3. Schema audit
    const expectedTables = [
      { name: "members", label: "Članovi društva" },
      { name: "payments", label: "Uplate članarina" },
      { name: "meetings", label: "Sjednice i dnevni red" },
      { name: "votes", label: "Odluke i glasovanja" },
      { name: "vote_results", label: "Evidencija glasačkih listića" },
      { name: "library_books", label: "Knjižnica (Knjige)" },
      { name: "projects", label: "Projekti društva" },
      { name: "research_inquiries", label: "Upiti i istraživanja" },
      { name: "contacts", label: "Adresar i kontakti" },
      { name: "useful_links", label: "Korisni linkovi" },
      { name: "activity_logs", label: "Dnevnik aktivnosti (Logovi)" },
      { name: "settings", label: "Postavke sustava" }
    ]

    const allTablesInTest = (testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[]).map(
      (r) => r.name
    )

    const tablesFound: string[] = []
    const missingTables: string[] = []

    for (const t of expectedTables) {
      if (allTablesInTest.includes(t.name)) {
        tablesFound.push(t.name)
      } else {
        missingTables.push(t.name)
      }
    }

    // 4. Counts in backup vs live database
    const liveDbPath = DatabaseService.getDatabasePath()
    let liveDb: any = null
    try {
      liveDb = new Database(liveDbPath, { readonly: true })
    } catch (e) {
      console.warn("[Simulate Backup] Could not open live db in readonly mode:", e)
    }

    const audit: Record<string, { backupCount: number; liveCount: number; diff: number; label: string }> = {}

    for (const t of expectedTables) {
      if (!tablesFound.includes(t.name)) continue

      let bCount = 0
      let lCount = 0

      try {
        const bRes = testDb.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get() as any
        bCount = bRes?.c || 0
      } catch (e) {}

      if (liveDb) {
        try {
          const lRes = liveDb.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get() as any
          lCount = lRes?.c || 0
        } catch (e) {}
      }

      audit[t.name] = {
        backupCount: bCount,
        liveCount: lCount,
        diff: bCount - lCount,
        label: t.label
      }
    }

    if (liveDb) {
      try { liveDb.close() } catch (e) {}
    }

    // 5. Uploads audit
    const uploadEntries = zipEntries.filter((e: any) => !e.isDirectory && e.entryName.startsWith("uploads/"))
    const totalFiles = uploadEntries.length
    const totalBytes = uploadEntries.reduce((acc: number, cur: any) => acc + (cur.header?.size || 0), 0)
    const totalSizeMB = Math.round((totalBytes / (1024 * 1024)) * 100) / 100

    // Missing referenced files check
    const missingReferencedFiles: string[] = []
    const zipFileNames = new Set(uploadEntries.map((e: any) => path.basename(e.entryName)))

    // Check meetings attachments
    try {
      const meetings = testDb.prepare("SELECT attachments FROM meetings WHERE attachments IS NOT NULL").all() as any[]
      for (const m of meetings) {
        try {
          const atts = JSON.parse(m.attachments || "[]")
          for (const a of atts) {
            if (a.url && a.url.startsWith("/api/uploads/")) {
              const fname = a.url.replace("/api/uploads/", "")
              if (!zipFileNames.has(fname) && !missingReferencedFiles.includes(fname)) {
                missingReferencedFiles.push(fname)
              }
            }
          }
        } catch (e) {}
      }
    } catch (e) {}

    testDb.close()

    const warnings: string[] = []
    if (foreignKeyErrors > 0) {
      warnings.push(`Pronađeno ${foreignKeyErrors} narušavanja vanjskih ključeva u bazi.`)
    }
    if (missingTables.length > 0) {
      warnings.push(`U backupu nedostaju tablice: ${missingTables.join(", ")}`)
    }
    if (missingReferencedFiles.length > 0) {
      warnings.push(`${missingReferencedFiles.length} privitaka iz sjednica nije pronađeno u mapi uploads/.`)
    }

    const isReadyForRestore = integrityCheck === "ok" && missingTables.length === 0

    return {
      success: true,
      isReadyForRestore,
      source: providedBuffer ? fileName : "Zadnje automatsko generiranje sustava",
      integrityCheck,
      foreignKeyErrors,
      manifest: manifestData,
      tablesFound,
      missingTables,
      audit,
      uploads: {
        totalFiles,
        totalSizeMB,
        missingReferencedFiles
      },
      warnings,
      testedAt: new Date().toISOString()
    }
  } catch (error: any) {
    console.error("[Simulate Backup Error]:", error)
    return {
      success: false,
      isReadyForRestore: false,
      source: fileName,
      integrityCheck: "failed",
      foreignKeyErrors: 0,
      tablesFound: [],
      missingTables: [],
      audit: {},
      uploads: {
        totalFiles: 0,
        totalSizeMB: 0,
        missingReferencedFiles: []
      },
      warnings: [error.message || "Nepoznata greška pri provjeri."],
      testedAt: new Date().toISOString()
    }
  } finally {
    // Clean up simulation directory
    if (fs.existsSync(simDir)) {
      try {
        fs.rmSync(simDir, { recursive: true, force: true })
      } catch (err) {
        console.error("[Simulate Backup] Failed to remove simDir:", err)
      }
    }
    if (tempCreatedZip && fs.existsSync(tempCreatedZip)) {
      try {
        fs.unlinkSync(tempCreatedZip)
      } catch (err) {}
    }
  }
}

