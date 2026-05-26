import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'
import { getDriveService } from '@/lib/google-drive'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      googleServiceAccountJson, 
      googleDriveFolderId, 
      googleDriveBackupFolderId, 
      googleClientId,
      googleClientSecret,
      googleRefreshToken,
      action 
    } = body

    if (action === 'test') {
      try {
        let auth
        
        // Ako su proslijeđeni klijent podaci za OAuth
        if (googleClientId && googleClientSecret) {
          const { google } = await import('googleapis')
          const existingSettings = DatabaseService.getSettings()
          const refreshToken = googleRefreshToken || existingSettings.googleRefreshToken
          
          if (!refreshToken) {
            return NextResponse.json({ 
              success: false, 
              message: 'Google račun još nije autoriziran (prvo unosite Client ID i Secret, kliknite Spremi, a potom Poveži Google račun).' 
            }, { status: 400 })
          }
          
          const oauth2Client = new google.auth.OAuth2(googleClientId, googleClientSecret)
          oauth2Client.setCredentials({ refresh_token: refreshToken })
          auth = oauth2Client
        } else if (googleServiceAccountJson) {
          // Service Account JSON
          const { google } = await import('googleapis')
          const credentials = JSON.parse(googleServiceAccountJson)
          auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive'],
          })
        } else {
          return NextResponse.json({ success: false, message: 'Nisu uneseni podaci za povezivanje.' }, { status: 400 })
        }
        
        const google = await import('googleapis')
        const drive = google.google.drive({ version: 'v3', auth: auth as any })
        
        const folderToTest = googleDriveBackupFolderId || googleDriveFolderId
        if (!folderToTest) {
          return NextResponse.json({ success: false, message: 'Nije definiran ID mape za provjeru.' }, { status: 400 })
        }
        
        const response = await drive.files.list({
          q: `'${folderToTest}' in parents and trashed = false`,
          pageSize: 1,
          fields: 'files(id, name)',
        })

        if (response.status === 200) {
          return NextResponse.json({ success: true, message: 'Veza s Google Driveom je uspješno uspostavljena!' })
        } else {
          return NextResponse.json({ success: false, message: 'Neuspješna provjera mape.' }, { status: 400 })
        }
      } catch (err: any) {
        return NextResponse.json({ success: false, message: `Greška pri provjeri: ${err.message}` }, { status: 400 })
      }
    }

    // Spremanje svih postavki
    DatabaseService.updateSettings({
      googleServiceAccountJson,
      googleDriveFolderId,
      googleDriveBackupFolderId,
      googleClientId,
      googleClientSecret
    })

    return NextResponse.json({ success: true, message: 'Google Drive postavke su uspješno spremljene.' })
  } catch (error: any) {
    console.error('Error in google-drive settings route:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}
