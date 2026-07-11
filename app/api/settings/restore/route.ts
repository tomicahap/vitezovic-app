import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nije priložena datoteka.' }, { status: 400 })
    }

    // SQLite files usually end with .db or .sqlite, backups can be .zip
    if (!file.name.endsWith('.db') && !file.name.endsWith('.sqlite') && !file.name.endsWith('.zip')) {
      return NextResponse.json({ error: 'Neispravan format datoteke. Molimo učitajte .db ili .zip datoteku.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Pre-restore auto-backup to Dropbox
    const { runPreRestoreBackup } = await import('@/lib/backup')
    const preBackupResult = await runPreRestoreBackup()
    
    let backupMessage = ''
    if (preBackupResult.success) {
      backupMessage = ' ' + preBackupResult.message
    } else {
      console.warn('Pre-restore backup failed or skipped:', preBackupResult.message)
      backupMessage = ' (Pre-restore backup preskočen ili nije uspio)'
    }

    await DatabaseService.restoreDatabase(buffer, file.name)

    return NextResponse.json({ 
      success: true, 
      message: 'Baza podataka je uspješno vraćena.' + backupMessage + ' Aplikacija se može ponovno učitati.' 
    })
  } catch (error: any) {
    console.error('Restore API error:', error)
    return NextResponse.json({ 
      error: 'Greška pri obnavljanju baze podataka.', 
      details: error.message 
    }, { status: 500 })
  }
}
