import { NextRequest, NextResponse } from 'next/server'
import { SettingsService } from '@/src/services/settings-service'
import { TrashService, extractActor } from '@/lib/trash'

const settingsService = new SettingsService();

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
    if (body.maintenanceMode !== undefined) {
      const actor = extractActor(request, body)
      const roleLower = (actor.role || '').trim().toLowerCase()
      if (roleLower !== 'admin') {
        return NextResponse.json(
          { error: 'Samo administrator može uključiti ili isključiti način održavanja.' },
          { status: 403 }
        )
      }
    }
    if (body.adminPersonalTodos !== undefined) {
      const actor = extractActor(request, body)
      const currentSettings = await settingsService.getSettings()
      TrashService.checkAndTrashAdminTodosUpdate(
        currentSettings?.adminPersonalTodos,
        body.adminPersonalTodos,
        actor
      )
    }
    await settingsService.updateSettings(body)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Greška pri ažuriranju postavki:', error)
    return NextResponse.json({ 
      error: error.message || 'Interna greška poslužitelja.',
    }, { status: 500 })
  }
}
