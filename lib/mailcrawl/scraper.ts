import 'server-only'
import * as cheerio from 'cheerio'
import type { Lead } from './types'
import { serperSearchOrganic, serperSearchPlaces, type SerperSearchResult } from './serper'
import { hasValidMailDomain } from './mx-check'
import { CompanyStorage } from '@/src/services/scrapers/companyStorage'

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
]

function getRandomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function normalizeCroatiaBizSlug(city: string): string {
  return String(city || 'zagreb')
    .trim()
    .toLowerCase()
    .replace(/č/g, 'c')
    .replace(/ć/g, 'c')
    .replace(/ž/g, 'z')
    .replace(/š/g, 's')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, '-')
}

export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal
): Promise<R[]> {
  if (items.length === 0) return []
  const maxWorkers = Math.max(1, Math.min(concurrency, items.length))
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function runWorker() {
    while (true) {
      if (signal?.aborted) break
      const idx = nextIndex++
      if (idx >= items.length) break
      results[idx] = await worker(items[idx], idx)
    }
  }

  await Promise.all(Array.from({ length: maxWorkers }, () => runWorker()))
  return results
}

export async function fetchHtml(
  url: string,
  timeoutMs: number = 6000,
  externalSignal?: AbortSignal
): Promise<string | null> {
  if (externalSignal?.aborted) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onExternalAbort = () => controller.abort(externalSignal?.reason)
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true })

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': getRandomUA(),
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'hr-HR,hr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const ctype = (res.headers.get('content-type') || '').toLowerCase()
    if (ctype && !ctype.includes('text/') && !ctype.includes('html') && !ctype.includes('xml')) {
      return null
    }
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    externalSignal?.removeEventListener('abort', onExternalAbort)
  }
}

/**
 * Decodes Cloudflare email protection hex string (data-cfemail)
 */
export function decodeCfEmail(encodedString: string): string {
  try {
    let email = ''
    const r = parseInt(encodedString.substring(0, 2), 16)
    for (let n = 2; encodedString.length - n; n += 2) {
      const charCode = parseInt(encodedString.substring(n, n + 2), 16) ^ r
      email += String.fromCharCode(charCode)
    }
    return email
  } catch {
    return ''
  }
}

const IGNORED_EMAIL_DOMAINS = [
  'example.com', 'domain.com', 'yourdomain.com', 'email.com', 'sentry.io',
  'wixpress.com', 'w3.org', 'schema.org', 'google.com', 'facebook.com',
  'wordpress.org', 'gravatar.com', 'godaddy.com', 'fininfo.hr', 'el-koncept.hr',
  'companywall.hr', 'zutestranice.hr', 'mojkvart.hr', 'tvrtke.hr',
  'sudreg.pravosudje.hr', 'narodne-novine.nn.hr', 'hgk.hr', 'hok.hr', 'fina.hr',
  'poslovna.hr', 'boniteti.hr', 'bisnode.hr', 'mojadjelatnost.hr', 'croatia.biz',
]

const IGNORED_EMAIL_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js', '.woff', '.woff2', '.ttf', '.pdf',
]

export function extractEmailsFromHtml(html: string, $?: cheerio.CheerioAPI | null): string[] {
  if (!html) return []
  const found = new Set<string>()

  if ($) {
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href') || ''
      const raw = href.replace(/^mailto:/i, '').split('?')[0].trim()
      if (raw) found.add(raw.toLowerCase())
    })

    $('[data-cfemail]').each((_, el) => {
      const cf = $(el).attr('data-cfemail')
      if (cf) {
        const decoded = decodeCfEmail(cf)
        if (decoded && decoded.includes('@')) found.add(decoded.toLowerCase())
      }
    })
  }

  const deobfuscated = html
    .replace(/\s*\[\s*(?:at|et|@)\s*\]\s*/gi, '@')
    .replace(/\s*\(\s*(?:at|et|@)\s*\)\s*/gi, '@')
    .replace(/&#64;/g, '@')
    .replace(/&#46;/g, '.')

  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12}/g
  const matches = deobfuscated.match(regex) || []
  for (const m of matches) {
    found.add(m.toLowerCase().trim())
  }

  const validEmails: string[] = []
  for (const email of found) {
    if (email.length > 75 || email.length < 6) continue
    if (IGNORED_EMAIL_EXTENSIONS.some((ext) => email.endsWith(ext))) continue
    const domain = email.split('@')[1] || ''
    if (!domain || !domain.includes('.')) continue
    if (
      IGNORED_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d)) ||
      domain.includes('companywall.')
    ) {
      continue
    }
    if (/^\d+@/.test(email)) continue
    validEmails.push(email)
  }

  validEmails.sort((a, b) => {
    const score = (e: string) => {
      let s = 0
      if (e.endsWith('.hr')) s += 5
      if (/^(uprava|direktor|ured|kontakt|info|office|tajnik|predsjednik)@/i.test(e)) s += 3
      if (/^(gdpr|dpo|reklamacije|webmaster|admin|no-reply|noreply)@/i.test(e)) s -= 10
      return s
    }
    return score(b) - score(a)
  })

  return validEmails
}

export function extractOib(text: string): string {
  if (!text) return ''
  const explicitMatch = text.match(/OIB[\s:.-]*(\d{11})\b/i)
  if (explicitMatch) return explicitMatch[1]
  return ''
}

