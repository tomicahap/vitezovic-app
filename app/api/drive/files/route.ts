import { NextRequest, NextResponse } from 'next/server'
import { getDriveService } from '@/lib/google-drive'
import { DatabaseService } from '@/lib/database'

// Helper to get role from Bearer token (which is currently the role string itself)
function getRole(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return null
  return authHeader.replace('Bearer ', '').trim()
}

export async function GET(request: NextRequest) {
  const role = getRole(request)
  if (!role) {
    return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const folderId = searchParams.get('folderId')
  const action = searchParams.get('action')
  const fileId = searchParams.get('fileId')

  try {
    const settings = DatabaseService.getSettings()
    if (!settings.googleServiceAccountJson || !settings.googleDriveFolderId) {
      return NextResponse.json({ error: 'Google Drive nije konfiguriran.' }, { status: 400 })
    }

    const drive = await getDriveService()

    // A. Akcija: Kvote (Samo za Admina ili Moderatora)
    if (action === 'quota') {
      if (role !== 'admin' && role !== 'moderator') {
        return NextResponse.json({ error: 'Nemate dozvolu.' }, { status: 403 })
      }
      const response = await drive.about.get({ fields: 'storageQuota, user' })
      return NextResponse.json({ quota: response.data.storageQuota })
    }

    // B. Akcija: Download Proxy (Streaming datoteke kroz CMS)
    if (action === 'download' && fileId) {
      const fileMetadata = await drive.files.get({ 
        fileId, 
        fields: 'name, mimeType',
        supportsAllDrives: true 
      })
      
      const response = await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' }
      )

      return new Response(response.data as any, {
        headers: {
          'Content-Type': fileMetadata.data.mimeType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(fileMetadata.data.name || 'file')}"`,
        },
      })
    }

    // C. Akcija: List (Zaslon s datotekama)
    const parentId = folderId || settings.googleDriveFolderId
    const response = await drive.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, modifiedTime, size, webViewLink, webContentLink, iconLink)',
      orderBy: 'folder, name',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    return NextResponse.json({ 
      files: response.data.files || [],
      currentFolderId: parentId,
      isRoot: parentId === settings.googleDriveFolderId
    })
  } catch (error: any) {
    console.error('Error in Drive GET:', error)
    return NextResponse.json({ error: `Greška Google Drive-a: ${error.message}` }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const role = getRole(request)
  if (!role) {
    return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 })
  }

  const settings = DatabaseService.getSettings()
  if (settings.googleDriveOnlyDownload) {
    return NextResponse.json({ error: 'Učitavanje je onemogućeno (Google Drive je u načinu rada samo za preuzimanje).' }, { status: 403 })
  }

  // Svi prijavljeni (admin, moderator, member) mogu dodavati datoteke
  if (role !== 'admin' && role !== 'moderator' && role !== 'member') {
    return NextResponse.json({ error: 'Nemate dozvolu za dodavanje.' }, { status: 403 })
  }

  try {
    const drive = await getDriveService()
    const contentType = request.headers.get('content-type') || ''
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File
      const parentId = formData.get('parentId') as string
      
      if (!file || !parentId) {
        return NextResponse.json({ error: 'Nedostaje datoteka ili mapa.' }, { status: 400 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const { Readable } = require('stream')
      
      const response = await drive.files.create({
        requestBody: {
          name: file.name,
          parents: [parentId],
        },
        media: {
          mimeType: file.type,
          body: Readable.from(buffer),
        },
        fields: 'id, name, webViewLink, webContentLink',
        supportsAllDrives: true,
      })

      return NextResponse.json({ file: response.data })
    } else {
      const { name, parentId } = await request.json()
      const response = await drive.files.create({
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        },
        fields: 'id, name',
        supportsAllDrives: true,
      })
      return NextResponse.json({ folder: response.data })
    }
  } catch (error: any) {
    console.error('Error in Drive POST:', error)
    if (error.message.includes('storage quota')) {
      return NextResponse.json({ 
        error: "Servisni računi nemaju vlastiti prostor. Koristite 'Shared Drive' i dodajte servisni račun kao 'Upravitelja'." 
      }, { status: 403 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const role = getRole(request)
  const settings = DatabaseService.getSettings()
  if (settings.googleDriveOnlyDownload) {
    return NextResponse.json({ error: 'Brisanje je onemogućeno (Google Drive je u načinu rada samo za preuzimanje).' }, { status: 403 })
  }

  if (role !== 'admin') {
    return NextResponse.json({ error: 'Samo administrator može brisati datoteke.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const fileId = searchParams.get('fileId')

  if (!fileId) {
    return NextResponse.json({ error: 'Nedostaje fileId.' }, { status: 400 })
  }

  try {
    const drive = await getDriveService()
    // Premještanje u smeće (trash) umjesto trajnog brisanja
    // Ovo je sigurnije i češće dopušteno na Shared Drive-ovima
    await drive.files.update({
      fileId,
      requestBody: { trashed: true },
      supportsAllDrives: true
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting file:', error)
    if (error.message.includes('insufficient permissions')) {
      return NextResponse.json({ 
        error: "Nedovoljne ovlasti servisnog računa na Drive-u." 
      }, { status: 403 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

