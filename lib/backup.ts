import DatabaseConstructor from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
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

  // 3. Add database file
  if (fs.existsSync(dbPath)) {
    zip.addLocalFile(dbPath, 'db');
  } else {
    throw new Error('Database file does not exist at ' + dbPath);
  }

  // 4. Add uploads folder
  const uploadsPath = process.env.UPLOAD_FOLDER || path.join(process.cwd(), 'data', 'uploads');
  if (fs.existsSync(uploadsPath)) {
    // If the directory has files, add them
    const files = fs.readdirSync(uploadsPath);
    if (files.length > 0) {
      zip.addLocalFolder(uploadsPath, 'uploads');
    } else {
      console.log('[Backup] Uploads folder is empty.');
    }
  } else {
    console.log('[Backup] Uploads folder does not exist at ' + uploadsPath);
  }

  // 5. Write to a temporary file inside data folder
  const tempZipPath = path.join(dbDir, `backup_temp_${Date.now()}.zip`);
  zip.writeZip(tempZipPath);
  return tempZipPath;
}

export async function getDropboxAccessToken(appKey: string, appSecret: string, refreshToken: string): Promise<string> {
  const tokenUrl = 'https://api.dropboxapi.com/oauth2/token';
  const basicAuth = Buffer.from(`${appKey}:${appSecret}`).toString('base64');
  
  // Send parameters both in basic authentication header AND in request body
  // to maximize compatibility with different Dropbox App configurations.
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: appKey,
      client_secret: appSecret,
    }).toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
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
