import 'server-only'
import { getAllUsedSearchTerms, getCampaignSettings } from './db'
import { CROATIAN_NICHE_CATEGORIES, CROATIAN_CITIES } from './constants'

export { CROATIAN_NICHE_CATEGORIES, CROATIAN_CITIES }

export interface GeneratedSearchTerm {
  id: string
  query: string
  city: string
  category: string
  reason?: string
}

function cleanNorm(str: string): string {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/[,\-./\s]+/g, ' ')
}

function fillFromCatalog(options: {
  targetCount: number
  filterCategory: string
  filterCity: string
  usedNormSet: Set<string>
  existing: GeneratedSearchTerm[]
}): GeneratedSearchTerm[] {
  const { targetCount, filterCategory, filterCity, usedNormSet, existing } = options
  const result = [...existing]
  if (result.length >= targetCount) return result.slice(0, targetCount)

  const activeCategories = filterCategory
    ? CROATIAN_NICHE_CATEGORIES.filter((c) =>
        c.category.toLowerCase().includes(filterCategory.toLowerCase())
      )
    : CROATIAN_NICHE_CATEGORIES

  const effectiveCategories =
    activeCategories.length > 0 ? activeCategories : CROATIAN_NICHE_CATEGORIES

  const citiesToUse = filterCity
    ? [filterCity]
    : [...CROATIAN_CITIES].sort(() => 0.5 - Math.random())

  const candidatePool: { query: string; city: string; category: string }[] = []

  // Upari svaki pojam sa svježim gradovima kako bismo dobili tisuće kombinacija bez ponavljanja
  for (const cat of effectiveCategories) {
    const shuffledTerms = [...cat.terms].sort(() => 0.5 - Math.random())
    for (const t of shuffledTerms) {
      const assignedCity =
        filterCity || citiesToUse[Math.floor(Math.random() * citiesToUse.length)]
      candidatePool.push({
        query: t,
        city: assignedCity,
        category: cat.category,
      })
    }
  }

  // Ako je tražen konkretan grad ili su jednoslojne kombinacije iscrpljene, dodaj i dodatne parove (pojam × drugi grad)
  if (!filterCity) {
    for (const cat of effectiveCategories) {
      for (const t of cat.terms) {
        const extraCity = citiesToUse[Math.floor(Math.random() * citiesToUse.length)]
        candidatePool.push({
          query: t,
          city: extraCity,
          category: cat.category,
        })
      }
    }
  }

  candidatePool.sort(() => 0.5 - Math.random())

  for (const cand of candidatePool) {
    const qNorm = cleanNorm(cand.query)
    const comboNorm = cleanNorm(`${cand.query} ${cand.city}`)

    // Kad je zadan grad ili u širem katalogu, dopuštamo isti pojam u drugom gradu ako combo nije korišten
    const alreadyUsed = cand.city
      ? usedNormSet.has(comboNorm)
      : usedNormSet.has(qNorm)

    if (!alreadyUsed) {
      result.push({
        id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        query: cand.query,
        city: cand.city,
        category: cand.category,
        reason: `Odabrano iz proširenog kataloga djelatnosti: ${cand.category}`,
      })
      usedNormSet.add(comboNorm)
    }

    if (result.length >= targetCount) break
  }

  return result.slice(0, targetCount)
}

async function callGeminiTermGenerator(
  apiKey: string,
  modelId: string,
  prompt: string,
  useZeroThinking: boolean
): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const generationConfig: Record<string, any> = {
    temperature: 0.85,
    responseMimeType: 'application/json',
  }
  if (useZeroThinking && /(?:2\.5|3\.|gemini-3|flash)/i.test(modelId)) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 }
  }

  return fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(9000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
    }),
  })
}

/**
 * Generira nove pojmove za pretragu bez preklapanja s dosadašnjim pretragama.
 * Podržava trenutni katalog ('catalog' - <10ms) i brzi Gemini AI način ('gemini').
 */
