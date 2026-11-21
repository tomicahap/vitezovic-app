import 'server-only'

export interface SerperSearchResult {
  title: string
  url: string
  snippet: string
  phone?: string
  address?: string
  category?: string
  source?: string
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

function extractSerperErrorMessage(status: number, bodyText: string): string {
  const lower = bodyText.toLowerCase()
  if (status === 401 || status === 403 || lower.includes('unauthorized') || lower.includes('invalid api key')) {
    return 'Nevažeći Serper.dev API ključ (401/403). Provjerite jeste li unijeli točan ključ s serper.dev računa.'
  }
  if (status === 429 || lower.includes('credit') || lower.includes('quota') || lower.includes('rate limit')) {
    return 'Serper.dev kvota ili krediti su privremeno iscrpljeni (429). Provjerite stanje kredita na serper.dev.'
  }
  if (status === 400) {
    return `Neispravan zahtjev prema Serper.dev API-ju (400): ${bodyText.slice(0, 140)}`
  }
  return `Serper.dev API greška (${status}): ${bodyText.slice(0, 160)}`
}

export async function serperSearchPlaces(
  query: string,
  apiKey: string,
  externalSignal?: AbortSignal
): Promise<SerperSearchResult[]> {
  const cleanKey = (apiKey || '').trim()
  const cleanQuery = (query || '').trim()
  if (!cleanKey || !cleanQuery || externalSignal?.aborted) return []

  const { signal, cleanup } = createCombinedSignal(8000, externalSignal)
  try {
    const res = await fetch('https://google.serper.dev/places', {
      method: 'POST',
      signal,
      headers: {
        'X-API-KEY': cleanKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: cleanQuery,
        gl: 'hr',
        hl: 'hr',
      }),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.warn('[Serper Places]', extractSerperErrorMessage(res.status, txt))
      return []
    }

    const data = await res.json()
    const places = Array.isArray(data?.places) ? data.places : []
    const out: SerperSearchResult[] = []

    for (const p of places) {
      const title = String(p?.title || '').trim()
      const website = String(p?.website || '').trim()
      if (!title || !website || !website.startsWith('http')) continue

      const parts = [p?.category, p?.address, p?.phoneNumber].filter(Boolean).map(String)
      out.push({
        title,
        url: website,
        snippet: parts.join(' · '),
        phone: p?.phoneNumber ? String(p.phoneNumber).trim() : undefined,
        address: p?.address ? String(p.address).trim() : undefined,
        category: p?.category ? String(p.category).trim() : undefined,
        source: 'Serper Google Places',
      })
    }

    return out
  } catch (err: any) {
    if (!externalSignal?.aborted) {
      console.warn('[Serper Places] Greška:', err?.message || err)
    }
    return []
  } finally {
    cleanup()
  }
}

export async function serperSearchOrganic(
  query: string,
  apiKey: string,
  num: number = 20,
  externalSignal?: AbortSignal
): Promise<SerperSearchResult[]> {
  const cleanKey = (apiKey || '').trim()
  const cleanQuery = (query || '').trim()
  if (!cleanKey || !cleanQuery || externalSignal?.aborted) return []

  const { signal, cleanup } = createCombinedSignal(8000, externalSignal)
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      signal,
      headers: {
        'X-API-KEY': cleanKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: cleanQuery,
        gl: 'hr',
        hl: 'hr',
        num: Math.min(Math.max(Number(num) || 20, 5), 50),
      }),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.warn('[Serper Organic]', extractSerperErrorMessage(res.status, txt))
      return []
    }

    const data = await res.json()
    const organic = Array.isArray(data?.organic) ? data.organic : []
    const out: SerperSearchResult[] = []

    for (const item of organic) {
      const link = String(item?.link || '').trim()
      const title = String(item?.title || '').trim()
      if (!link || !link.startsWith('http')) continue
      out.push({
        title: title || link,
        url: link,
        snippet: String(item?.snippet || '').trim(),
        source: 'Serper Google Search',
      })
    }

    return out
  } catch (err: any) {
    if (!externalSignal?.aborted) {
      console.warn('[Serper Organic] Greška:', err?.message || err)
    }
    return []
  } finally {
    cleanup()
  }
}

export async function testSerperApiKey(apiKey: string): Promise<{
  ok: boolean
  credits?: number
  resultCount: number
  message: string
}> {
  const cleanKey = (apiKey || '').trim()
  if (!cleanKey) {
    throw new Error('Unesite Serper.dev API ključ prije testiranja.')
  }

  const { signal, cleanup } = createCombinedSignal(10000)
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      signal,
      headers: {
        'X-API-KEY': cleanKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: 'Hrvatsko rodoslovno društvo',
        gl: 'hr',
        hl: 'hr',
        num: 3,
      }),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(extractSerperErrorMessage(res.status, txt))
    }

    const data = await res.json()
    const resultCount = Array.isArray(data?.organic) ? data.organic.length : 0
    const credits = typeof data?.credits === 'number' ? data.credits : undefined

    return {
      ok: true,
      credits,
      resultCount,
      message: `Serper.dev veza uspješna! Vraćeno ${resultCount} rezultata.${
        credits !== undefined ? ` Preostalo kredita: ${credits}.` : ''
      }`,
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Vrijeme čekanja na Serper.dev API je isteklo (timeout 10 s).')
    }
    throw new Error(err?.message || 'Neuspješno povezivanje na Serper.dev API.')
  } finally {
    cleanup()
  }
}
