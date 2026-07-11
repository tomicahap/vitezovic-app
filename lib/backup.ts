import DatabaseConstructor from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
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
