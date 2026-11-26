import 'server-only'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import type { NextRequest, NextResponse } from 'next/server'
import { getDatabaseDir } from './db-path'

export const SESSION_COOKIE_NAME = 'hrd_session'
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 dana

export interface SessionPayload {
  id: number
  role: string
  email: string
  name: string
  iat: number
  exp: number
}

const globalForSession = globalThis as unknown as {
  __hrdSessionSecret?: string
}

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16) {
    return process.env.SESSION_SECRET.trim()
  }
  if (globalForSession.__hrdSessionSecret) {
    return globalForSession.__hrdSessionSecret
  }

  try {
    const dir = getDatabaseDir()
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const secretFile = path.join(dir, '.session-secret')
    if (fs.existsSync(secretFile)) {
      const saved = fs.readFileSync(secretFile, 'utf8').trim()
      if (saved.length >= 32) {
        globalForSession.__hrdSessionSecret = saved
        return saved
      }
    }
    const generated = crypto.randomBytes(48).toString('hex')
    fs.writeFileSync(secretFile, generated, { encoding: 'utf8', mode: 0o600 })
    globalForSession.__hrdSessionSecret = generated
    return generated
  } catch {
    const fallback = crypto
      .createHash('sha256')
      .update(process.cwd() + '|hrd-rodoslovac-session-key')
      .digest('hex')
    globalForSession.__hrdSessionSecret = fallback
    return fallback
  }
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url')
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function signData(dataB64: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(dataB64).digest('base64url')
}

export function createSessionToken(user: {
  id: number
  role: string
  email: string
  name: string
}): string {
  const now = Date.now()
  const payload: SessionPayload = {
    id: Number(user.id),
    role: String(user.role || 'member'),
    email: String(user.email || ''),
    name: String(user.name || ''),
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS * 1000,
  }
  const encoded = base64UrlEncode(JSON.stringify(payload))
  const sig = signData(encoded, getSessionSecret())
  return `${encoded}.${sig}`
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token || typeof token !== 'string') return null
  const dotIdx = token.indexOf('.')
  if (dotIdx <= 0) return null

  const encoded = token.slice(0, dotIdx)
  const providedSig = token.slice(dotIdx + 1)
  if (!encoded || !providedSig) return null

  try {
    const expectedSig = signData(encoded, getSessionSecret())
    const a = Buffer.from(providedSig, 'utf8')
    const b = Buffer.from(expectedSig, 'utf8')
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null
    }

    const decoded = JSON.parse(base64UrlDecode(encoded)) as SessionPayload
    if (!decoded || typeof decoded.exp !== 'number' || decoded.exp <= Date.now()) {
      return null
    }
    return decoded
  } catch {
    return null
  }
}

function readCookieFromRequest(request: NextRequest | Request, name: string): string | null {
  const nextReq = request as NextRequest
  if (nextReq.cookies && typeof nextReq.cookies.get === 'function') {
    const val = nextReq.cookies.get(name)?.value
    if (val) return val
  }
  const header = request.headers.get('cookie') || ''
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx <= 0) continue
    const k = part.slice(0, idx).trim()
    if (k === name) {
      return part.slice(idx + 1).trim()
    }
  }
  return null
}

export function getVerifiedSession(request: NextRequest | Request): SessionPayload | null {
  const raw = readCookieFromRequest(request, SESSION_COOKIE_NAME)
  if (!raw) return null
  try {
    return verifySessionToken(decodeURIComponent(raw))
  } catch {
    return verifySessionToken(raw)
  }
}

export function setSessionCookie(
  response: NextResponse,
  user: { id: number; role: string; email: string; name: string },
  request?: NextRequest | Request
): void {
  const token = createSessionToken(user)
  const proto = request?.headers.get('x-forwarded-proto') || ''
  const isHttps =
    proto.includes('https') ||
    (typeof request?.url === 'string' && request.url.startsWith('https://'))

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    secure: isHttps,
  })
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
