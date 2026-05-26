import { google } from 'googleapis'
import { DatabaseService } from './database'

/**
 * Inicijalizira i vraća Google Drive API servis koristeći OAuth 2.0 s Refresh Tokenom (ako je dostupan)
 * ili se prebacuje na stariji Service Account JSON kao fallback.
 */
export async function getDriveService() {
  const settings = DatabaseService.getSettings()
  
  // 1. Primarna metoda: Google OAuth 2.0
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
  
  // 2. Fallback metoda: Google Service Account
  if (settings.googleServiceAccountJson) {
    let credentials
    try {
      credentials = JSON.parse(settings.googleServiceAccountJson)
    } catch (error) {
      throw new Error('Neispravna Google Service Account JSON konfiguracija.')
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    })

    return google.drive({ version: 'v3', auth })
  }
  
  throw new Error('Google Drive integracija nije konfigurirana. Povežite Google račun (OAuth) ili unesite Service Account JSON u postavkama.')
}
