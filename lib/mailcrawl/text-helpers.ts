import type { Lead } from './types'

/**
 * Automatski ispravlja i osigurava velika početna slova za zamjenice iz poštovanja u hrvatskom jeziku:
 * Vi, Vas, Vam, Vama, Vaš, Vaša, Vaše, Vašeg, Vašega, Vašem, Vašemu, Vašu, Vašim, Vašima, Vaših, Vašom.
 * Ne mijenja email adrese, URL-ove i web poveznice.
 */
export function capitalizeRespectfulPronouns(text: string): string {
  if (!text) return ''

  const pronounsMap: Record<string, string> = {
    'vi': 'Vi',
    'vas': 'Vas',
    'vam': 'Vam',
    'vama': 'Vama',
    'vaš': 'Vaš',
    'vaša': 'Vaša',
    'vase': 'Vaše',
    'vaše': 'Vaše',
    'vašeg': 'Vašeg',
    'vašega': 'Vašega',
    'vašem': 'Vašem',
    'vašemu': 'Vašemu',
    'vašu': 'Vašu',
    'vašim': 'Vašim',
    'vašima': 'Vašima',
    'vaših': 'Vaših',
    'vašom': 'Vašom',
  }

  return text.replace(/(?<![a-zA-ZčćžšđČĆŽŠĐ@./:])(vi|vas|vam|vama|vaš|vaša|vaše|vašeg|vašega|vašem|vašemu|vašu|vašim|vašima|vaših|vašom)(?![a-zA-ZčćžšđČĆŽŠĐ@./:])/gi, (match) => {
    const lower = match.toLowerCase()
    return pronounsMap[lower] || (match.charAt(0).toUpperCase() + match.slice(1))
  })
}

/**
 * Osigurava puni službeni naziv: Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”
 * bez dupliciranja kad je „Pavao Ritter Vitezović” već naveden u navodnicima („...”, "...", '...').
 */
export function normalizeOrganizationName(text: string): string {
  if (!text) return ''
  let res = text
  const lookahead = '(?!\\s*["„“”\'‚‘’«»\\-–—]?\\s*Pavao\\s+Ritter\\s+Vitezovi[ćc])'
  res = res.replace(
    new RegExp(`Hrvatskom rodoslovnom društvu${lookahead}`, 'gi'),
    'Hrvatskom rodoslovnom društvu „Pavao Ritter Vitezović”'
  )
  res = res.replace(
    new RegExp(`Hrvatsko rodoslovno društvo${lookahead}`, 'gi'),
    'Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”'
  )
  res = res.replace(
    new RegExp(`Hrvatskog rodoslovnog društva${lookahead}`, 'gi'),
    'Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović”'
  )
  res = res.replace(
    new RegExp(`(?<!Hrvatskom\\s+)Rodoslovnom društvu${lookahead}`, 'gi'),
    'Hrvatskom rodoslovnom društvu „Pavao Ritter Vitezović”'
  )
  // Ukloni eventualna uzastopna ponavljanja (npr. Pavao Ritter Vitezović „Pavao Ritter Vitezović”)
  res = res.replace(
    /(["„“'«]?)\s*Pavao\s+Ritter\s+Vitezovi[ćc]\s*(["”’»]?)(?:[\s,–—\-]*)(["„“'«]?)\s*Pavao\s+Ritter\s+Vitezovi[ćc]\s*(["”’»]?)/gi,
    (_m, qOpen1, _qClose1, qOpen2) =>
      qOpen1 || qOpen2 ? '„Pavao Ritter Vitezović”' : 'Pavao Ritter Vitezović'
  )
  return res
}

export function buildGreeting(lead: Partial<Lead>): string {
  const person = (lead.contact_person || '').trim()
  if (person) {
    const firstName = person.split(/\s+/)[0].toLowerCase()
    const isFemale = firstName.endsWith('a') && !['luka', 'nikola', 'matija', 'ilija', 'andrija', 'borna', 'saša', 'vanja', 'noa', 'toma'].includes(firstName)
    if (isFemale) {
      return `Poštovana gospođo ${person},`
    }
    return `Poštovani gospodine ${person},`
  }
  return 'Poštovani,'
}
