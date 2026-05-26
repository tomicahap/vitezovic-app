import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'
import { google } from 'googleapis'

export async function GET(request: NextRequest) {
  try {
    const settings = DatabaseService.getSettings()
    const clientId = settings.googleClientId
    const clientSecret = settings.googleClientSecret

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Google Client ID i Client Secret moraju biti konfigurirani u postavkama.' },
        { status: 400 }
      )
    }

    // Dinamički određujemo origin kako bismo podržali i lokalni rad (localhost) i produkcijski server iza reverse proxyja (Nginx/Cloudflare)
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host
    const proto = request.headers.get('x-forwarded-proto') || 'http'
    const actualProto = (host.includes('localhost') || host.includes('127.0.0.1')) ? proto : 'https'
    const redirectUri = `${actualProto}://${host}/api/admin/auth/google/callback`

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    )

    // Generiramo autorizacijski URL s potrebnim opcijama
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Ključno za dobivanje Refresh Tokena koji traje beskonačno
      prompt: 'consent',     // Prisiljava Google da pošalje Refresh Token i ako se korisnik već jednom prijavio
      scope: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file'
      ]
    })

    return NextResponse.redirect(authUrl)
  } catch (error: any) {
    console.error('Google OAuth init error:', error)
    return NextResponse.json({ error: error.message || 'Greška pri inicijalizaciji Google prijave.' }, { status: 500 })
  }
}
