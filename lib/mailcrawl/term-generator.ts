import { getAllUsedSearchTerms, getCampaignSettings } from './db'

export interface GeneratedSearchTerm {
  id: string
  query: string
  city: string
  category: string
  reason?: string
}

// Opsežni katalog hrvatskih djelatnosti i niša pogodnih za donatorski outreach
export const CROATIAN_NICHE_CATEGORIES: { category: string; terms: string[] }[] = [
  {
    category: 'Kulturna baština, tradicija i obrti',
    terms: [
      'restauracija namještaja',
      'konzervatorski radovi',
      'klesarstvo i kamenoklesar',
      'tradicijski obrti',
      'izrada nakita i filigran',
      'staklopuhač i vitraji',
      'keramičarski obrt',
      'stolarija i drvodjelstvo',
      'kovački obrt i bravarija',
      'lončarstvo i tradicijska keramika',
      'tkalački obrt i narodne nošnje',
      'urarski obrt',
      'antikvarijat i stare knjige',
      'umjetnička ljevaonica'
    ]
  },
  {
    category: 'Arhitektura, gradnja i uređenje',
    terms: [
      'arhitektonski ured',
      'projektiranje zgrada',
      'geodetske usluge i katastar',
      'uređenje interijera',
      'građevinski inženjering',
      'statički izračuni',
      'krajobrazna arhitektura',
      'restauracija povijesnih fasada',
      'građevinski obrt za adaptacije',
      'izrada drvenih konstrukcija'
    ]
  },
  {
    category: 'Intelektualne i pravne usluge',
    terms: [
      'odvjetnički ured',
      'javnobilježnički ured',
      'sudski vještak',
      'knjigovodstveni servis',
      'porezno savjetovanje',
      'poslovno savjetovanje',
      'revizorska kuća',
      'prevoditeljske usluge i sudski tumač',
      'upravljanje imovinom'
    ]
  },
  {
    category: 'IT, digitalne tehnologije i tiskare',
    terms: [
      'softverska tvrtka',
      'web dizajn studio',
      'digitalna agencija',
      'tiskara i grafička priprema',
      'nakladnička kuća',
      'izdavaštvo knjiga',
      'digitalizacija i skeniranje',
      'kartografija i GIS sustavi',
      'fotografski studio i video produkcija'
    ]
  },
  {
    category: 'Poljoprivreda, vinarije i autohtoni proizvodi',
    terms: [
      'obiteljska vinarija',
      'uljara i maslinarstvo',
      'ekološki opg',
      'pčelarstvo i medarstvo',
      'proizvodnja sira i mliječnih delicija',
      'autohtoni suveniri i rukotvorine',
      'proizvodnja likera i rakija',
      'uzgoj lavande i eteričnih ulja'
    ]
  },
  {
    category: 'Turizam, baština i ugostiteljstvo',
    terms: [
      'turistička agencija i kulturni turizam',
      'boutique hotel',
      'obiteljsko seosko gospodarstvo',
      'tradicijska konoba i restoran',
      'interpretacijski centar',
      'turistički vodič za baštinu'
    ]
  },
  {
    category: 'Zdravstvo i privatna praksa',
    terms: [
      'stomatološka poliklinika',
      'dentalni laboratorij',
      'oftalmološka ordinacija',
      'specijalistička poliklinika',
      'ljekarna i biljna ljekarna',
      'fizikalna terapija i rehabilitacija'
    ]
  },
  {
    category: 'Proizvodnja, strojarstvo i industrija',
    terms: [
      'strojna obrada metala',
      'precizna mehanika',
      'elektroinstalacije i inženjering',
      'obnovljivi izvori energije i solari',
      'proizvodnja ambalaže',
      'alati i kalupi'
    ]
  }
]

