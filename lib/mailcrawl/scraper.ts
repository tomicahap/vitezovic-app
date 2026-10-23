import * as cheerio from 'cheerio'
import type { Lead } from './types'

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
]

function getRandomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

export async function fetchHtml(url: string, timeoutMs: number = 9000): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'hr-HR,hr;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      redirect: 'follow'
    })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return null
    }
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
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
  'poslovna.hr', 'boniteti.hr', 'bisnode.hr', 'mojadjelatnost.hr'
]

const IGNORED_EMAIL_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js', '.woff', '.woff2', '.ttf', '.pdf'
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
    if (IGNORED_EMAIL_EXTENSIONS.some(ext => email.endsWith(ext))) continue
    const domain = email.split('@')[1] || ''
    if (!domain || !domain.includes('.')) continue
    if (IGNORED_EMAIL_DOMAINS.some(d => domain === d || domain.endsWith('.' + d)) || domain.includes('companywall.')) continue
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
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function extractContactPerson(text: string): { person: string; role: string } {
  if (!text) return { person: '', role: '' }

  const upperCraftMatch = text.match(/\b(?:VL\.|VLASNIK(?:\s+OBRTA)?)[\s:,-]+([A-ZČĆŽŠĐ]{2,18}\s+[A-ZČĆŽŠĐ]{2,18})(?:\s+[A-ZČĆŽŠĐ]+|\b)/i)
  if (upperCraftMatch && upperCraftMatch[1]) {
    const candidate = toTitleCaseCroatian(upperCraftMatch[1].trim())
    const stopCities = ['Zagreb', 'Split', 'Rijeka', 'Osijek', 'Zadar', 'Pula', 'Varaždin', 'Hrvatska', 'Obrt']
    const parts = candidate.split(/\s+/).filter(w => !stopCities.includes(w))
    if (parts.length >= 2) {
      return { person: parts.slice(0, 2).join(' '), role: 'Vlasnik obrta' }
    }
  }

  const patterns = [
    { role: 'Vlasnik obrta', regex: /\b(?:vl\.|vlasnik(?:\s+obrta)?|nositelj\s+obrta)[\s:,-]+([A-ZČĆŽŠĐ][a-zčćžšđ]+\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+(?:\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+)?)/ },
    { role: 'Direktor / Uprava', regex: /\b(?:direktor(?:ica)?|član\s+uprave|predsjednik\s+uprave|osoba\s+ovlaštena\s+za\s+zastupanje|zastupnik)[\s:,-]+([A-ZČĆŽŠĐ][a-zčćžšđ]+\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+(?:\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+)?)/i },
    { role: 'Predsjednik udruge', regex: /\b(?:predsjednik(?:ca)?\s+udruge|predsjednik(?:ca)?\s+društva|tajnik(?:ca)?)[\s:,-]+([A-ZČĆŽŠĐ][a-zčćžšđ]+\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+(?:\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+)?)/i },
    { role: 'Kontakt osoba', regex: /\b(?:kontakt\s+osoba|voditelj(?:ica)?)[\s:,-]+([A-ZČĆŽŠĐ][a-zčćžšđ]+\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+(?:\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+)?)/i }
  ]

  const stopWords = [
    'Opći', 'Uvjeti', 'Pravila', 'Privatnosti', 'Zaštita', 'Podataka', 'Radno', 'Vrijeme',
    'Hrvatska', 'Zagreb', 'Split', 'Rijeka', 'Osijek', 'Društvo', 'Udruga', 'Obrt',
    'Ime', 'Prezime', 'Vaše', 'Tvrtke', 'Je', 'Naziv', 'Adresa', 'Poruka', 'Kontakt',
    'Osoba', 'Podaci', 'Uprava', 'Telefon', 'Mobitel', 'Pošalji', 'Upit', 'Korisnik',
    'Odgovorna', 'Ovlaštena', 'Zastupanje', 'Direktor', 'Vlasnik', 'Predsjednik'
  ]

  for (const p of patterns) {
    const m = text.match(p.regex)
    if (m && m[1]) {
      const candidate = m[1].trim()
      const words = candidate.split(/\s+/)
      if (
        words.length >= 2 &&
        words.length <= 3 &&
        words.every(w => /^[A-ZČĆŽŠĐ][a-zčćžšđ]{2,18}$/.test(w)) &&
        !words.some(w => stopWords.some(sw => sw.toLowerCase() === w.toLowerCase()))
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
  if (/\b(obrt|vl\.|vlasnik obrta|stolarski obrt|ugostiteljski obrt|građevinski obrt|uslužni obrt|proizvodni obrt|frizerski obrt|prijevoznički obrt)\b/.test(t)) {
    return 'obrt'
  }
  if (/\b(udruga|savez|klub|zaklada|zajednica|kud|kulturno društvo|sportsko društvo|добровољно|dobrovoljno vatrogasno društvo|planinarsko društvo)\b/.test(t)) {
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
  'Labin', 'Metković', 'Imotski', 'Knin', 'Vodice', 'Biograd na Moru', 'Nova Gradiška', 'Našice'
]

export function extractCity(text: string, defaultCity: string = ''): string {
  if (!text) return defaultCity
  const postalMatch = text.match(/\b([1-5]\d{4})\s+([A-ZČĆŽŠĐ][a-zčćžšđ]+(?:\s+[A-ZČĆŽŠĐa-zčćžšđ]+)?)/)
  if (postalMatch && postalMatch[2]) {
    const c = postalMatch[2].trim()
    if (CROATIAN_CITIES.some(city => c.toLowerCase().startsWith(city.toLowerCase()))) {
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
    .replace(/\s*[|\-–—•:]\s*(prihod,\s*dobit|Poslovni podaci|Financijski pokazatelji|Početna|Naslovnica|Home|Kontakt|O nama|Dobrodošli|Fininfo|CompanyWall|Žute stranice|MojKvart|Tvrtke\.hr|Poslovna Hrvatska).*$/i, '')
    .replace(/^(Početna|Naslovnica|Home|Kontakt|O nama)\s*[|\-–—•:]\s*/i, '')
    .replace(/\bOIB\s*\d{11}\b/gi, '')
    .trim()
  if (title.length > 80) {
    title = title.split(/[|\-–—]/)[0].trim()
  }
  return title
}

export async function crawlCompanyWebsite(siteUrl: string, hints: Partial<Lead> & { snippet?: string } = {}): Promise<Lead | null> {
  let normalizedUrl = siteUrl
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl
  }

  const homeHtml = await fetchHtml(normalizedUrl)
  if (!homeHtml) return null

  const $ = cheerio.load(homeHtml)
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
  const allEmails = new Set(extractEmailsFromHtml(homeHtml, cheerio.load(homeHtml)))

  const subUrlsToVisit = new Set<string>()
  const baseUrlObj = new URL(normalizedUrl)

  const $links = cheerio.load(homeHtml)
  $links('a[href]').each((_, el) => {
    const href = ($links(el).attr('href') || '').trim()
    const linkText = ($links(el).text() || '').toLowerCase()
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return
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
      // ignore
    }
  })

  let subpageTexts = ''
  const subUrlArray = Array.from(subUrlsToVisit).slice(0, 3)
  for (const subUrl of subUrlArray) {
    const subHtml = await fetchHtml(subUrl, 6500)
    if (!subHtml) continue
    const $subRaw = cheerio.load(subHtml)
    for (const em of extractEmailsFromHtml(subHtml, $subRaw)) {
      allEmails.add(em)
    }
    $subRaw('script, style, noscript, svg, iframe').remove()
    $subRaw('p').each((_, el) => {
      const txt = $subRaw(el).text().replace(/\s+/g, ' ').trim()
      if (txt.length >= 45 && txt.length <= 600 && !/kolačić|cookie|gdpr|copyright/i.test(txt)) {
        if (paragraphs.length < 10 && !paragraphs.includes(txt)) {
          paragraphs.push(txt)
        }
      }
    })
    subpageTexts += ' ' + $subRaw('body').text().replace(/\s+/g, ' ').trim().slice(0, 3500)
  }

  const combinedText = `${rawTitle} ${metaDesc} ${h1Text} ${h2Text} ${homeText.slice(0, 5000)} ${subpageTexts} ${hints.snippet || ''}`
  const emailsArr = Array.from(allEmails)
  const primaryEmail = emailsArr[0] || hints.email || ''

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
    all_emails: JSON.stringify(emailsArr),
    phone,
    contact_person: contactPerson,
    contact_role: contactRole,
    activity_category: hints.activity_category || '',
    activity_summary: activitySummary || `Poslovni subjekt (${entityType}) iz djelatnosti: ${hints.activity_category || 'opće poslovanje'}.`,
    raw_scraped_text: combinedText.slice(0, 5000),
    source: hints.source || 'Web / Registar',
    source_url: hints.source_url || normalizedUrl
  }
}

async function searchWebDuckDuckGo(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  const results: { title: string; url: string; snippet: string }[] = []
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=hr-hr`
    const html = await fetchHtml(url, 10000)
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

async function searchWebYahoo(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  const results: { title: string; url: string; snippet: string }[] = []
  try {
    const url = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}&ei=UTF-8`
    const html = await fetchHtml(url, 10000)
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

async function performCombinedSearch(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  const ddg = await searchWebDuckDuckGo(query)
  if (ddg.length >= 3) return ddg
  const yahoo = await searchWebYahoo(query)
  const seen = new Set(ddg.map(r => r.url))
  for (const r of yahoo) {
    if (!seen.has(r.url)) {
      ddg.push(r)
      seen.add(r.url)
    }
  }
  return ddg
}

const DIRECTORY_DOMAINS = [
  'fininfo.hr', 'el-koncept.hr', 'companywall.hr', 'zutestranice.hr',
  'mojkvart.hr', 'tvrtke.hr', 'mojadjelatnost.hr', 'poslovna.hr',
  'boniteti.hr', 'bisnode.hr', 'dun-bradstreet.com', 'moj-eracun.hr',
  'registri.uprava.hr', 'gov.hr', 'facebook.com', 'instagram.com',
  'linkedin.com', 'youtube.com', 'wikipedia.org', 'index.hr',
  'jutarnji.hr', 'vecernji.hr', '24sata.hr', 'poslovni.hr',
  'lidermedia.hr', 'hgk.hr', 'hok.hr', 'njuskalo.hr', 'cookiebot.com'
]

function isDirectoryOrNonCompanyUrl(urlStr: string): boolean {
  try {
    const host = new URL(urlStr).hostname.toLowerCase()
    if (host.includes('companywall.') || host.includes('fininfo.')) return true
    return DIRECTORY_DOMAINS.some(d => host === d || host.endsWith('.' + d))
  } catch {
    return true
  }
}

async function processDirectoryEntry(
  entry: { title: string; url: string; snippet: string },
  context: { query: string; city: string; entityType: string }
): Promise<Lead | null> {
  const combined = `${entry.title} ${entry.snippet}`
  const oib = extractOib(combined)
  const contact = extractContactPerson(combined)
  const city = extractCity(combined, context.city)

  const compName = cleanCompanyName(entry.title)
  if (!compName || compName.length < 3) return null

  let sourceLabel = 'Poslovni registar'
  if (entry.url.includes('fininfo.hr')) sourceLabel = 'Fininfo registar'
  else if (entry.url.includes('companywall.hr')) sourceLabel = 'CompanyWall registar'
  else if (entry.url.includes('zutestranice.hr')) sourceLabel = 'Žute stranice'
  else if (entry.url.includes('mojkvart.hr')) sourceLabel = 'MojKvart imenik'
  else if (entry.url.includes('tvrtke.hr')) sourceLabel = 'Tvrtke.hr imenik'

  let dirEmails: string[] = []
  let dirContact = contact
  let dirOib = oib
  let officialWebFromDir = ''

  const dirHtml = await fetchHtml(entry.url, 6500)
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
  if (!officialWebsite) {
    const shortLookupName = compName.replace(/\b(ZAGREB|SPLIT|RIJEKA|OSIJEK|VARAŽDIN|ZADAR|PULA)\b/gi, '').trim()
    const lookupResults = await performCombinedSearch(`"${shortLookupName}" ${city || ''} kontakt OR email`)
    for (const r of lookupResults) {
      if (!isDirectoryOrNonCompanyUrl(r.url)) {
        officialWebsite = r.url
        break
      }
    }
  }

  const hints: any = {
    name: compName,
    oib: dirOib,
    city,
    email: dirEmails[0] || '',
    contact_person: dirContact.person,
    contact_role: dirContact.role,
    activity_category: context.query,
    snippet: entry.snippet,
    entity_type: detectEntityType(`${compName} ${entry.snippet}`, context.entityType === 'all' ? 'tvrtka' : context.entityType),
    source: sourceLabel,
    source_url: entry.url
  }

  if (officialWebsite) {
    const crawled = await crawlCompanyWebsite(officialWebsite, hints)
    if (crawled && crawled.email) return crawled
  }

  if (hints.email) {
    return {
      name: hints.name,
      entity_type: hints.entity_type,
      oib: hints.oib,
      city: hints.city,
      address: '',
      website: officialWebsite || '',
      email: hints.email,
      all_emails: JSON.stringify(dirEmails),
      phone: extractPhone(combined),
      contact_person: hints.contact_person,
      contact_role: hints.contact_role,
      activity_category: hints.activity_category,
      activity_summary: entry.snippet || `Subjekt pronađen u registru (${sourceLabel}).`,
      raw_scraped_text: combined,
      source: sourceLabel,
      source_url: entry.url
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
  'drvo prerada pilana "d.o.o."'
]

let rotationIndex = Math.floor(Math.random() * 20)

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
    isKnownEntity = () => false
  }: {
    query?: string
    city?: string
    entityType?: string
    registrySource?: string
    maxResults?: number
    isKnownEntity?: (candidate: { name?: string; domain?: string; oib?: string; url?: string; email?: string }) => boolean
  },
  onProgress: (p: ProgressCallbackData) => void = () => {}
): Promise<Lead[]> {
  const searchTerms: string[] = []
  const locationPart = city ? ` ${city}` : ' Hrvatska'
  const cleanQuery = String(query || '').trim()

  let typeKeyword = ''
  if (entityType === 'tvrtka') typeKeyword = ' "d.o.o."'
  else if (entityType === 'obrt') typeKeyword = ' "obrt"'
  else if (entityType === 'udruga') typeKeyword = ' "udruga"'

  if (cleanQuery) {
    searchTerms.push(`${cleanQuery}${typeKeyword}${locationPart} kontakt email`)
    if (registrySource === 'imenici' || registrySource === 'all') {
      searchTerms.push(`(site:zutestranice.hr OR site:mojkvart.hr OR site:tvrtke.hr) ${cleanQuery}${locationPart}`)
    }
    if (registrySource === 'fininfo' || registrySource === 'all') {
      searchTerms.push(`site:fininfo.hr ${cleanQuery}${locationPart}`)
    }
    if (registrySource === 'companywall' || registrySource === 'all') {
      searchTerms.push(`site:companywall.hr ${cleanQuery}${locationPart}`)
    }
    if (registrySource === 'udruge' || entityType === 'udruga') {
      searchTerms.push(`"udruga" ${cleanQuery}${locationPart} kontakt email`)
    }
    searchTerms.push(`${cleanQuery}${typeKeyword}${locationPart} "o nama" kontakt`)
  } else {
    const baseTypeTerm =
      entityType === 'tvrtka' ? '"d.o.o." OR "j.d.o.o."' :
      entityType === 'obrt' ? '"obrt" OR "vl."' :
      entityType === 'udruga' ? '"udruga" OR "društvo"' :
      '"d.o.o." OR "obrt" OR "udruga"'

    const rotated: string[] = []
    for (let i = 0; i < 3; i++) {
      rotated.push(GENERAL_ROTATION_QUERIES[(rotationIndex + i) % GENERAL_ROTATION_QUERIES.length])
    }
    rotationIndex = (rotationIndex + 3) % GENERAL_ROTATION_QUERIES.length

    for (const rot of rotated) {
      searchTerms.push(`${rot}${locationPart} kontakt email`)
    }
    searchTerms.push(`(${baseTypeTerm})${locationPart} "o nama" kontakt email`)
    if (registrySource === 'imenici' || registrySource === 'all') {
      searchTerms.push(`(site:zutestranice.hr OR site:mojkvart.hr OR site:tvrtke.hr) ${rotated[0]}${locationPart}`)
    }
    if (registrySource === 'fininfo' || registrySource === 'all') {
      searchTerms.push(`site:fininfo.hr ${rotated[0]}${locationPart}`)
    }
    if (registrySource === 'companywall' || registrySource === 'all') {
      searchTerms.push(`site:companywall.hr ${rotated[0]}${locationPart}`)
    }
  }

  const labelQuery = cleanQuery || 'Opća pretraga svih djelatnosti (Tvrtke, Obrti, Udruge)'
  onProgress({
    phase: 'search',
    message: `Pokrećem pretraživanje hrvatskih registara i poslovnih imenika za: "${labelQuery}" (${city || 'Cijela Hrvatska'})...`
  })

  const directoryCandidates: { title: string; url: string; snippet: string }[] = []
  const directWebCandidates: { title: string; url: string; snippet: string }[] = []
  const seenUrls = new Set<string>()

  for (const q of searchTerms) {
    const res = await performCombinedSearch(q)
    for (const item of res) {
      let originOrUrl = item.url
      try {
        const u = new URL(item.url)
        const hostname = u.hostname.replace(/^www\./i, '')
        
        // Zero-cost skipping if domain or title already in DB
        if (isKnownEntity({ domain: hostname, url: item.url, name: item.title })) {
          continue
        }

        if (!isDirectoryOrNonCompanyUrl(item.url)) {
          originOrUrl = u.origin
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
    if (directWebCandidates.length >= maxResults * 2 && directoryCandidates.length >= maxResults) {
      break
    }
  }

  onProgress({
    phase: 'crawl',
    message: `Pronađeno ${directoryCandidates.length} zapisa u registrima i ${directWebCandidates.length} novih web stranica. Započinjem dubinsku analizu kontakata i djelatnosti...`
  })

  const discovered: Lead[] = []
  const limit = Math.min(Math.max(Number(maxResults) || 10, 1), 30)

  const combinedQueue: { kind: 'direct' | 'directory'; item: { title: string; url: string; snippet: string } }[] = []
  const maxLen = Math.max(directoryCandidates.length, directWebCandidates.length)
  for (let i = 0; i < maxLen; i++) {
    if (i < directWebCandidates.length) combinedQueue.push({ kind: 'direct', item: directWebCandidates[i] })
    if (i < directoryCandidates.length) combinedQueue.push({ kind: 'directory', item: directoryCandidates[i] })
  }

  for (const entry of combinedQueue) {
    if (discovered.length >= limit) break

    // Zero-cost pre-check before fetching full HTML
    if (isKnownEntity({ url: entry.item.url, name: entry.item.title })) {
      continue
    }

    if (entry.kind === 'directory') {
      onProgress({
        phase: 'analyzing',
        message: `Analiziram zapis iz registra: ${entry.item.title.slice(0, 60)}...`
      })
      const lead = await processDirectoryEntry(entry.item, { query: cleanQuery || 'Poslovni subjekt', city, entityType })
      if (lead && lead.email) {
        if (isKnownEntity({ email: lead.email, oib: lead.oib, name: lead.name, domain: lead.domain_norm })) {
          onProgress({
            phase: 'search',
            message: `Subjekt ${lead.name} je već u evidenciji, preskačem.`
          })
          continue
        }
        discovered.push(lead)
        onProgress({
          phase: 'found',
          message: `Pronađen kontakt: ${lead.name} (${lead.email})${lead.contact_person ? ' — ' + lead.contact_person : ''}`,
          lead
        })
      }
    } else {
      onProgress({
        phase: 'analyzing',
        message: `Pregledavam web stranicu: ${entry.item.url}...`
      })
      const hints = {
        activity_category: cleanQuery || 'Opće poslovanje',
        city,
        snippet: entry.item.snippet,
        entity_type: entityType === 'all' ? undefined : entityType,
        source: 'Poslovni web',
        source_url: entry.item.url
      }
      const lead = await crawlCompanyWebsite(entry.item.url, hints)
      if (lead && lead.email) {
        if (isKnownEntity({ email: lead.email, oib: lead.oib, name: lead.name, domain: lead.domain_norm })) {
          onProgress({
            phase: 'search',
            message: `Subjekt ${lead.name} je već u evidenciji, preskačem.`
          })
          continue
        }
        discovered.push(lead)
        onProgress({
          phase: 'found',
          message: `Pronađen kontakt: ${lead.name} (${lead.email})${lead.contact_person ? ' — ' + lead.contact_person : ''}`,
          lead
        })
      }
    }
  }

  return discovered
}
