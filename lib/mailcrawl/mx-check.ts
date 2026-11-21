import 'server-only'
import dns from 'dns/promises'

const MAX_MX_CACHE = 2000
const mxCache = new Map<string, boolean>()

function setCacheEntry(domain: string, valid: boolean) {
  if (mxCache.size >= MAX_MX_CACHE) {
    const firstKey = mxCache.keys().next().value
    if (firstKey) mxCache.delete(firstKey)
  }
  mxCache.set(domain, valid)
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('DNS_TIMEOUT')), timeoutMs)
    promise
      .then((val) => {
        clearTimeout(timer)
        resolve(val)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

/**
 * Brza DNS MX / A provjera domene e-mail adrese (cache do 2000 domena, timeout 2500 ms).
 * Vraća false isključivo kad je sigurno da domena ne postoji (ENOTFOUND/ENODATA bez MX i A zapisa).
 */
export async function hasValidMailDomain(email: string): Promise<boolean> {
  const clean = String(email || '').trim().toLowerCase()
  const atIdx = clean.lastIndexOf('@')
  if (atIdx <= 0) return false

  const domain = clean.slice(atIdx + 1)
  if (!domain || !domain.includes('.') || domain.length > 253) return false

  const cached = mxCache.get(domain)
  if (cached !== undefined) return cached

  try {
    const mxRecords = await withTimeout(dns.resolveMx(domain), 2500)
    if (Array.isArray(mxRecords) && mxRecords.length > 0) {
      setCacheEntry(domain, true)
      return true
    }
  } catch (err: any) {
    if (err?.message === 'DNS_TIMEOUT' || err?.code === 'ETIMEOUT' || err?.code === 'EAI_AGAIN') {
      // Privremeni DNS timeout ne odbacuje adresu
      return true
    }
  }

  // Fallback na A zapis (neki mali poslužitelji primaju poštu preko A zapisa bez eksplicitnog MX)
  try {
    const aRecords = await withTimeout(dns.resolve4(domain), 2000)
    if (Array.isArray(aRecords) && aRecords.length > 0) {
      setCacheEntry(domain, true)
      return true
    }
  } catch (err: any) {
    if (err?.message === 'DNS_TIMEOUT' || err?.code === 'ETIMEOUT' || err?.code === 'EAI_AGAIN') {
      return true
    }
    const code = String(err?.code || '')
    if (code === 'ENOTFOUND' || code === 'ENODATA' || code === 'NXDOMAIN' || code === 'ESERVFAIL') {
      setCacheEntry(domain, false)
      return false
    }
  }

  setCacheEntry(domain, false)
  return false
}