export function extractPhone(text: string): string {
  if (!text) return ''
  const match = text.match(/(?:\+385|00385|0)\s*\d{1,2}[\s/-]*\d{3}[\s/-]*\d{3,4}/)
  return match ? match[0].trim() : ''
}

function toTitleCaseCroatian(str: string): string {
  return String(str || '')
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function extractContactPerson(text: string): { person: string; role: string } {
  if (!text) return { person: '', role: '' }

  const upperCraftMatch = text.match(
    /\b(?:VL\.|VLASNIK(?:\s+OBRTA)?)[\s:,-]+([A-ZČĆŽŠĐ]{2,18}\s+[A-ZČĆŽŠĐ]{2,18})(?:\s+[A-ZČĆŽŠĐ]+|\b)/i
  )
  if (upperCraftMatch && upperCraftMatch[1]) {
    const candidate = toTitleCaseCroatian(upperCraftMatch[1].trim())
    const stopCities = ['Zagreb', 'Split', 'Rijeka', 'Osijek', 'Zadar', 'Pula', 'Varaždin', 'Hrvatska', 'Obrt']
    const parts = candidate.split(/\s+/).filter((w) => !stopCities.includes(w))
    if (parts.length >= 2) {
      return { person: parts.slice(0, 2).join(' '), role: 'Vlasnik obrta' }
    }
  }

  const patterns = [
    {
      role: 'Vlasnik obrta',
      regex: /\b(?:vl\.|vlasnik(?:\s+obrta)?|nositelj\s+obrta)[\s:,-]+([A-ZČĆŽŠĐ][a-zčćžšđ]+\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+(?:\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+)?)/,
    },
    {
      role: 'Direktor / Uprava',
      regex: /\b(?:direktor(?:ica)?|član\s+uprave|predsjednik\s+uprave|osoba\s+ovlaštena\s+za\s+zastupanje|zastupnik)[\s:,-]+([A-ZČĆŽŠĐ][a-zčćžšđ]+\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+(?:\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+)?)/i,
    },
    {
      role: 'Predsjednik udruge',
      regex: /\b(?:predsjednik(?:ca)?\s+udruge|predsjednik(?:ca)?\s+društva|tajnik(?:ca)?)[\s:,-]+([A-ZČĆŽŠĐ][a-zčćžšđ]+\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+(?:\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+)?)/i,
    },
    {
      role: 'Kontakt osoba',
      regex: /\b(?:kontakt\s+osoba|voditelj(?:ica)?)[\s:,-]+([A-ZČĆŽŠĐ][a-zčćžšđ]+\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+(?:\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+)?)/i,
    },
  ]

  const stopWords = [
    'Opći', 'Uvjeti', 'Pravila', 'Privatnosti', 'Zaštita', 'Podataka', 'Radno', 'Vrijeme',
    'Hrvatska', 'Zagreb', 'Split', 'Rijeka', 'Osijek', 'Društvo', 'Udruga', 'Obrt',
    'Ime', 'Prezime', 'Vaše', 'Tvrtke', 'Je', 'Naziv', 'Adresa', 'Poruka', 'Kontakt',
    'Osoba', 'Podaci', 'Uprava', 'Telefon', 'Mobitel', 'Pošalji', 'Upit', 'Korisnik',
    'Odgovorna', 'Ovlaštena', 'Zastupanje', 'Direktor', 'Vlasnik', 'Predsjednik',
  ]

  for (const p of patterns) {
    const m = text.match(p.regex)
    if (m && m[1]) {
      const candidate = m[1].trim()
      const words = candidate.split(/\s+/)
      if (
        words.length >= 2 &&
        words.length <= 3 &&
        words.every((w) => /^[A-ZČĆŽŠĐ][a-zčćžšđ]{2,18}$/.test(w)) &&
        !words.some((w) => stopWords.some((sw) => sw.toLowerCase() === w.toLowerCase()))
      ) {
        return { person: candidate, role: p.role }
      }
    }
  }

  return { person: '', role: '' }
}

export function detectEntityType(nameAndText: string, fallback: string = 'tvrtka'): string {
  const t = (nameAndText || '').toLowerCase()
  if (/\b(d\.o\.o\.|j\.d\.o\.o\.|d\.d\.|k\.d\.)\b/.test(t)) {
    return 'tvrtka'
  }
  if (
    /\b(obrt|vl\.|vlasnik obrta|stolarski obrt|ugostiteljski obrt|građevinski obrt|uslužni obrt|proizvodni obrt|frizerski obrt|prijevoznički obrt)\b/.test(
      t
    )
  ) {
    return 'obrt'
  }
  if (
    /\b(udruga|savez|klub|zaklada|zajednica|kud|kulturno društvo|sportsko društvo|dobrovoljno vatrogasno društvo|planinarsko društvo)\b/.test(
      t
    )
  ) {
    return 'udruga'
  }
  return fallback || 'tvrtka'
}

export const CROATIAN_CITIES = [
  'Zagreb', 'Split', 'Rijeka', 'Osijek', 'Zadar', 'Velika Gorica', 'Pula', 'Slavonski Brod',
  'Karlovac', 'Varaždin', 'Šibenik', 'Dubrovnik', 'Bjelovar', 'Kaštela', 'Samobor', 'Vinkovci',
  'Koprivnica', 'Đakovo', 'Vukovar', 'Čakovec', 'Požega', 'Zaprešić', 'Sinj', 'Petrinja',
  'Solin', 'Kutina', 'Virovitica', 'Križevci', 'Makarska', 'Rovinj', 'Poreč', 'Trogir',
  'Krapina', 'Gospić', 'Pazin', 'Čazma', 'Dugo Selo', 'Sveta Nedelja', 'Ivanić-Grad',
  'Jastrebarsko', 'Zabok', 'Prelog', 'Mursko Središće', 'Opatija', 'Crikvenica', 'Umag',
  'Labin', 'Metković', 'Imotski', 'Knin', 'Vodice', 'Biograd na Moru', 'Nova Gradiška', 'Našice',
  'Pakrac', 'Daruvar', 'Slatina', 'Valpovo', 'Sisak', 'Ogulin', 'Otočac', 'Krk', 'Kastav',
]

export function extractCity(text: string, defaultCity: string = ''): string {
  if (!text) return defaultCity
  const postalMatch = text.match(/\b([1-5]\d{4})\s+([A-ZČĆŽŠĐ][a-zčćžšđ]+(?:\s+[A-ZČĆŽŠĐa-zčćžšđ]+)?)/)
  if (postalMatch && postalMatch[2]) {
    const c = postalMatch[2].trim()
    if (CROATIAN_CITIES.some((city) => c.toLowerCase().startsWith(city.toLowerCase()))) {
      return c
    }
  }
  for (const city of CROATIAN_CITIES) {
    const reg = new RegExp(`\\b${city.trim()}\\b`, 'i')
    if (reg.test(text)) return city.trim()
  }
  return defaultCity
}

export function cleanCompanyName(rawTitle: string): string {
  if (!rawTitle) return ''
  let title = rawTitle
    .replace(
      /\s*[|\-–—•:]\s*(prihod,\s*dobit|Poslovni podaci|Financijski pokazatelji|Početna|Naslovnica|Home|Kontakt|O nama|Dobrodošli|Fininfo|CompanyWall|Žute stranice|MojKvart|Tvrtke\.hr|Poslovna Hrvatska).*$/i,
      ''
    )
    .replace(/^(Početna|Naslovnica|Home|Kontakt|O nama)\s*[|\-–—•:]\s*/i, '')
    .replace(/\bOIB\s*\d{11}\b/gi, '')
    .trim()
  if (title.length > 80) {
    title = title.split(/[|\-–—]/)[0].trim()
  }
  return title
}

async function pickBestValidEmail(candidates: string[]): Promise<{ primary: string; validList: string[] }> {
  const validList: string[] = []
  for (const email of candidates) {
    const ok = await hasValidMailDomain(email)
    if (ok) validList.push(email)
  }
  return {
    primary: validList[0] || '',
    validList,
  }
}

export async function crawlCompanyWebsite(
  siteUrl: string,
  hints: Partial<Lead> & { snippet?: string } = {},
  externalSignal?: AbortSignal
): Promise<Lead | null> {
  if (externalSignal?.aborted) return null

  let normalizedUrl = siteUrl.trim()
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl
  }

  let baseUrlObj: URL
  try {
    baseUrlObj = new URL(normalizedUrl)
  } catch {
    return null
  }

  const homeHtml = await fetchHtml(normalizedUrl, 6000, externalSignal)
  if (!homeHtml) return null

  // Jednokratno parsiranje HTML-a naslovnice
  const $ = cheerio.load(homeHtml)
  const allEmails = new Set(extractEmailsFromHtml(homeHtml, $))

  const subUrlsToVisit = new Set<string>()
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim()
    const linkText = ($(el).text() || '').toLowerCase()
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
      return
    }
    try {
      const resolved = new URL(href, baseUrlObj.origin)
      if (resolved.hostname === baseUrlObj.hostname) {
        const pathLower = resolved.pathname.toLowerCase()
        if (
          /kontakt|contact|o-nama|onama|about|impressum|impresum|uprava|tim|djelatnost|usluge/.test(pathLower) ||
          /kontakt|o nama|impressum|uprava|naš tim/.test(linkText)
        ) {
          subUrlsToVisit.add(resolved.href)
        }
      }
    } catch {
      // ignore invalid link
    }
  })

  // Ukloni script/style tek NAKON vađenja mailto/cfemail i linkova
  $('script, style, noscript, svg, iframe').remove()

  const rawTitle = $('title').first().text().trim() || $('h1').first().text().trim() || hints.name || ''
  const metaDesc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || ''
  const h1Text = $('h1').map((_, el) => $(el).text().trim()).get().join(' | ')
  const h2Text = $('h2').slice(0, 6).map((_, el) => $(el).text().trim()).get().join(' | ')

  const paragraphs: string[] = []
  $('p').each((_, el) => {
    const txt = $(el).text().replace(/\s+/g, ' ').trim()
    if (txt.length >= 45 && txt.length <= 600 && !/kolačić|cookie|gdpr|copyright|sva prava/i.test(txt)) {
      paragraphs.push(txt)
    }
  })

  const homeText = $('body').text().replace(/\s+/g, ' ').trim()
  const homeContact = extractContactPerson(`${rawTitle} ${homeText.slice(0, 5000)}`)

  // Rani izlaz ako naslovnica već ima e-mail + kontakt osobu (ili dovoljno konteksta)
  const shouldFetchSubpages =
    !externalSignal?.aborted &&
    subUrlsToVisit.size > 0 &&
    (allEmails.size === 0 || (!homeContact.person && paragraphs.length < 2))

  let subpageTexts = ''
  if (shouldFetchSubpages) {
    const subUrlArray = Array.from(subUrlsToVisit).slice(0, 3)
    const subResults = await Promise.allSettled(
      subUrlArray.map((subUrl) => fetchHtml(subUrl, 4500, externalSignal))
    )
    for (const r of subResults) {
      if (r.status !== 'fulfilled' || !r.value) continue
      const subHtml = r.value
      const $sub = cheerio.load(subHtml)
      for (const em of extractEmailsFromHtml(subHtml, $sub)) {
        allEmails.add(em)
      }
      $sub('script, style, noscript, svg, iframe').remove()
      $sub('p').each((_, el) => {
        const txt = $sub(el).text().replace(/\s+/g, ' ').trim()
        if (txt.length >= 45 && txt.length <= 600 && !/kolačić|cookie|gdpr|copyright/i.test(txt)) {
          if (paragraphs.length < 10 && !paragraphs.includes(txt)) {
            paragraphs.push(txt)
          }
        }
      })
      subpageTexts += ' ' + $sub('body').text().replace(/\s+/g, ' ').trim().slice(0, 3500)
    }
  }

  const combinedText = `${rawTitle} ${metaDesc} ${h1Text} ${h2Text} ${homeText.slice(0, 5000)} ${subpageTexts} ${hints.snippet || ''}`

  if (hints.email) {
    allEmails.add(hints.email.trim().toLowerCase())
  }
  const emailCandidates = Array.from(allEmails)
  const { primary: primaryEmail, validList } = await pickBestValidEmail(emailCandidates)

  const oib = hints.oib || extractOib(combinedText)
  const phone = hints.phone || extractPhone(combinedText)
  const contactInfo = extractContactPerson(combinedText)
  const contactPerson = hints.contact_person || contactInfo.person
  const contactRole = hints.contact_role || contactInfo.role

  const cleanName = hints.name || cleanCompanyName(rawTitle) || baseUrlObj.hostname.replace(/^www\./, '')
  const entityType = detectEntityType(`${cleanName} ${combinedText.slice(0, 1200)}`, hints.entity_type)
  const city = extractCity(combinedText, hints.city || '')

  const summaryParts: string[] = []
  if (metaDesc) summaryParts.push(metaDesc.trim())
  if (paragraphs.length > 0) summaryParts.push(paragraphs.slice(0, 3).join(' '))
  if (summaryParts.length === 0 && h1Text) summaryParts.push(`${h1Text}. ${h2Text}`)
  if (hints.snippet && summaryParts.join(' ').length < 120) summaryParts.push(hints.snippet)

  const activitySummary = summaryParts.join(' — ').replace(/\s+/g, ' ').trim().slice(0, 800)

  return {
    name: cleanName,
    entity_type: entityType,
    oib,
    city,
    address: hints.address || '',
    website: baseUrlObj.origin,
    email: primaryEmail,
    all_emails: JSON.stringify(validList),
    phone,
    contact_person: contactPerson,
    contact_role: contactRole,
    activity_category: hints.activity_category || '',
    activity_summary:
      activitySummary ||
      `Poslovni subjekt (${entityType}) iz djelatnosti: ${hints.activity_category || 'opće poslovanje'}.`,
    raw_scraped_text: combinedText.slice(0, 5000),
    source: hints.source || 'Web / Registar',
    source_url: hints.source_url || normalizedUrl,
  }
}

