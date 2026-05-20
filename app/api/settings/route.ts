import { NextRequest, NextResponse } from 'next/server'
import { SettingsService } from '@/src/services/settings-service'

const settingsService = new SettingsService();

export async function GET() {
  try {
    const settings = await settingsService.getSettings()
    return NextResponse.json(settings || {})
  } catch (error: any) {
    console.error('Greška pri dohvaćanju postavki:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    await settingsService.updateSettings(body)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Greška pri ažuriranju postavki:', error)
    return NextResponse.json({ 
      error: error.message || 'Interna greška poslužitelja.',
    }, { status: 500 })
  }
}
