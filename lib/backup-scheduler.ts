import { DatabaseService } from './database';
import { runBackup } from './backup';

declare global {
  var backupSchedulerStarted: boolean | undefined;
}

export function startBackupScheduler() {
  if (typeof window !== 'undefined') return; // Server-side only
  
  if (global.backupSchedulerStarted) {
    console.log('[Backup Scheduler] Scheduler already running.');
    return;
  }
  
  global.backupSchedulerStarted = true;
  console.log('[Backup Scheduler] Starting backup scheduler...');
  
  const INTERVAL_MS = 60 * 60 * 1000; // Check every 1 hour
  
  const checkAndRunBackup = async () => {
    try {
      const settings = DatabaseService.getSettings();
      if (!settings) return;
      
      const { dropboxAppKey, dropboxAppSecret, dropboxRefreshToken } = settings;
      if (!dropboxAppKey || !dropboxAppSecret || !dropboxRefreshToken) {
        return; // Dropbox not configured
      }
      
      const lastBackupStr = settings.lastBackupTimestamp;
      const lastBackup = lastBackupStr ? new Date(lastBackupStr) : null;
      const now = new Date();
      
      const intervalDays = settings.backupIntervalDays || 7;
      const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
      
      if (!lastBackup || (now.getTime() - lastBackup.getTime() >= intervalMs)) {
        console.log(`[Backup Scheduler] Last backup was more than ${intervalDays} days ago. Running automatic backup...`);
        const result = await runBackup();
        console.log('[Backup Scheduler] Automatic backup finished:', result.message);
      }
    } catch (error) {
      console.error('[Backup Scheduler] Error in backup check:', error);
    }
  };

  // Run check 10 seconds after startup
  setTimeout(checkAndRunBackup, 10000);
  
  // Schedule checks every hour
  setInterval(checkAndRunBackup, INTERVAL_MS);
}
