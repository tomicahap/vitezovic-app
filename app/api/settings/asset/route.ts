import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { SettingsService } from '@/src/services/settings-service'

export const dynamic = 'force-dynamic'

const settingsService = new SettingsService()

const ASSET_FIELD_MAP = {
  logo: 'logoUrl',
  slip: 'paymentSlipUrl',
  qr: 'paymentQrUrl',
} as const

type AssetType = keyof typeof ASSET_FIELD_MAP

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawType = (searchParams.get('type') || '').trim() as AssetType
    const fieldName = ASSET_FIELD_MAP[rawType]

    if (!fieldName) {
      return NextResponse.json({ error: 'Neispravan tip resursa.' }, { status: 400 })
    }

    const settings = (await settingsService.getSettings()) as Record<string, any> | null
    const rawValue = typeof settings?.[fieldName] === 'string' ? settings[fieldName].trim() : ''

    if (!rawValue) {
      return new NextResponse(null, { status: 404 })
    }

    if (rawValue.startsWith('http://') || rawValue.startsWith('https://') || rawValue.startsWith('/')) {
      return NextResponse.redirect(new URL(rawValue, request.url))
    }

    const dataMatch = rawValue.match(/^data:([^;,]+)?(?:;base64)?,([\s\S]+)$/i)
    if (!dataMatch) {
      return new NextResponse(null, { status: 404 })
    }

    const mime = (dataMatch[1] || 'image/png').toLowerCase()
    const base64Body = dataMatch[2].replace(/\s+/g, '')
    const buffer = Buffer.from(base64Body, 'base64')
    const hash = crypto.createHash('sha1').update(rawValue).digest('hex').slice(0, 12)
    const etag = `"${hash}"`

    const ifNoneMatch = request.headers.get('if-none-match')
    if (ifNoneMatch && ifNoneMatch.replace(/W\//, '').trim() === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': searchParams.get('v')
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=3600',
        },
      })
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(buffer.length),
        ETag: etag,
        'Cache-Control': searchParams.get('v')
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=3600',
      },
    })
  } catch (error: any) {
    console.error('[Settings Asset GET Error]:', error)
    return NextResponse.json({ error: 'Greška pri dohvaćanju resursa.' }, { status: 500 })
  }
}
