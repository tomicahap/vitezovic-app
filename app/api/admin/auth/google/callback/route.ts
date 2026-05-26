import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'
import { google } from 'googleapis'

export async function GET(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host
  const proto = request.headers.get('x-forwarded-proto') || 'http'
  const actualProto = (host.includes('localhost') || host.includes('127.0.0.1')) ? proto : 'https'
  const actualOrigin = `${actualProto}://${host}`

  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      console.error('Google OAuth callback error param:', errorParam)
      return NextResponse.redirect(`${actualOrigin}/settings?google_auth=error&details=${encodeURIComponent(errorParam)}`)
    }

    if (!code) {
      return NextResponse.redirect(`${actualOrigin}/settings?google_auth=error&details=missing_code`)
    }

    const settings = DatabaseService.getSettings()
    const clientId = settings.googleClientId
    const clientSecret = settings.googleClientSecret

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${actualOrigin}/settings?google_auth=error&details=missing_config`)
    }

    const redirectUri = `${actualOrigin}/api/admin/auth/google/callback`

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    )

    // Razmjenjujemo autorizacijski kod za tokene
    const { tokens } = await oauth2Client.getToken(code)
    
    const refreshToken = tokens.refresh_token

    if (!refreshToken) {
      console.warn('[OAuthCallback] Refresh token je izostao iz odgovora. Provjeravamo imamo li već jedan.')
      const existingToken = settings.googleRefreshToken
      if (!existingToken) {
        return NextResponse.redirect(
          `${actualOrigin}/settings?google_auth=error&details=missing_refresh_token`
        )
      }
    } else {
      // Spremamo novi Refresh Token u bazu podataka
      DatabaseService.updateSettings({
        googleRefreshToken: refreshToken
      })
      console.log('[OAuthCallback] Google Refresh Token uspješno primljen i spremljen u bazu.')
    }

    return NextResponse.redirect(`${actualOrigin}/settings?google_auth=success`)
  } catch (error: any) {
    console.error('Google OAuth callback error:', error)
    return NextResponse.redirect(
      `${actualOrigin}/settings?google_auth=error&details=${encodeURIComponent(error.message || 'unknown')}`
    )
  }
}
