import { NextRequest, NextResponse } from 'next/server'
import { getGoogleWorkspaceClients, formatDriveError } from '@/lib/google-auth'
import { DatabaseService } from '@/lib/database'

export const dynamic = 'force-dynamic'

// Helper to get role from Bearer token (which is currently the role string itself)
function getRole(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return null
  return authHeader.replace('Bearer ', '').trim()
}

interface StorageCache {
  totalBytes: number
  fileCount: number
  folderCount: number
  timestamp: number
}

let storageCache: StorageCache | null = null

function invalidateStorageCache() {
  storageCache = null
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

  const settings = DatabaseService.getSettings()
  const parentId = folderId || settings?.googleDriveFolderId || ''
  const targetEmail = (settings?.gmailMailbox || '').trim()

  try {
    if (!settings?.googleServiceAccountJson || !settings?.googleDriveFolderId) {
      return NextResponse.json(
        {
          error:
            'Google Drive nije konfiguriran. U Postavkama unesite Service Account JSON ključ i Target Folder ID.',
        },
        { status: 400 }
      )
    }

    const { drive } = getGoogleWorkspaceClients({ requireTargetEmail: false })

    // A. Akcija: Kvote i zauzeće prostora
    if (action === 'quota') {
      let limit = 15 * 1024 * 1024 * 1024 // 15 GB zadano za Google račun
      let usage = 0
      let fileCount = 0
      let folderCount = 0

      // Pokušaj dohvatiti službenu kvotu impersoniranog računa
      try {
        const aboutRes = await drive.about.get({ fields: 'storageQuota' })
        const sq = aboutRes.data.storageQuota
        if (sq?.limit && parseInt(sq.limit, 10) > 0) {
          limit = parseInt(sq.limit, 10)
        }
        if (sq?.usage && parseInt(sq.usage, 10) > 0) {
          usage = parseInt(sq.usage, 10)
        }
      } catch (err) {
        console.warn('drive.about.get failed, fallback to file calculation', err)
      }

      // Izračunaj broj datoteka i mapa (i zauzeće ako je usage 0)
      const now = Date.now()
      if (storageCache && now - storageCache.timestamp < 120000) {
        if (usage === 0) usage = storageCache.totalBytes
        fileCount = storageCache.fileCount
        folderCount = storageCache.folderCount
      } else {
        let pageToken: string | undefined = undefined
        let totalBytes = 0
        let files = 0
        let folders = 0

        do {
          const listRes: any = await drive.files.list({
            q: 'trashed = false',
            fields: 'nextPageToken, files(id, size, mimeType)',
            pageSize: 1000,
            pageToken,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          })
          for (const f of listRes.data.files || []) {
            if (f.mimeType === 'application/vnd.google-apps.folder') {
              folders++
            } else {
              files++
              if (f.size) totalBytes += parseInt(f.size, 10)
            }
          }
          pageToken = listRes.data.nextPageToken || undefined
        } while (pageToken)

        if (usage === 0) usage = totalBytes
        fileCount = files
        folderCount = folders
        storageCache = {
          totalBytes,
          fileCount,
          folderCount,
          timestamp: now,
        }
      }

      const free = Math.max(0, limit - usage)

      return NextResponse.json({
        quota: {
          limit: limit.toString(),
          usage: usage.toString(),
          free: free.toString(),
          fileCount,
          folderCount,
        },
      })
    }

    // B. Akcija: Download Proxy (Streaming datoteke kroz CMS)
    if (action === 'download' && fileId) {
      const fileMetadata = await drive.files.get({
        fileId,
        fields: 'name, mimeType',
        supportsAllDrives: true,
      })

      const response = await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' }
      )

      return new Response(response.data as any, {
        headers: {
          'Content-Type': fileMetadata.data.mimeType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(
            fileMetadata.data.name || 'file'
          )}"`,
        },
      })
    }

    // C. Akcija: List (Zaslon s datotekama)
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
      isRoot: parentId === settings.googleDriveFolderId,
      impersonatedAccount: targetEmail || null,
    })
  } catch (error: any) {
    const status = error?.code === 403 || error?.status === 403 ? 403 : 500
    console.error(
      `[Drive GET Error] (account: ${targetEmail || 'service-account'}, folderId: ${parentId}):`,
      error
    )
    return NextResponse.json(
      { error: formatDriveError(error, targetEmail, parentId) },
      { status }
    )
  }
}

export async function POST(request: NextRequest) {
  const role = getRole(request)
  if (!role) {
    return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 })
  }

  const settings = DatabaseService.getSettings()
  const targetEmail = (settings?.gmailMailbox || '').trim()

  if (settings?.googleDriveOnlyDownload) {
    return NextResponse.json(
      {
        error:
          'Učitavanje je onemogućeno (Google Drive je u načinu rada samo za preuzimanje).',
      },
      { status: 403 }
    )
  }

  if (role !== 'admin' && role !== 'moderator' && role !== 'member') {
    return NextResponse.json({ error: 'Nemate dozvolu za dodavanje.' }, { status: 403 })
  }

  try {
    const { drive } = getGoogleWorkspaceClients({ requireTargetEmail: false })
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

      invalidateStorageCache()
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
      invalidateStorageCache()
      return NextResponse.json({ folder: response.data })
    }
  } catch (error: any) {
    const status = error?.code === 403 || error?.status === 403 ? 403 : 500
    console.error(`[Drive POST Error] (account: ${targetEmail || 'service-account'}):`, error)
    return NextResponse.json(
      { error: formatDriveError(error, targetEmail) },
      { status }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const role = getRole(request)
  const settings = DatabaseService.getSettings()
  const targetEmail = (settings?.gmailMailbox || '').trim()

  if (settings?.googleDriveOnlyDownload) {
    return NextResponse.json(
      {
        error:
          'Brisanje je onemogućeno (Google Drive je u načinu rada samo za preuzimanje).',
      },
      { status: 403 }
    )
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
    const { drive } = getGoogleWorkspaceClients({ requireTargetEmail: false })
    await drive.files.update({
      fileId,
      requestBody: { trashed: true },
      supportsAllDrives: true,
    })
    invalidateStorageCache()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    const status = error?.code === 403 || error?.status === 403 ? 403 : 500
    console.error(`[Drive DELETE Error] (account: ${targetEmail || 'service-account'}, fileId: ${fileId}):`, error)
    return NextResponse.json(
      { error: formatDriveError(error, targetEmail, fileId) },
      { status }
    )
  }
}