export async function generateUniqueSearchTerms(options: {
  count: number
  category?: string
  city?: string
  mode?: 'catalog' | 'gemini'
}): Promise<{
  terms: GeneratedSearchTerm[]
  source: 'gemini' | 'catalog'
  usedHistoryCount: number
}> {
  const targetCount = Math.min(Math.max(Number(options.count) || 5, 1), 25)
  const filterCategory = (options.category || '').trim()
  const filterCity = (options.city || '').trim()
  const mode = options.mode === 'gemini' ? 'gemini' : 'catalog'

  // 1. Dohvati najnovije iskorištene pojmove iz baze (sortirano od najnovijih)
  const usedHistory = getAllUsedSearchTerms()
  const usedNormSet = new Set<string>()
  for (const h of usedHistory) {
    if (h.query_norm) usedNormSet.add(cleanNorm(h.query_norm))
    if (h.query) usedNormSet.add(cleanNorm(h.query))
    if (h.query && h.city) {
      usedNormSet.add(cleanNorm(`${h.query} ${h.city}`))
    }
  }

  // Brzi katalog način: trenutno bez čekanja Gemini API-ja
  if (mode === 'catalog') {
    const terms = fillFromCatalog({
      targetCount,
      filterCategory,
      filterCity,
      usedNormSet,
      existing: [],
    })
    return {
      terms,
      source: 'catalog',
      usedHistoryCount: usedHistory.length,
    }
  }

  const settings = getCampaignSettings()
  const apiKey = (settings.gemini_api_key || process.env.GEMINI_API_KEY || '').trim()
  const configuredModel = (settings.gemini_model || 'gemini-flash-latest').replace(/^models\//, '').trim()

  let generated: GeneratedSearchTerm[] = []
  let usedGemini = false

  // 2. Brzi Gemini AI način (deduplicirani modeli, 9s timeout, thinkingBudget: 0)
  if (apiKey) {
    try {
      const recentUsedSample = usedHistory
        .slice(0, 60)
        .map((h) => `"${h.query}${h.city ? ` (${h.city})` : ''}"`)
        .join(', ')

      const prompt = `Uloga: Stručnjak za istraživanje hrvatskog tržišta i fundraising za Hrvatsko rodoslovno društvo Pavao Ritter Vitezović.
Društvo prikuplja donacije za specijalizirani knjižni skener za digitalizaciju povijesne arhivske građe i rodoslova.

Zadatak: Generiraj točno ${targetCount} SPECIFIČNIH I RAZNOLIKIH novih pojmova za pretraživanje hrvatskih tvrtki, obrta i udruga.

STRIKTNO PRAVILO BEZ PREKLAPANJA:
Sljedeći nedavni pojmovi su VEĆ ISKORIŠTENI i NIKAKO ih ne smiješ ponavljati:
${recentUsedSample || '(još nema zabilježenih pretraga)'}

Uvjeti:
- Svaki pojam treba ciljati poslovne subjekte u Hrvatskoj s potencijalom za donaciju (očuvanje baštine, tradicija, obitelj, preciznost, arhiva, lokalni ponos).
${filterCategory ? `- Fokusiraj se na kategoriju: "${filterCategory}"` : '- Osiguraj raznolikost različitih sektora i djelatnosti.'}
${filterCity ? `- Za sve pojmove veži grad / regiju: "${filterCity}"` : '- Predloži raznolike hrvatske gradove za svaki pojam.'}

Vrati ISKLJUČIVO valjani JSON objekt:
{
  "terms": [
    {
      "query": "naziv djelatnosti ili pojma",
      "city": "grad u Hrvatskoj",
      "category": "naziv kategorije",
      "reason": "kratko objašnjenje potencijala"
    }
  ]
}`

      const candidateModels = [
        configuredModel,
        'gemini-flash-latest',
        'gemini-2.5-flash',
        'gemini-flash-lite-latest',
      ].filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx)

      for (const m of candidateModels) {
        try {
          let res = await callGeminiTermGenerator(apiKey, m, prompt, true)
          if (res.status === 400) {
            res = await callGeminiTermGenerator(apiKey, m, prompt, false)
          }

          if (res.ok) {
            const data = await res.json()
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
            if (text) {
              const parsed = JSON.parse(text)
              const rawTerms = Array.isArray(parsed?.terms)
                ? parsed.terms
                : Array.isArray(parsed)
                ? parsed
                : []

              for (const item of rawTerms) {
                const q = String(item.query || '').trim()
                const c = String(filterCity || item.city || '').trim()
                if (!q) continue

                const comboNorm = cleanNorm(`${q} ${c}`)
                if (!usedNormSet.has(comboNorm)) {
                  generated.push({
                    id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                    query: q,
                    city: c,
                    category: item.category || 'AI predloženi sektor',
                    reason: item.reason || 'Prepoznat afinitet prema očuvanju baštine i lokalnoj zajednici',
                  })
                  usedNormSet.add(comboNorm)
                }

                if (generated.length >= targetCount) break
              }

              if (generated.length > 0) {
                usedGemini = true
                break
              }
            }
          }
        } catch {
          // Nastavi na sljedeći model ili katalog fallback
        }
      }
    } catch (e: any) {
      console.warn('[TermGenerator] Gemini generiranje nije uspjelo, prelazim na katalog:', e.message)
    }
  }

  // 3. Dopuna iz proširenog kataloga ako Gemini nije vratio sve pojmove ili nije konfiguriran
  if (generated.length < targetCount) {
    generated = fillFromCatalog({
      targetCount,
      filterCategory,
      filterCity,
      usedNormSet,
      existing: generated,
    })
  }

  return {
    terms: generated.slice(0, targetCount),
    source: usedGemini ? 'gemini' : 'catalog',
    usedHistoryCount: usedHistory.length,
  }
}
