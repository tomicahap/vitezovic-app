import { google } from 'googleapis'
import { DatabaseService } from './database'

/**
 * Initializes and returns the Google Drive API service using the stored Service Account credentials.
 */
export async function getDriveService() {
  const settings = DatabaseService.getSettings()
  
  if (!settings.googleServiceAccountJson) {
    throw new Error('Google Service Account JSON is not configured.')
  }
  
  let credentials
  try {
    credentials = JSON.parse(settings.googleServiceAccountJson)
  } catch (error) {
    throw new Error('Invalid Google Service Account JSON configuration.')
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })

  return google.drive({ version: 'v3', auth })
}
