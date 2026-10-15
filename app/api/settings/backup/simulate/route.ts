import { NextRequest, NextResponse } from 'next/server'
import { simulateBackupRestore } from '@/lib/backup'

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    
    let buffer: Buffer | null = null
    let fileName = 'automatic_system_backup.zip'

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null

      if (file) {
        if (!file.name.endsWith('.zip') && !file.name.endsWith('.db') && !file.name.endsWith('.sqlite')) {
          return NextResponse.json(
            { error: 'Neispravan format datoteke. Molimo učitajte .zip ili .db sigurnosnu kopiju.' },
            { status: 400 }
          )
        }
        fileName = file.name
        const bytes = await file.arrayBuffer()
        buffer = Buffer.from(bytes)
      }
    }

    const report = await simulateBackupRestore(buffer, fileName)
    return NextResponse.json(report)
  } catch (error: any) {
    console.error('Simulation API error:', error)
    return NextResponse.json(
      { error: 'Greška pri pokretanju simulacije.', details: error.message },
      { status: 500 }
    )
  }
}