// Hrvatski gradovi s bogatom tradicijom i gospodarskim subjektima
export const CROATIAN_CITIES = [
  'Zagreb',
  'Split',
  'Rijeka',
  'Osijek',
  'Zadar',
  'Varaždin',
  'Dubrovnik',
  'Šibenik',
  'Karlovac',
  'Pula',
  'Slavonski Brod',
  'Sisak',
  'Bjelovar',
  'Vinkovci',
  'Vukovar',
  'Koprivnica',
  'Čakovec',
  'Požega',
  'Đakovo',
  'Samobor',
  'Sinj',
  'Kutina',
  'Rovinj',
  'Poreč',
  'Makarska',
  'Križevci',
  'Gospić',
  'Ogulin',
  'Krapina',
  'Našice',
  'Trogir',
  'Kastav',
  'Otočac',
  'Pazin',
  'Krk',
  'Crikvenica',
  'Zaprešić',
  'Velika Gorica',
  'Jastrebarsko'
]

function cleanNorm(str: string): string {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/[,\-./\s]+/g, ' ')
}

/**
 * Generira 5, 10 ili 15 novih pojmova za pretragu bez preklapanja s dosadašnjim pretragama.
 * Koristi Gemini AI ako je konfiguriran ključ, uz automatski pametni fallback iz kuriranog kataloga.
 */
