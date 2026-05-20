import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nije priložena datoteka.' }, { status: 400 })
    }

    // SQLite files usually end with .db or .sqlite
    if (!file.name.endsWith('.db')) {
      return NextResponse.json({ error: 'Neispravan format datoteke. Molimo učitajte .db datoteku.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    await DatabaseService.restoreDatabase(buffer)

    return NextResponse.json({ 
      success: true, 
      message: 'Baza podataka je uspješno vraćena. Aplikacija se može ponovno učitati.' 
    })
  } catch (error: any) {
    console.error('Restore API error:', error)
    return NextResponse.json({ 
      error: 'Greška pri obnavljanju baze podataka.', 
      details: error.message 
    }, { status: 500 })
  }
}
