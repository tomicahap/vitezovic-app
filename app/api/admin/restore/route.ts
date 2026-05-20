import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    
    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'Nevaljani podaci za restore.' }, { status: 400 })
    }

    console.log('Restore request received')

    return NextResponse.json({ 
      success: true, 
      message: 'Zahtjev primljen' 
    })
  } catch (error: any) {
    console.error('Restore error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}