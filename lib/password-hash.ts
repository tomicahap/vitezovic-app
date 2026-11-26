import 'server-only'
import crypto from 'crypto'

const SCRYPT_PREFIX = 'scrypt$'
const SCRYPT_KEYLEN = 64

export function isHashedPassword(stored?: string | null): boolean {
  if (!stored || typeof stored !== 'string') return false
  const parts = stored.split('$')
  return parts.length === 3 && parts[0] === 'scrypt' && parts[1].length >= 16 && parts[2].length === 128
}

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(plain, salt, SCRYPT_KEYLEN).toString('hex')
  return `${SCRYPT_PREFIX}${salt}$${derived}`
}

export function verifyPassword(plain: string, stored?: string | null): boolean {
  if (typeof plain !== 'string' || !stored || typeof stored !== 'string') return false

  if (isHashedPassword(stored)) {
    const [, salt, hexKey] = stored.split('$')
    try {
      const derived = crypto.scryptSync(plain, salt, SCRYPT_KEYLEN)
      const expected = Buffer.from(hexKey, 'hex')
      if (derived.length !== expected.length) return false
      return crypto.timingSafeEqual(derived, expected)
    } catch {
      return false
    }
  }

  // Kompatibilnost s postojećim plain-text lozinkama prije automatske nadogradnje
  const plainBuf = Buffer.from(plain, 'utf8')
  const storedBuf = Buffer.from(stored, 'utf8')
  if (plainBuf.length !== storedBuf.length) return false
  return crypto.timingSafeEqual(plainBuf, storedBuf)
}
