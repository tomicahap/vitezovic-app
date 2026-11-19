import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { SettingsService } from '@/src/services/settings-service'
import { TrashService, extractActor } from '@/lib/trash'

const settingsService = new SettingsService();

export const dynamic = 'force-dynamic'
export const revalidate = 0

function toAssetProxyUrl(type: 'logo' | 'slip' | 'qr', rawValue: unknown): string | null {
  if (typeof rawValue !== 'string') return null
  const trimmed = rawValue.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('data:')) {
    const hash = crypto.createHash('sha1').update(trimmed).digest('hex').slice(0, 10)
    return `/api/settings/asset?type=${type}&v=${hash}`
  }
  return trimmed
}

function buildSettingsFlags(settings: Record<string, any>) {
  return {
    hasGoogleServiceAccount: Boolean(settings?.googleServiceAccountJson && String(settings.googleServiceAccountJson).trim()),
    hasDropboxConfig: Boolean(
      settings?.dropboxAppKey &&
      settings?.dropboxAppSecret &&
      settings?.dropboxRefreshToken
    ),
    hasSmtpPass: Boolean(settings?.smtpPass && String(settings.smtpPass).trim()),
  }
}

export async function GET(request: NextRequest) {
  try {
    const settings = (await settingsService.getSettings()) as Record<string, any> | null
    if (!settings) {
      return NextResponse.json({})
    }

    const { searchParams } = new URL(request.url)
    const scope = (searchParams.get('scope') || 'lite').trim().toLowerCase()
    const actor = extractActor(request)
    const isAdmin = (actor.role || '').trim().toLowerCase() === 'admin'

    const basePayload = {
      ...settings,
      logoUrl: toAssetProxyUrl('logo', settings.logoUrl),
      paymentSlipUrl: toAssetProxyUrl('slip', settings.paymentSlipUrl),
      paymentQrUrl: toAssetProxyUrl('qr', settings.paymentQrUrl),
      ...buildSettingsFlags(settings),
    }

    if (scope === 'admin') {
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Pristup punim postavkama dopušten je samo administratoru.' },
          { status: 403 }
        )
      }
      const { adminPassword: _hiddenAdminPwd, ...safeAdminPayload } = basePayload as any
      return NextResponse.json(safeAdminPayload, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    // Lite payload: bez tajni i bez teških base64 slika
    const {
      adminPassword: _adminPassword,
      adminBackupPassword: _adminBackupPassword,
      smtpPass: _smtpPass,
      dropboxAppSecret: _dropboxAppSecret,
      dropboxRefreshToken: _dropboxRefreshToken,
      googleServiceAccountJson: _googleServiceAccountJson,
      vaultNotes: _vaultNotes,
      ...liteBase
    } = basePayload as any

    if (!isAdmin) {
      delete liteBase.adminPersonalNotes
      delete liteBase.adminPersonalTodos
      delete liteBase.adminBackupEmail
      delete liteBase.smtpUser
      delete liteBase.smtpHost
      delete liteBase.dropboxAppKey
    }

    return NextResponse.json(liteBase, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error: any) {
    console.error('Greška pri dohvaćanju postavki:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const adminOnlyFields = [
      'maintenanceMode',
      'adminInactivityEnabled',
      'adminInactivityDays',
      'adminPassword',
      'adminBackupPassword',
      'adminBackupEmail',
      'smtpPass',
      'dropboxAppSecret',
      'dropboxRefreshToken',
      'googleServiceAccountJson',
      'vaultNotes',
    ]
    if (adminOnlyFields.some((field) => body[field] !== undefined)) {
      const actor = extractActor(request, body)
      const roleLower = (actor.role || '').trim().toLowerCase()
      if (roleLower !== 'admin') {
        return NextResponse.json(
          { error: 'Samo administrator može mijenjati sigurnosne postavke sustava.' },
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
