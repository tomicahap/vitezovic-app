import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'
import { getDriveService } from '@/lib/google-drive'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { googleServiceAccountJson, googleDriveFolderId, googleDriveBackupFolderId, action } = body

    if (action === 'test') {
      try {
        // Temporarily override to test if not yet saved, or use provided values
        const auth = await (async () => {
          const { google } = await import('googleapis')
          const credentials = JSON.parse(googleServiceAccountJson)
          const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive'],
          })
          return auth
        })()
        
        const google = await import('googleapis')
        const drive = google.google.drive({ version: 'v3', auth })
        
        // Test primary folder or backup folder depending on what is sent or test both
        const folderToTest = googleDriveBackupFolderId || googleDriveFolderId
        
        const response = await drive.files.list({
          q: `'${folderToTest}' in parents and trashed = false`,
          pageSize: 1,
          fields: 'files(id, name)',
        })

        if (response.status === 200) {
          return NextResponse.json({ success: true, message: 'Veza uspješna!' })
        } else {
          return NextResponse.json({ success: false, message: 'Neuspješna provjera mape.' }, { status: 400 })
        }
      } catch (err: any) {
        return NextResponse.json({ success: false, message: `Greška: ${err.message}` }, { status: 400 })
      }
    }

    // Save settings
    DatabaseService.updateSettings({
      googleServiceAccountJson,
      googleDriveFolderId,
      googleDriveBackupFolderId
    })

    return NextResponse.json({ success: true, message: 'Postavke su spremljene.' })
  } catch (error: any) {
    console.error('Error in google-drive settings route:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}
