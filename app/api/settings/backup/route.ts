import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'
import fs from 'fs'
import path from 'path'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const download = searchParams.get('download')
    const name = searchParams.get('name')

    if (download === 'true') {
      const dbPath = DatabaseService.getDatabasePath()
      if (!fs.existsSync(dbPath)) {
        return NextResponse.json({ error: 'Database file not found' }, { status: 404 })
      }
      const fileBuffer = fs.readFileSync(dbPath)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="cms_backup_${timestamp}.db"`,
        },
      })
    }

    if (name) {
      const backupDir = path.join(process.cwd(), 'data', 'backups')
      const filePath = path.join(backupDir, name)
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'Backup not found' }, { status: 404 })
      }
      const fileBuffer = fs.readFileSync(filePath)
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${name}"`,
        },
      })
    }

    const backups = DatabaseService.listBackups()
    return NextResponse.json(backups)
  } catch (error) {
    console.error('Error listing/downloading backups:', error)
    return NextResponse.json({ error: 'Failed to process backup request' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const backupPath = await DatabaseService.backupDatabase()
    const fileName = path.basename(backupPath)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Backup created successfully',
      file: fileName
    })
  } catch (error) {
    console.error('Error creating backup:', error)
    return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 })
  }
}


