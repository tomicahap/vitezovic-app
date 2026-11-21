import 'server-only'

const MAX_FIRECRAWL_CONCURRENT = 2

const globalForFirecrawl = globalThis as unknown as {
  __firecrawlActiveCount?: number
  __firecrawlWaitQueue?: Array<() => void>
  __firecrawlCooldownUntil?: Map<string, number>
}

function getCooldownMap(): Map<string, number> {
  if (!globalForFirecrawl.__firecrawlCooldownUntil) {
    globalForFirecrawl.__firecrawlCooldownUntil = new Map<string, number>()
  }
  return globalForFirecrawl.__firecrawlCooldownUntil
}

function getWaitQueue(): Array<() => void> {
  if (!globalForFirecrawl.__firecrawlWaitQueue) {
    globalForFirecrawl.__firecrawlWaitQueue = []
  }
  return globalForFirecrawl.__firecrawlWaitQueue
}

async function acquireFirecrawlSlot(externalSignal?: AbortSignal): Promise<boolean> {
  if (externalSignal?.aborted) return false

  const active = globalForFirecrawl.__firecrawlActiveCount || 0
  if (active < MAX_FIRECRAWL_CONCURRENT) {
    globalForFirecrawl.__firecrawlActiveCount = active + 1
    return true
  }

  return new Promise<boolean>((resolve) => {
    const queue = getWaitQueue()
    let settled = false

    const onAbort = () => {
      if (settled) return
      settled = true
      const idx = queue.indexOf(grant)
      if (idx >= 0) queue.splice(idx, 1)
      resolve(false)
    }

    const grant = () => {
      if (settled) return
      settled = true
      externalSignal?.removeEventListener('abort', onAbort)
      if (externalSignal?.aborted) {
        releaseFirecrawlSlot()
        resolve(false)
        return
      }
      resolve(true)
    }

    externalSignal?.addEventListener('abort', onAbort, { once: true })
    queue.push(grant)
  })
}

function releaseFirecrawlSlot() {
  const queue = getWaitQueue()
  while (queue.length > 0) {
    const next = queue.shift()
    if (next) {
      next()
      return
    }
  }
  const current = globalForFirecrawl.__firecrawlActiveCount || 0
  globalForFirecrawl.__firecrawlActiveCount = Math.max(0, current - 1)
}

function createCombinedSignal(timeoutMs: number, externalSignal?: AbortSignal): {
  signal: AbortSignal
  cleanup: () => void
} {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('Timeout')), timeoutMs)
  const onExternalAbort = () => controller.abort(externalSignal?.reason)

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason)
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true })
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer)
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort)
      }
    },
  }
}

function extractFirecrawlErrorMessage(status: number, bodyText: string): string {
  const lower = bodyText.toLowerCase()
  if (status === 401 || status === 403 || lower.includes('unauthorized') || lower.includes('invalid token')) {
    return 'Nevažeći Firecrawl API ključ (401/403). Provjerite jeste li unijeli točan fc-... ključ.'
  }
  if (status === 402 || lower.includes('insufficient credits') || lower.includes('payment required')) {
    return 'Firecrawl besplatni krediti su potrošeni (402). Pauziram Firecrawl na 5 min.'
  }
  if (status === 429 || lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Dosegnuto ograničenje brzine za Firecrawl (429). Pauziram nakratko radi zaštite kvote.'
  }
  if (status === 400) {
    return `Neispravan zahtjev prema Firecrawl API-ju (400): ${bodyText.slice(0, 140)}`
  }
  return `Firecrawl API greška (${status}): ${bodyText.slice(0, 160)}`
}

export interface FirecrawlScrapeResult {
  html: string
  markdown: string
  title: string
  description: string
}

export async function firecrawlScrapePage(
  url: string,
  apiKey: string,
  externalSignal?: AbortSignal
): Promise<FirecrawlScrapeResult | null> {
  const cleanKey = (apiKey || '').trim()
  const cleanUrl = (url || '').trim()
  if (!cleanKey || !cleanUrl || externalSignal?.aborted) return null

  const cooldownMap = getCooldownMap()
  const cooldownUntil = cooldownMap.get(cleanKey) || 0
  if (Date.now() < cooldownUntil) {
    return null
  }

  const acquired = await acquireFirecrawlSlot(externalSignal)
  if (!acquired) return null

  const { signal, cleanup } = createCombinedSignal(18000, externalSignal)
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${cleanKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: cleanUrl,
        formats: ['html', 'markdown'],
        onlyMainContent: false,
        timeout: 15000,
      }),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      const msg = extractFirecrawlErrorMessage(res.status, txt)
      console.warn('[Firecrawl Scrape]', msg)
      if (res.status === 401 || res.status === 403 || res.status === 402) {
        cooldownMap.set(cleanKey, Date.now() + 5 * 60 * 1000)
      } else if (res.status === 429) {
        cooldownMap.set(cleanKey, Date.now() + 30 * 1000)
      }
      return null
    }

    const payload = await res.json().catch(() => null)
    if (!payload?.success || !payload?.data) {
      return null
    }

    const d = payload.data
    return {
      html: String(d.html || d.rawHtml || ''),
      markdown: String(d.markdown || ''),
      title: String(d.metadata?.title || '').trim(),
      description: String(d.metadata?.description || '').trim(),
    }
  } catch (err: any) {
    if (!externalSignal?.aborted) {
      console.warn('[Firecrawl Scrape] Greška:', err?.message || err)
    }
    return null
  } finally {
    cleanup()
    releaseFirecrawlSlot()
  }
}

export async function testFirecrawlApiKey(apiKey: string): Promise<{
  ok: boolean
  title?: string
  message: string
}> {
  const cleanKey = (apiKey || '').trim()
  if (!cleanKey) {
    throw new Error('Unesite Firecrawl API ključ (fc-...) prije testiranja.')
  }

  // Test always clears prior cooldown for this key
  getCooldownMap().delete(cleanKey)

  const acquired = await acquireFirecrawlSlot()
  if (!acquired) {
    throw new Error('Nije moguće zauzeti Firecrawl slot za testiranje.')
  }

  const { signal, cleanup } = createCombinedSignal(18000)
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${cleanKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://example.com',
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 15000,
      }),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(extractFirecrawlErrorMessage(res.status, txt))
    }

    const payload = await res.json().catch(() => null)
    if (!payload?.success) {
      throw new Error(String(payload?.error || 'Firecrawl API nije vratio uspješan odgovor.'))
    }

    const title = payload?.data?.metadata?.title ? String(payload.data.metadata.title).trim() : undefined

    return {
      ok: true,
      title,
      message: 'Firecrawl API ključ je valjan! Testno čitanje uspješno (besplatni plan: 1.000 kredita/mj.).',
    }
  } catch (err: any) {
    if (err?.name === 'AbortError' || String(err?.message).includes('Timeout')) {
      throw new Error('Veza prema Firecrawl API-ju je istekla (timeout). Pokušajte ponovno.')
    }
    throw err
  } finally {
    cleanup()
    releaseFirecrawlSlot()
  }
}
