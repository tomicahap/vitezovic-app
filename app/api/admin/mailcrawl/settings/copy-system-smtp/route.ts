import { NextRequest, NextResponse } from 'next/server'
import { SettingsService } from '@/src/services/settings-service'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'

export async function GET(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response
  try {
    const settingsService = new SettingsService()
    const appSettings = await settingsService.getSettings()
    if (!appSettings) {
      return NextResponse.json({ ok: false, error: 'Postavke sustava nisu pronađene.' }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      smtp: {
        smtp_host: appSettings.smtpHost || '',
        smtp_port: String(appSettings.smtpPort || '465'),
        smtp_user: appSettings.smtpUser || '',
        smtp_pass: appSettings.smtpPass || '',
        smtp_secure: appSettings.smtpSecure ? 'true' : 'false',
        sender_email: appSettings.smtpFrom || appSettings.smtpUser || '',
        sender_name: 'Hrvatsko rodoslovno društvo'
      }
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
