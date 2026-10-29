import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'
import {
  getGoogleWorkspaceClients,
  validateServiceAccountJson,
  formatDriveError,
} from '@/lib/google-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { googleServiceAccountJson, googleDriveFolderId, gmailMailbox, action } = body

    const currentSettings = DatabaseService.getSettings()
    const jsonToUse = googleServiceAccountJson ?? currentSettings?.googleServiceAccountJson
    const folderIdToUse = (googleDriveFolderId ?? currentSettings?.googleDriveFolderId ?? '').trim()
    const targetEmailToUse = (gmailMailbox ?? currentSettings?.gmailMailbox ?? '').trim()

    const validation = validateServiceAccountJson(jsonToUse)
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          message: validation.error || 'Neispravan Service Account JSON ključ.',
        },
        { status: 400 }
      )
    }

    if (action === 'test') {
      if (!folderIdToUse) {
        return NextResponse.json(
          {
            success: false,
            message: 'Unesite Google Drive Target Folder ID za testiranje pristupa mapi.',
          },
          { status: 400 }
        )
      }

      try {
        const { drive, targetEmail } = getGoogleWorkspaceClients({
          rawJsonOverride: jsonToUse,
          targetEmailOverride: targetEmailToUse,
          requireTargetEmail: false,
        })

        const [folderMeta, listRes] = await Promise.all([
          drive.files
            .get({
              fileId: folderIdToUse,
              fields: 'id, name',
              supportsAllDrives: true,
            })
            .catch(() => null),
          drive.files.list({
            q: `'${folderIdToUse}' in parents and trashed = false`,
            pageSize: 5,
            fields: 'files(id, name)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          }),
        ])

        if (listRes.status === 200) {
          const folderName = folderMeta?.data?.name ? `"${folderMeta.data.name}"` : folderIdToUse
          const identityInfo = targetEmail
            ? `impersonirani račun: ${targetEmail}`
            : `Service Account: ${validation.credentials?.client_email}`
          return NextResponse.json({
            success: true,
            message: `✓ Veza s Google Driveom uspješna! Pristup mapi ${folderName} potvrđen (${identityInfo}).`,
          })
        } else {
          return NextResponse.json(
            { success: false, message: 'Neuspješna provjera Google Drive mape.' },
            { status: 400 }
          )
        }
      } catch (err: any) {
        console.error('[Google Drive Test Error]:', err)
        return NextResponse.json(
          {
            success: false,
            message: formatDriveError(err, targetEmailToUse, folderIdToUse),
          },
          { status: 400 }
        )
      }
    }

    // Save unified Google Workspace settings
    const updatePayload: Record<string, any> = {}
    if (googleServiceAccountJson !== undefined) {
      updatePayload.googleServiceAccountJson = googleServiceAccountJson.trim()
    }
    if (googleDriveFolderId !== undefined) {
      updatePayload.googleDriveFolderId = googleDriveFolderId.trim()
    }
    if (gmailMailbox !== undefined && gmailMailbox.trim()) {
      updatePayload.gmailMailbox = gmailMailbox.trim()
    }

    DatabaseService.updateSettings(updatePayload)

    return NextResponse.json({
      success: true,
      message: 'Google Workspace i Drive postavke su uspješno spremljene.',
    })
  } catch (error: any) {
    console.error('Error in google-drive settings route:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