export async function searchWebDuckDuckGo(
  query: string,
  externalSignal?: AbortSignal
): Promise<SerperSearchResult[]> {
  const cleanQ = query.replace(/["()]/g, ' ').replace(/\s+/g, ' ').trim()
  const results: SerperSearchResult[] = []
  try {
    const targetUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQ)}`
    const html = await fetchHtml(targetUrl, 5000, externalSignal)
    if (!html) return results

    const $ = cheerio.load(html)
    $('.result').each((_, el) => {
      const titleEl = $(el).find('.result__a').first()
      const title = titleEl.text().trim()
      let href = titleEl.attr('href') || ''
      const snippet = $(el).find('.result__snippet').text().trim()

      if (href.includes('uddg=')) {
        try {
          const parsed = new URL(href, 'https://html.duckduckgo.com')
          href = decodeURIComponent(parsed.searchParams.get('uddg') || href)
        } catch {
          // ignore
        }
      }
      if (href && href.startsWith('http') && !href.includes('duckduckgo.com')) {
        results.push({ title, url: href, snippet })
      }
    })
  } catch {
    // ignore
  }
  return results
}

async function searchWebYahoo(
  query: string,
  externalSignal?: AbortSignal
): Promise<SerperSearchResult[]> {
  const results: SerperSearchResult[] = []
  try {
    const cleanQ = query.replace(/["()]/g, ' ').replace(/\s+/g, ' ').trim()
    const url = `https://search.yahoo.com/search?p=${encodeURIComponent(cleanQ)}&ei=UTF-8`
    const html = await fetchHtml(url, 5000, externalSignal)
    if (!html) return results

    const $ = cheerio.load(html)
    $('div.algo, div.Sr').each((_, el) => {
      const a = $(el).find('h3 a').first()
      const title = a.text().trim()
      let href = a.attr('href') || ''
      const snippet = $(el).find('.compText, p').text().trim()

      if (href.includes('/RU=')) {
        const m = href.match(/\/RU=([^/]+)\//)
        if (m && m[1]) href = decodeURIComponent(m[1])
      }
      if (href && href.startsWith('http') && !href.includes('yahoo.com') && !href.includes('bing.com')) {
        results.push({ title, url: href, snippet })
      }
    })
  } catch {
    // ignore
  }
  return results
}

async function searchWebBing(
  query: string,
  count: number = 20,
  externalSignal?: AbortSignal
): Promise<SerperSearchResult[]> {
  const results: SerperSearchResult[] = []
  try {
    const cleanQ = query.replace(/["()]/g, ' ').replace(/\s+/g, ' ').trim()
    const url = `https://www.bing.com/search?q=${encodeURIComponent(cleanQ)}&count=${count}&setlang=hr`
    const html = await fetchHtml(url, 5000, externalSignal)
    if (!html) return results

    const $ = cheerio.load(html)
    $('li.b_algo').each((_, el) => {
      const a = $(el).find('h2 a').first()
      const title = a.text().trim()
      const href = a.attr('href') || ''
      const snippet = $(el).find('.b_caption p, .b_algoSlug').text().trim()
      if (href && href.startsWith('http') && !href.includes('bing.com') && !href.includes('microsoft.com') && title) {
        results.push({ title, url: href, snippet })
      }
    })
  } catch {
    // ignore
  }
  return results
}

async function performCombinedSearch(
  query: string,
  opts: { serperApiKey?: string; signal?: AbortSignal; includePlaces?: boolean } = {}
): Promise<SerperSearchResult[]> {
  const combined: SerperSearchResult[] = []
  const seen = new Set<string>()
  const addItems = (items: SerperSearchResult[]) => {
    for (const r of items) {
      if (r.url && !seen.has(r.url)) {
        combined.push(r)
        seen.add(r.url)
      }
    }
  }

  const key = (opts.serperApiKey || '').trim()
  if (key) {
    const tasks: Promise<SerperSearchResult[]>[] = [
      serperSearchOrganic(query, key, 20, opts.signal),
    ]
    if (opts.includePlaces !== false) {
      tasks.unshift(serperSearchPlaces(query, key, opts.signal))
    }
    const settled = await Promise.allSettled(tasks)
    for (const s of settled) {
      if (s.status === 'fulfilled') addItems(s.value)
    }
    if (combined.length > 0) return combined
  }

  // Besplatni paralelni način (DDG + Bing + Yahoo istovremeno, bez sporog raw Googlea)
  const settled = await Promise.allSettled([
    searchWebDuckDuckGo(query, opts.signal),
    searchWebBing(query, 20, opts.signal),
    searchWebYahoo(query, opts.signal),
  ])
  for (const s of settled) {
    if (s.status === 'fulfilled') addItems(s.value)
  }

  return combined
}

const DIRECTORY_DOMAINS = [
  'fininfo.hr', 'el-koncept.hr', 'companywall.hr', 'zutestranice.hr',
  'mojkvart.hr', 'tvrtke.hr', 'mojadjelatnost.hr', 'poslovna.hr',
  'boniteti.hr', 'bisnode.hr', 'dun-bradstreet.com', 'moj-eracun.hr',
  'registri.uprava.hr', 'gov.hr', 'facebook.com', 'instagram.com',
  'linkedin.com', 'youtube.com', 'wikipedia.org', 'index.hr',
  'jutarnji.hr', 'vecernji.hr', '24sata.hr', 'poslovni.hr',
  'lidermedia.hr', 'hgk.hr', 'hok.hr', 'njuskalo.hr', 'cookiebot.com',
]

function isDirectoryOrNonCompanyUrl(urlStr: string): boolean {
  try {
    const host = new URL(urlStr).hostname.toLowerCase()
    if (host.includes('companywall.') || host.includes('fininfo.')) return true
    return DIRECTORY_DOMAINS.some((d) => host === d || host.endsWith('.' + d))
  } catch {
    return true
  }
}

async function processDirectoryEntry(
  entry: SerperSearchResult,
  context: { query: string; city: string; entityType: string; serperApiKey?: string; signal?: AbortSignal }
): Promise<Lead | null> {
  if (context.signal?.aborted) return null

  const combined = `${entry.title} ${entry.snippet}`
  const oib = extractOib(combined)
  const contact = extractContactPerson(combined)
  const city = extractCity(combined, context.city)

  const compName = cleanCompanyName(entry.title)
  if (!compName || compName.length < 3) return null

  let sourceLabel = entry.source || 'Poslovni registar'
  if (entry.url.includes('fininfo.hr')) sourceLabel = 'Fininfo registar'
  else if (entry.url.includes('companywall.hr')) sourceLabel = 'CompanyWall registar'
  else if (entry.url.includes('zutestranice.hr')) sourceLabel = 'Žute stranice'
  else if (entry.url.includes('mojkvart.hr')) sourceLabel = 'MojKvart imenik'
  else if (entry.url.includes('tvrtke.hr')) sourceLabel = 'Tvrtke.hr imenik'
  else if (entry.url.includes('croatia.biz')) sourceLabel = 'Croatia.biz katalog'

  let dirEmails: string[] = []
  let dirContact = contact
  let dirOib = oib
  let officialWebFromDir = ''

  const dirHtml = await fetchHtml(entry.url, 5000, context.signal)
  if (dirHtml) {
    const $d = cheerio.load(dirHtml)
    dirEmails = extractEmailsFromHtml(dirHtml, $d)
    const bodyTxt = $d('body').text().replace(/\s+/g, ' ')
    if (!dirOib) dirOib = extractOib(bodyTxt)
    if (!dirContact.person) dirContact = extractContactPerson(bodyTxt)

    $d('a[href^="http"]').each((_, el) => {
      const href = $d(el).attr('href') || ''
      if (href && !isDirectoryOrNonCompanyUrl(href)) {
        officialWebFromDir = href
        return false
      }
    })
  }

  let officialWebsite = officialWebFromDir
  if (!officialWebsite && !context.signal?.aborted) {
    const shortLookupName = compName.replace(/\b(ZAGREB|SPLIT|RIJEKA|OSIJEK|VARAŽDIN|ZADAR|PULA)\b/gi, '').trim()
    const lookupResults = await performCombinedSearch(`"${shortLookupName}" ${city || ''} kontakt email`, {
      serperApiKey: context.serperApiKey,
      signal: context.signal,
      includePlaces: false,
    })
    for (const r of lookupResults) {
      if (!isDirectoryOrNonCompanyUrl(r.url)) {
        officialWebsite = r.url
        break
      }
    }
  }

  const hints: Partial<Lead> & { snippet?: string } = {
    name: compName,
    oib: dirOib,
    city,
    address: entry.address || '',
    phone: entry.phone || extractPhone(combined),
    email: dirEmails[0] || '',
    contact_person: dirContact.person,
    contact_role: dirContact.role,
    activity_category: entry.category || context.query,
    snippet: entry.snippet,
    entity_type: detectEntityType(`${compName} ${entry.snippet}`, context.entityType === 'all' ? 'tvrtka' : context.entityType),
    source: sourceLabel,
    source_url: entry.url,
  }

  if (officialWebsite) {
    const crawled = await crawlCompanyWebsite(officialWebsite, hints, context.signal)
    if (crawled && crawled.email) return crawled
  }

  if (hints.email) {
    const { primary, validList } = await pickBestValidEmail(dirEmails)
    if (!primary) return null
    return {
      name: hints.name || compName,
      entity_type: hints.entity_type,
      oib: hints.oib,
      city: hints.city,
      address: hints.address || '',
      website: officialWebsite || '',
      email: primary,
      all_emails: JSON.stringify(validList),
      phone: hints.phone || '',
      contact_person: hints.contact_person,
      contact_role: hints.contact_role,
      activity_category: hints.activity_category,
      activity_summary: entry.snippet || `Subjekt pronađen u registru (${sourceLabel}).`,
      raw_scraped_text: combined,
      source: sourceLabel,
      source_url: entry.url,
    }
  }

  return null
}

const GENERAL_ROTATION_QUERIES = [
  'proizvodnja "d.o.o."',
  'usluge "obrt"',
  '"udruga" baština OR kultura',
  'inženjering projektiranje "d.o.o."',
  'trgovina opremom "d.o.o."',
  'stolarija namještaj "obrt" OR "d.o.o."',
  'informatika softver "d.o.o."',
  'vinarija vinogradi "d.o.o." OR "obrt"',
  'arhitektura građevina "d.o.o."',
  'knjigovodstveni servis "d.o.o." OR "obrt"',
  'elektroinstalacije servis "obrt"',
  'turizam ugostiteljstvo "d.o.o." OR "obrt"',
  'prijevoz tereta logistika "d.o.o."',
  'tiskara grafika "d.o.o."',
  'metalurgija bravarija "obrt" OR "d.o.o."',
  'geodezija geodetski ured "d.o.o."',
  'stomatološka ordinacija poliklinika',
  'restauracija baštine obrt',
  'servis mehanizacije strojevi "d.o.o."',
  'auto servis vulkanizer "obrt"',
  'opremanje interijera dizajn "d.o.o."',
  'pekara mlinarstvo "d.o.o." OR "obrt"',
  'poljoprivreda voćarstvo OPG "d.o.o."',
  'hortikultura uređenje okoliša "obrt"',
  'energetika instalacije grijanja "d.o.o."',
  'veterinarska ambulanta ljekarna',
  'keramika završni radovi "obrt"',
  'staklarija obrada stakla "d.o.o."',
  'drvo prerada pilana "d.o.o."',
]

let rotationIndex = Math.floor(Math.random() * GENERAL_ROTATION_QUERIES.length)

export interface ProgressCallbackData {
  phase: 'search' | 'crawl' | 'analyzing' | 'found'
  message: string
  lead?: Lead
}

export async function discoverCroatianEntities(
  {
    query = '',
    city = '',
    entityType = 'all',
    registrySource = 'all',
    maxResults = 10,
    serperApiKey = '',
    signal,
    isKnownEntity = () => false,
    markKnownEntity = () => {},
  }: {
    query?: string
    city?: string
    entityType?: string
    registrySource?: string
    maxResults?: number
    serperApiKey?: string
    signal?: AbortSignal
    isKnownEntity?: (candidate: { name?: string; domain?: string; oib?: string; url?: string; email?: string }) => boolean
    markKnownEntity?: (candidate: { name?: string; domain?: string; oib?: string; url?: string; email?: string }) => void
  },
  onProgress: (p: ProgressCallbackData) => void = () => {}
): Promise<Lead[]> {
  if (signal?.aborted) return []

  const searchTerms: Array<{ q: string; includePlaces: boolean }> = []
  const locationPart = city ? ` ${city}` : ' Hrvatska'
  const cleanQuery = String(query || '').trim()

  let typeKeyword = ''
  if (entityType === 'tvrtka') typeKeyword = ' "d.o.o."'
  else if (entityType === 'obrt') typeKeyword = ' "obrt"'
  else if (entityType === 'udruga') typeKeyword = ' "udruga"'

  if (cleanQuery) {
    if (registrySource === 'fininfo') {
      searchTerms.push({ q: `site:fininfo.hr ${cleanQuery}${locationPart}`, includePlaces: false })
      searchTerms.push({ q: `${cleanQuery}${typeKeyword}${locationPart} kontakt`, includePlaces: false })
    } else if (registrySource === 'companywall') {
      searchTerms.push({ q: `site:companywall.hr ${cleanQuery}${locationPart}`, includePlaces: false })
      searchTerms.push({ q: `${cleanQuery}${typeKeyword}${locationPart} kontakt`, includePlaces: false })
    } else if (registrySource === 'imenici') {
      searchTerms.push({ q: `site:zutestranice.hr ${cleanQuery}${locationPart}`, includePlaces: false })
      searchTerms.push({ q: `${cleanQuery}${typeKeyword}${locationPart} email`, includePlaces: false })
    } else {
      // Maksimalno 2 brza paralelna upita po pojmu
      searchTerms.push({ q: `${cleanQuery}${typeKeyword}${locationPart}`, includePlaces: true })
      searchTerms.push({ q: `${cleanQuery} ${city || 'Hrvatska'} kontakt email`, includePlaces: false })
    }
  } else {
    const q1 = GENERAL_ROTATION_QUERIES[rotationIndex % GENERAL_ROTATION_QUERIES.length]
    const q2 = GENERAL_ROTATION_QUERIES[(rotationIndex + 1) % GENERAL_ROTATION_QUERIES.length]
    rotationIndex = (rotationIndex + 2) % GENERAL_ROTATION_QUERIES.length
    searchTerms.push({ q: `${q1}${locationPart}`, includePlaces: true })
    searchTerms.push({ q: `${q2}${locationPart} kontakt`, includePlaces: false })
  }

  const labelQuery = cleanQuery || 'Opća pretraga svih djelatnosti (Tvrtke, Obrti, Udruge)'
  const hasSerper = Boolean((serperApiKey || '').trim())
  onProgress({
    phase: 'search',
    message: `Pokrećem ${hasSerper ? 'Serper.dev Google' : 'paralelno web'} pretraživanje za: "${labelQuery}" (${city || 'Cijela Hrvatska'})...`,
  })

  const directoryCandidates: SerperSearchResult[] = []
  const directWebCandidates: SerperSearchResult[] = []
  const seenUrls = new Set<string>()

  // 1. Trenutna (<5 ms) pretraga već lokalno spremljene baze company_scraper.db
  if (registrySource === 'all' || registrySource === 'croatiabiz') {
    try {
      const storage = new CompanyStorage()
      const localHits = storage.searchLocalRaw(cleanQuery, city, 20)
      for (const cr of localHits) {
        if (isKnownEntity({ name: cr.companyName, oib: cr.oib || undefined, url: cr.websiteUrl || undefined })) {
          continue
        }
        if (cr.websiteUrl && !isDirectoryOrNonCompanyUrl(cr.websiteUrl)) {
          const origin = (() => {
            try {
              return new URL(cr.websiteUrl).origin
            } catch {
              return cr.websiteUrl
            }
          })()
          if (!seenUrls.has(origin)) {
            seenUrls.add(origin)
            directWebCandidates.push({
              title: cr.companyName,
              url: cr.websiteUrl,
              snippet: `${cr.companyName} ${cr.address || ''} ${cr.place || ''} OIB: ${cr.oib || ''}`,
              phone: cr.phone || undefined,
              address: cr.address || undefined,
              category: cr.activityName || undefined,
              source: 'Lokalni registar tvrtki',
            })
          }
        } else if (cr.companyName && cr.sourceUrl && !seenUrls.has(cr.sourceUrl)) {
          seenUrls.add(cr.sourceUrl)
          directoryCandidates.push({
            title: cr.companyName,
            url: cr.sourceUrl,
            snippet: `${cr.companyName} ${cr.address || ''} ${cr.place || ''} OIB: ${cr.oib || ''}`,
            phone: cr.phone || undefined,
            address: cr.address || undefined,
            category: cr.activityName || undefined,
            source: 'Lokalni registar tvrtki',
          })
        }
      }
    } catch {
      // lokalna baza je opcionalna
    }
  }

  // 2. Live Croatia.biz pokreće se ISKLJUČIVO ako korisnik eksplicitno odabere izvor 'croatiabiz'
  if (registrySource === 'croatiabiz' && !signal?.aborted) {
    try {
      const { CroatiaBizScraper } = await import('@/src/services/scrapers/croatiaBizScraper')
      const croatiaScraper = new CroatiaBizScraper()
      const citySlug = normalizeCroatiaBizSlug(city || 'zagreb')
      const liveLimit = Math.min(Math.max(Number(maxResults) || 10, 5) * 2, 25)
      let croRecords = await croatiaScraper.scrapePlace(citySlug, { limit: liveLimit })
      if (cleanQuery) {
        const qLower = cleanQuery.toLowerCase()
        croRecords = croRecords.filter(
          (cr) =>
            (cr.companyName && cr.companyName.toLowerCase().includes(qLower)) ||
            (cr.activityName && cr.activityName.toLowerCase().includes(qLower)) ||
            (cr.address && cr.address.toLowerCase().includes(qLower))
        )
      }
      for (const cr of croRecords) {
        if (isKnownEntity({ name: cr.companyName, oib: cr.oib || undefined, url: cr.websiteUrl || undefined })) {
          continue
        }
        if (cr.websiteUrl && !isDirectoryOrNonCompanyUrl(cr.websiteUrl)) {
          directWebCandidates.push({
            title: cr.companyName,
            url: cr.websiteUrl,
            snippet: `${cr.companyName} ${cr.address || ''} ${cr.place || ''} OIB: ${cr.oib || ''}`,
            phone: cr.phone || undefined,
            address: cr.address || undefined,
            source: 'Croatia.biz katalog',
          })
        } else if (cr.companyName) {
          directoryCandidates.push({
            title: cr.companyName,
            url: cr.sourceUrl || `https://www.croatia.biz/mjesta/${citySlug}/`,
            snippet: `${cr.companyName} ${cr.address || ''} ${cr.place || ''} OIB: ${cr.oib || ''}`,
            phone: cr.phone || undefined,
            address: cr.address || undefined,
            source: 'Croatia.biz katalog',
          })
        }
      }
    } catch (e: any) {
      console.warn('[Crawl] CroatiaBiz lookup warning:', e.message)
    }
  }

  // 3. Paralelno izvršavanje 2 search upita (Serper ili DDG+Bing+Yahoo)
  if (!signal?.aborted && registrySource !== 'croatiabiz') {
    const searchBatches = await Promise.allSettled(
      searchTerms.map((st) =>
        performCombinedSearch(st.q, {
          serperApiKey,
          signal,
          includePlaces: st.includePlaces,
        })
      )
    )

    for (const batch of searchBatches) {
      if (batch.status !== 'fulfilled') continue
      for (const item of batch.value) {
        let originOrUrl = item.url
        try {
          const u = new URL(item.url)
          const hostname = u.hostname.replace(/^www\./i, '')
          const isDir = isDirectoryOrNonCompanyUrl(item.url)
          if (!isDir) {
            originOrUrl = u.origin
            if (isKnownEntity({ domain: hostname, url: item.url })) {
              continue
            }
          }
        } catch {
          continue
        }

        if (seenUrls.has(originOrUrl)) continue
        seenUrls.add(originOrUrl)

        if (
          item.url.includes('fininfo.hr') ||
          item.url.includes('companywall.hr') ||
          item.url.includes('zutestranice.hr') ||
          item.url.includes('mojkvart.hr') ||
          item.url.includes('tvrtke.hr')
        ) {
          directoryCandidates.push(item)
        } else if (!isDirectoryOrNonCompanyUrl(item.url)) {
          directWebCandidates.push(item)
        }
      }
    }
  }

  if (signal?.aborted) return []

  onProgress({
    phase: 'crawl',
    message: `Pronađeno ${directWebCandidates.length} web stranica i ${directoryCandidates.length} zapisa u registrima. Pokrećem paralelnu analizu kontakata...`,
  })

  const limit = Math.min(Math.max(Number(maxResults) || 10, 1), 30)
  const combinedQueue: { kind: 'direct' | 'directory'; item: SerperSearchResult }[] = []

  // Prioritiziraj izravne web stranice tvrtki (brže i čišće adrese), zatim imenike
  for (const w of directWebCandidates) {
    combinedQueue.push({ kind: 'direct', item: w })
  }
  for (const d of directoryCandidates) {
    combinedQueue.push({ kind: 'directory', item: d })
  }

  const discovered: Lead[] = []
  const queueToProcess = combinedQueue.slice(0, Math.max(limit * 3, 18))
  const batchSeenKeys = new Set<string>()

  await runWithConcurrency(
    queueToProcess,
    6,
    async (entry) => {
      if (signal?.aborted || discovered.length >= limit) return

      if (entry.kind === 'direct' && isKnownEntity({ url: entry.item.url })) {
        return
      }

      let lead: Lead | null = null
      if (entry.kind === 'directory') {
        lead = await processDirectoryEntry(entry.item, {
          query: cleanQuery || 'Poslovni subjekt',
          city,
          entityType,
          serperApiKey,
          signal,
        })
      } else {
        const hints: Partial<Lead> & { snippet?: string } = {
          activity_category: entry.item.category || cleanQuery || 'Opće poslovanje',
          city,
          address: entry.item.address || '',
          phone: entry.item.phone || '',
          snippet: entry.item.snippet,
          entity_type: entityType === 'all' ? undefined : entityType,
          source: entry.item.source || 'Poslovni web',
          source_url: entry.item.url,
        }
        lead = await crawlCompanyWebsite(entry.item.url, hints, signal)
      }

      if (!lead || !lead.email || signal?.aborted || discovered.length >= limit) return

      const emailKey = lead.email.trim().toLowerCase()
      if (batchSeenKeys.has(emailKey)) return
      if (isKnownEntity({ email: lead.email, oib: lead.oib, name: lead.name, domain: lead.domain_norm || lead.website })) {
        return
      }

      batchSeenKeys.add(emailKey)
      markKnownEntity({ email: lead.email, oib: lead.oib, name: lead.name, domain: lead.website })
      discovered.push(lead)

      onProgress({
        phase: 'found',
        message: `Pronađen kontakt: ${lead.name} (${lead.email})${lead.contact_person ? ' — ' + lead.contact_person : ''}`,
        lead,
      })
    },
    signal
  )

  return discovered.slice(0, limit)
}
