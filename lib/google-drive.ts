import { google } from 'googleapis'
import { DatabaseService } from './database'

/**
 * Inicijalizira i vraća Google Drive API servis koristeći OAuth 2.0 s Refresh Tokenom (ako je dostupan)
 * ili se prebacuje na stariji Service Account JSON kao fallback.
 */
export async function getDriveService() {
  const settings = DatabaseService.getSettings()
  
  // Google OAuth 2.0 integracija
  if (settings.googleClientId && settings.googleClientSecret && settings.googleRefreshToken) {
    const oauth2Client = new google.auth.OAuth2(
      settings.googleClientId,
      settings.googleClientSecret
    )
    oauth2Client.setCredentials({
      refresh_token: settings.googleRefreshToken
    })
    
    return google.drive({ version: 'v3', auth: oauth2Client })
  }
  
  throw new Error('Google Drive integracija nije konfigurirana. Molimo povežite svoj Google račun u postavkama aplikacije.')
}
