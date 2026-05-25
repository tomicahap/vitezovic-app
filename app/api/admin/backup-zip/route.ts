import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'
import fs from 'fs'
import path from 'path'

// Pomoćna funkcija za provjeru uloge admina
function checkAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization')
  if (authHeader) {
    const role = authHeader.replace('Bearer ', '').trim()
    if (role === 'admin') return true
  }
  const { searchParams } = new URL(request.url)
  const roleParam = searchParams.get('role')
  return roleParam === 'admin'
}

export async function GET(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Niste autorizirani za ovu akciju.' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const filename = searchParams.get('filename')

    if (action === 'download' && filename) {
      const backupDir = path.join(process.cwd(), 'data', 'backups')
      const filePath = path.join(backupDir, filename)

      // Prevencija Directory Traversal napada
      const resolvedPath = path.resolve(filePath)
      const resolvedBackupDir = path.resolve(backupDir)
      if (!resolvedPath.startsWith(resolvedBackupDir)) {
        return NextResponse.json({ error: 'Nevažeća putanja.' }, { status: 400 })
      }

      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'Sigurnosna kopija ne postoji.' }, { status: 404 })
      }

      const fileBuffer = fs.readFileSync(filePath)
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    // Defaultno vraća popis svih zip backupa
    const backups = DatabaseService.listZipBackups()
    return NextResponse.json(backups)
  } catch (error: any) {
    console.error('Backup ZIP GET error:', error)
    return NextResponse.json({ error: error.message || 'Greška pri obradi zahtjeva.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Niste autorizirani za ovu akciju.' }, { status: 403 })
  }

  try {
    console.log('[BackupAPI] Pokretanje ručne izrade cjelokupnog backupa...')
    const zipPath = await DatabaseService.createCompleteBackup()
    const fileName = path.basename(zipPath)
    
    const settings = DatabaseService.getSettings()
    let driveFileId = ''
    let uploadedToDrive = false
    let driveError = ''

    if (settings.googleServiceAccountJson && settings.googleDriveFolderId) {
      try {
        driveFileId = await DatabaseService.uploadBackupToDrive(zipPath)
        uploadedToDrive = true
        console.log(`[BackupAPI] Backup uspješno poslan na Google Drive: ${driveFileId}`)
      } catch (driveErr: any) {
        console.error('[BackupAPI] Google Drive upload failed:', driveErr)
        driveError = driveErr.message || 'Neuspješan prijenos na Google Drive.'
      }
    }

    // Ažuriraj zadnje vrijeme backupa u bazi
    const now = new Date()
    DatabaseService.updateLastBackupTime(now.toISOString())

    return NextResponse.json({
      success: true,
      message: 'Cjelokupna sigurnosna kopija stvorena.',
      filename: fileName,
      uploadedToDrive,
      driveFileId,
      driveError
    })
  } catch (error: any) {
    console.error('Backup ZIP POST error:', error)
    return NextResponse.json({ error: error.message || 'Neuspjelo stvaranje sigurnosne kopije.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Niste autorizirani za ovu akciju.' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const filename = searchParams.get('filename')

    if (!filename) {
      return NextResponse.json({ error: 'Nedostaje naziv datoteke.' }, { status: 400 })
    }

    const backupDir = path.join(process.cwd(), 'data', 'backups')
    const filePath = path.join(backupDir, filename)

    // Prevencija Directory Traversal
    const resolvedPath = path.resolve(filePath)
    const resolvedBackupDir = path.resolve(backupDir)
    if (!resolvedPath.startsWith(resolvedBackupDir)) {
      return NextResponse.json({ error: 'Nevažeća putanja.' }, { status: 400 })
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Sigurnosna kopija ne postoji.' }, { status: 404 })
    }

    fs.unlinkSync(filePath)
    console.log(`[BackupAPI] Obrisana lokalna kopija: ${filename}`)

    return NextResponse.json({ success: true, message: 'Sigurnosna kopija je obrisana s diska.' })
  } catch (error: any) {
    console.error('Backup ZIP DELETE error:', error)
    return NextResponse.json({ error: error.message || 'Greška pri brisanju kopije.' }, { status: 500 })
  }
}