export async function generateUniqueSearchTerms(options: {
  count: number // 5, 10, or 15
  category?: string
  city?: string
}): Promise<{
  terms: GeneratedSearchTerm[]
  source: 'gemini' | 'catalog'
  usedHistoryCount: number
}> {
  const targetCount = Math.min(Math.max(Number(options.count) || 5, 1), 25)
  const filterCategory = (options.category || '').trim()
  const filterCity = (options.city || '').trim()

  // 1. Dohvati sve iskorištene pojmove iz baze
  const usedHistory = getAllUsedSearchTerms()
  const usedNormSet = new Set<string>()
  for (const h of usedHistory) {
    if (h.query_norm) usedNormSet.add(cleanNorm(h.query_norm))
    if (h.query) usedNormSet.add(cleanNorm(h.query))
    if (h.query && h.city) {
      usedNormSet.add(cleanNorm(`${h.query} ${h.city}`))
    }
  }

  const settings = getCampaignSettings()
  const apiKey = (settings.gemini_api_key || process.env.GEMINI_API_KEY || '').trim()
  const model = (settings.gemini_model || 'gemini-flash-latest').replace(/^models\//, '').trim()

  let generated: GeneratedSearchTerm[] = []
  let usedGemini = false

  // 2. Ako imamo API ključ, pokušaj s Gemini AI
  if (apiKey) {
    try {
      const recentUsedSample = usedHistory
        .slice(0, 40)
        .map(h => `"${h.query}${h.city ? ` (${h.city})` : ''}"`)
        .join(', ')

      const prompt = `Uloga: Stručnjak za istraživanje hrvatskog tržišta i fundraising za Hrvatsko rodoslovno društvo Pavao Ritter Vitezović.
Društvo prikuplja donacije za specijalizirani knjižni skener za digitalizaciju povijesne arhivske građe i rodoslova.

Zadatak: Generiraj točno ${targetCount} SPECIFIČNIH I RAZNOLIKIH novih pojmova za pretraživanje hrvatskih tvrtki, obrta i udruga u poslovnim registrima i webu.

STRIKTNO PRAVILO BEZ PREKLAPANJA:
Sljedeći pojmovi su VEĆ ISKORIŠTENI u ranijim pretragama i NIKAKO ih ne smiješ ponavljati:
${recentUsedSample || '(još nema zabilježenih pretraga)'}

Uvjeti za generiranje:
- Svaki pojam treba ciljati poslovne subjekte u Hrvatskoj koji bi mogli imati senzibilitet za očuvanje baštine, tradiciju, obitelj, preciznost, arhivu ili lokalni ponos (npr. arhitekti, geodeti, restauratori, tradicijski obrti, vinarije, stomatolozi, tiskare, IT, odvjetnici, građevinari, optike, knjigovodstva, privatne poliklinike...).
${filterCategory ? `- Fokusiraj se na djelatnost / kategoriju: "${filterCategory}"` : '- Osiguraj raznolikost različitih sektora i djelatnosti.'}
${filterCity ? `- Za sve pojmove veži grad / regiju: "${filterCity}"` : '- Predloži prikladne hrvatske gradove (npr. Zagreb, Split, Rijeka, Osijek, Varaždin, Zadar, Dubrovnik, Čakovec, Karlovac...) za svaki pojam kako bi pretraga bila geografski raznolika.'}
- Pojam mora biti pogodan za pretraživanje u hrvatskim registrima (Fininfo, CompanyWall, imenici) i Googleu (npr. "geodetski ured", "restauracija namještaja", "zubotehnički laboratorij", "obiteljska vinarija").

Vrati ISKLJUČIVO valjani JSON objekt u obliku:
{
  "terms": [
    {
      "query": "naziv djelatnosti ili pojma",
      "city": "grad u Hrvatskoj",
      "category": "naziv kategorije",
      "reason": "kratko objašnjenje zašto ovaj subjekt ima potencijal za donaciju društvu"
    }
  ]
}`

      const candidateModels = [model, 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-1.5-flash']
      for (const m of candidateModels) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`
          const res = await fetch(url, {
            method: 'POST',
            signal: AbortSignal.timeout(25000),
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.8,
                responseMimeType: 'application/json'
              }
            })
          })

          if (res.ok) {
            const data = await res.json()
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
            if (text) {
              const parsed = JSON.parse(text)
              const rawTerms = Array.isArray(parsed?.terms) ? parsed.terms : (Array.isArray(parsed) ? parsed : [])
              
              for (const item of rawTerms) {
                const q = String(item.query || '').trim()
                const c = String(filterCity || item.city || '').trim()
                if (!q) continue

                const qNorm = cleanNorm(q)
                const comboNorm = cleanNorm(`${q} ${c}`)

                if (!usedNormSet.has(qNorm) && !usedNormSet.has(comboNorm)) {
                  generated.push({
                    id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                    query: q,
                    city: c,
                    category: item.category || 'AI predloženi sektor',
                    reason: item.reason || 'Prepoznat afinitet prema očuvanju baštine i lokalnoj zajednici'
                  })
                  usedNormSet.add(qNorm)
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
          // Nastavi na sljedeći kandidat ili fallback
        }
      }
    } catch (e: any) {
      console.warn('[TermGenerator] Gemini generiranje nije uspjelo, prelazim na katalog:', e.message)
    }
  }

  // 3. Dopuna iz pametnog kataloga (ili potpuni fallback ako Gemini nije uspio ili nije dostupan)
  if (generated.length < targetCount) {
    const candidatePool: { query: string; city: string; category: string }[] = []

    // Filtriraj kategorije po želji korisnika ako je zadano
    const activeCategories = filterCategory
      ? CROATIAN_NICHE_CATEGORIES.filter(c => c.category.toLowerCase().includes(filterCategory.toLowerCase()))
      : CROATIAN_NICHE_CATEGORIES

    const effectiveCategories = activeCategories.length > 0 ? activeCategories : CROATIAN_NICHE_CATEGORIES

    const citiesToUse = filterCity ? [filterCity] : [...CROATIAN_CITIES].sort(() => 0.5 - Math.random())

    for (let i = 0; i < effectiveCategories.length; i++) {
      const cat = effectiveCategories[i]
      const shuffledTerms = [...cat.terms].sort(() => 0.5 - Math.random())
      for (const t of shuffledTerms) {
        const assignedCity = filterCity || citiesToUse[candidatePool.length % citiesToUse.length]
        candidatePool.push({
          query: t,
          city: assignedCity,
          category: cat.category
        })
      }
    }

    // Promiješaj kandidate za maksimalnu raznolikost
    candidatePool.sort(() => 0.5 - Math.random())

    for (const cand of candidatePool) {
      const qNorm = cleanNorm(cand.query)
      const comboNorm = cleanNorm(`${cand.query} ${cand.city}`)

      if (!usedNormSet.has(qNorm) && !usedNormSet.has(comboNorm)) {
        generated.push({
          id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          query: cand.query,
          city: cand.city,
          category: cand.category,
          reason: `Odabrano iz registra djelatnosti: ${cand.category}`
        })
        usedNormSet.add(qNorm)
        usedNormSet.add(comboNorm)
      }

      if (generated.length >= targetCount) break
    }
  }

  return {
    terms: generated.slice(0, targetCount),
    source: usedGemini ? 'gemini' : 'catalog',
    usedHistoryCount: usedHistory.length
  }
}
