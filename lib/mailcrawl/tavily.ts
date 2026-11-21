import 'server-only'
import type { SerperSearchResult } from './serper'

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

function extractTavilyErrorMessage(status: number, bodyText: string): string {
  const lower = bodyText.toLowerCase()
  if (status === 401 || status === 403 || lower.includes('unauthorized') || lower.includes('invalid api key')) {
    return 'Nevažeći Tavily API ključ (401/403). Provjerite jeste li unijeli točan tvly-... ključ.'
  }
  if (
    status === 429 ||
    status === 432 ||
    status === 433 ||
    lower.includes('credit') ||
    lower.includes('limit') ||
    lower.includes('quota')
  ) {
    return `Tavily mjesečna kvota ili ograničenje zahtjeva je dosegnuto (${status}). Sustav automatski prelazi na besplatni web fallback.`
  }
  if (status === 400) {
    return `Neispravan zahtjev prema Tavily API-ju (400): ${bodyText.slice(0, 140)}`
  }
  return `Tavily API greška (${status}): ${bodyText.slice(0, 160)}`
}

export async function tavilySearch(
  query: string,
  apiKey: string,
  maxResults: number = 15,
  externalSignal?: AbortSignal
): Promise<SerperSearchResult[]> {
  const cleanKey = (apiKey || '').trim()
  const cleanQuery = (query || '').trim()
  if (!cleanKey || !cleanQuery || externalSignal?.aborted) return []

  const { signal, cleanup } = createCombinedSignal(9000, externalSignal)
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${cleanKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: cleanQuery,
        search_depth: 'basic',
        max_results: Math.min(Math.max(Number(maxResults) || 15, 5), 20),
        include_answer: false,
        include_raw_content: false,
        include_images: false,
        topic: 'general',
      }),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.warn('[Tavily Search]', extractTavilyErrorMessage(res.status, txt))
      return []
    }

    const data = await res.json().catch(() => ({}))
    const results = Array.isArray(data?.results) ? data.results : []
    const out: SerperSearchResult[] = []

    for (const item of results) {
      const link = String(item?.url || '').trim()
      if (!link || !link.startsWith('http')) continue
      const title = String(item?.title || link).trim()
      const snippet = String(item?.content || '').trim().slice(0, 400)
      out.push({
        title,
        url: link,
        snippet,
        source: 'Tavily Search',
      })
    }

    return out
  } catch (err: any) {
    if (!externalSignal?.aborted) {
      console.warn('[Tavily Search] Greška:', err?.message || err)
    }
    return []
  } finally {
    cleanup()
  }
}

export async function testTavilyApiKey(apiKey: string): Promise<{
  ok: boolean
  resultCount: number
  message: string
}> {
  const cleanKey = (apiKey || '').trim()
  if (!cleanKey) {
    throw new Error('Unesite Tavily API ključ (tvly-...) prije testiranja.')
  }

  const { signal, cleanup } = createCombinedSignal(10000)
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${cleanKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'Hrvatsko rodoslovno društvo',
        search_depth: 'basic',
        max_results: 3,
        include_answer: false,
        include_raw_content: false,
        include_images: false,
        topic: 'general',
      }),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(extractTavilyErrorMessage(res.status, txt))
    }

    const data = await res.json().catch(() => ({}))
    const results = Array.isArray(data?.results) ? data.results : []

    return {
      ok: true,
      resultCount: results.length,
      message: `Tavily API ključ je valjan! Pronađeno ${results.length} rezultata (besplatni plan: 1.000 kredita/mj.).`,
    }
  } catch (err: any) {
    if (err?.name === 'AbortError' || String(err?.message).includes('Timeout')) {
      throw new Error('Veza prema Tavily API-ju je istekla (timeout). Pokušajte ponovno.')
    }
    throw err
  } finally {
    cleanup()
  }
}
