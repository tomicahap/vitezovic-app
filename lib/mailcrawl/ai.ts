import type { CampaignSettings, Lead } from './types'

export function buildGreeting(lead: Partial<Lead>): string {
  const person = (lead.contact_person || '').trim()
  const name = (lead.name || '').trim()
  if (person) {
    const firstName = person.split(/\s+/)[0].toLowerCase()
    const isFemale = firstName.endsWith('a') && !['luka', 'nikola', 'matija', 'ilija', 'andrija', 'borna', 'saša', 'vanja', 'noa', 'toma'].includes(firstName)
    const parts = person.split(/\s+/)
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : person
    if (isFemale) {
      return `Poštovana gospođo ${lastName} (${person}),`
    }
    return `Poštovani gospodine ${lastName} (${person}),`
  }
  if (lead.entity_type === 'obrt') {
    return `Poštovani vlasniče i timu obrta ${name},`
  }
  if (lead.entity_type === 'udruga') {
    return `Poštovani članovi i vodstvo udruge ${name},`
  }
  return `Poštovani voditelji i timu tvrtke ${name},`
}

export function buildSmartFallbackEmail(lead: Partial<Lead>, settings: CampaignSettings): {
  subject: string
  body: string
  personalization_note: string
} {
  const greeting = buildGreeting(lead)
  const activityText = `${lead.activity_category || ''} ${lead.activity_summary || ''}`.toLowerCase()
  const cityMention = lead.city ? ` u mjestu ${lead.city}` : ''

  let personalBridge = ''
  let note = ''

  if (/it|softver|programir|računal|web|digital|tehnolog|aplikacij/.test(activityText)) {
    personalBridge = `Prateći rad Vaše tvrtke ${lead.name}${cityMention}, vidimo koliko svakodnevno ulažete u napredna digitalna rješenja i moderne tehnologije. Upravo je tehnologija most koji danas može spasiti ono najvrjednije iz naše prošlosti od trajnog zaborava.`
    note = 'Povezano s IT/tehnološkom djelatnošću tvrtke — naglasak na digitalizaciji i očuvanju podataka.'
  } else if (/stolar|drvo|namještaj|gradnj|građevin|arhitekt|projektir|instalacij|metal|proizvodnj/.test(activityText)) {
    personalBridge = `Kroz rad subjekta ${lead.name}${cityMention} stvarate trajne, opipljive vrijednosti koje ostaju generacijama. Kao što čvrsti temelji i predan obiteljski rad drže svaku građevinu i zanat, tako i poznavanje naših predaka drži naš identitet.`
    note = 'Povezano s proizvodnom/zanatskom/građevinskom djelatnošću — paralela između gradnje trajnih vrijednosti i očuvanja korijena.'
  } else if (/vino|vinarij|opg|poljoprivred|hrana|ugostitelj|restoran|hotel|turiz/.test(activityText)) {
    personalBridge = `U radu subjekta ${lead.name}${cityMention} osjeća se duboko poštovanje prema domaćoj tradiciji, zemlji i gostoljubivosti koja se u Hrvatskoj prenosi s koljena na koljeno. Upravo su te obiteljske priče srce našeg identiteta.`
    note = 'Povezano s tradicijom, turizmom i domaćim nasljeđem koje se prenosi kroz generacije.'
  } else if (/odvjetni|knjigovod|računovod|savjetovanj|financij|nekretnin/.test(activityText)) {
    personalBridge = `Vaš rad u ${lead.name}${cityMention} počiva na povjerenju, preciznosti i čuvanju važnih dokumenata i vrijednosti. U našem društvu s istom pažnjom čuvamo dokumente koji svjedoče o stotinama godina života hrvatskih obitelji.`
    note = 'Povezano s preciznošću, povjerenjem i čuvanjem važnih zapisa.'
  } else if (lead.entity_type === 'udruga' || /udruga|kultur|umjetn|baštin|obrazov|sport|društvo/.test(activityText)) {
    personalBridge = `Cijenimo predanost kojom ${lead.name}${cityMention} obogaćuje našu zajednicu i čuva temeljne društvene vrijednosti. Dijelimo istu strast — ostaviti budućim naraštajima trag o tome tko smo i odakle dolazimo.`
    note = 'Povezano s društvenim angažmanom i brigom za zajednicu i baštinu.'
  } else if (lead.entity_type === 'obrt') {
    personalBridge = `Svaki hrvatski obrt poput Vašeg (${lead.name}${cityMention}) nosi u sebi osobni trud, ime i priču koja se gradi godinama. Mi u Rodoslovnom društvu vjerujemo da niti jedna obiteljska priča i trud naših predaka ne smiju biti zaboravljeni.`
    note = 'Povezano s vrijednošću obrtništva, osobnog truda i obiteljskog nasljeđa.'
  } else {
    personalBridge = `Prateći rad i doprinos subjekta ${lead.name}${cityMention}, obraćamo Vam se s iskrenom zamolbom jer vjerujemo da uspješne hrvatske sredine razumiju koliko je važno znati odakle potječemo i tko su ljudi koji su gradili našu prošlost.`
    note = `Personalizirano prema nazivu subjekta (${lead.name}), lokaciji i djelatnosti.`
  }

  const subject = `${lead.name} i očuvanje hrvatskih korijena – mala pomoć za veliku baštinu`

  const body = `${greeting}

${personalBridge}

Mi u Hrvatskom rodoslovnom društvu već godinama predano istražujemo hrvatska rodoslovlja, stare matične knjige i obiteljske arhive. Nažalost, zub vremena neumoljivo nagriza stare zapise, a naša oprema više ne može pratiti opseg građe koju moramo spasiti.

Zato pokrećemo akciju prikupljanja donacija za kupnju prijeko potrebnih skenera i računala kojima ćemo digitalizirati istražena rodoslovlja i trajno ih sačuvati za budućnost – kako bi naša djeca i unuci jednim klikom mogli pronaći svoje pretke.

Svaka Vaša donacija, bez obzira na iznos, izravno ugrađuje jednu kockicu u očuvanje hrvatske obiteljske povijesti. Ako prepoznajete vrijednost našeg rada, od srca Vas molimo da nas podržite uplatom prema podacima u nastavku (ili jednostavnim skeniranjem 2D barkoda na dnu poruke).`

  return {
    subject,
    body,
    personalization_note: `${note} (Predložak bez AI ključa)`
  }
}

export async function listAvailableGeminiModels(apiKey: string): Promise<{ id: string; displayName: string; description?: string }[]> {
  const cleanKey = (apiKey || process.env.GEMINI_API_KEY || '').trim()
  if (!cleanKey) {
    throw new Error('Unesite Gemini API ključ kako biste dohvatili aktivne modele.')
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`
  const res = await fetch(url)
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Greška pri dohvatu modela (${res.status}): ${txt.slice(0, 180)}`)
  }
  const data = await res.json()
  const models = (data.models || [])
    .filter((m: any) => {
      const methods = m.supportedGenerationMethods || []
      const id = (m.name || '').replace(/^models\//, '')
      return methods.includes('generateContent') && id.startsWith('gemini-') && !/tts|image|embedding|vision|audio|veo|learnlm/i.test(id)
    })
    .map((m: any) => ({
      id: m.name.replace(/^models\//, ''),
      displayName: m.displayName || m.name.replace(/^models\//, ''),
      description: m.description || ''
    }))

  models.sort((a: any, b: any) => {
    const score = (id: string) => {
      let s = 0
      if (id.includes('3.8')) s += 50
      else if (id.includes('3.7')) s += 45
      else if (id.includes('3.5')) s += 40
      else if (id.includes('3.1')) s += 35
      else if (id.includes('3.0') || id.includes('gemini-3')) s += 30
      else if (id.includes('2.5')) s += 20
      if (id.includes('flash') && !id.includes('lite')) s += 5
      if (id.endsWith('-latest')) s -= 2
      return s
    }
    return score(b.id) - score(a.id)
  })

  return models
}

async function callGeminiGenerate(apiKey: string, modelId: string, prompt: string): Promise<Response> {
  const cleanModel = modelId.replace(/^models\//, '').trim()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey)}`
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json'
      }
    })
  })
}

export async function generatePersonalizedEmail(
  lead: Partial<Lead>,
  settings: CampaignSettings,
  customInstruction: string = ''
): Promise<{
  subject: string
  body: string
  personalization_note: string
  used_model?: string
  concise_activity?: string
}> {
  const apiKey = (settings.gemini_api_key || process.env.GEMINI_API_KEY || '').trim()
  let model = (settings.gemini_model || 'gemini-flash-latest').trim()

  if (!apiKey) {
    return buildSmartFallbackEmail(lead, settings)
  }

  const prompt = `Uloga: Stručnjak za personalizirani outreach i copywriting za neprofitne organizacije (Hrvatsko rodoslovno društvo).
Zadatak: Na temelju unesenog weba/opisa tvrtke generiraj personalizirani uvodni odlomak e-maila kojim tražimo podršku/donaciju za digitalizaciju arhivske građe.

Formula odlomka (točno 3 rečenice):
1. Specifični kompliment / prepoznavanje: Poveži se s djelatnošću tvrtke isticanjem njihove vještine, preciznosti ili vrijednosti koje stvaraju (bez jeftinog laskanja, profesionalno).
2. Most (Poveznica): Poveži ono što oni rade s misijom Rodoslovnog društva (fizičko vs. identitetsko/povijesno; temelj, kontinuitet, obitelj, detalji).
3. Poanta / Zajednička vrijednost: Zaokruži misao kako je očuvanje korijena i priča jednako važno kao i ono što oni grade/stvaraju za budućnost.

Ton: Topao, uvažavajući, profesionalan, kulturan, bez pretjerane patetike.
Duljina: Između 50 i 75 riječi.
Jezik: Hrvatski.

Zlatni primjer (Few-Shot primjer):
"U radu obrta CREO lako je prepoznati posvećenost detaljima, materijalima i pažljivom planiranju kako bi svaki prostor dobio svoj autentični potpis. Dok vi kreirate fizički okvir modernog doma, mi u Hrvatskom rodoslovnom društvu posvećeni smo onom nevidljivom, ali jednako važnom temelju – pričama, precima i korijenima koji taj isti dom ispunjavaju smislom. Baš kao što kvalitetan interijer spaja estetiku i trajnost, naša je misija osigurati da obiteljska povijest ostane sačuvana kroz generacije."

Ulazni podaci:
- Naziv subjekta: ${lead.name}
- Vrsta subjekta: ${lead.entity_type || 'tvrtka'}
- Grad / sjedište: ${lead.city || 'Hrvatska'}
- Djelatnost i fokus: ${lead.activity_category || ''} — ${lead.activity_summary || (lead.raw_scraped_text || '').slice(0, 1500)}
${customInstruction ? `- Dodatna napomena: ${customInstruction}` : ''}

Vrati isključivo valjani JSON objekt u formatu:
{
  "subject": "Kratak i topao naslov maila koji spominje ${lead.name} ili njihovu djelatnost i očuvanje baštine",
  "personalized_intro": "Ovdje unesi generirani odlomak (točno 3 rečenice, između 50 i 75 riječi, bez navodnika)",
  "personalization_note": "Kratka rečenica za admina: što je prepoznato kod subjekta i kako je povezano s rodoslovljem"
}`

  let response = await callGeminiGenerate(apiKey, model, prompt)

  if ([503, 429, 404].includes(response.status)) {
    const fallbackList = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-1.5-flash']
    for (const fbModel of fallbackList) {
      if (fbModel === model) continue
      try {
        const fbRes = await callGeminiGenerate(apiKey, fbModel, prompt)
        if (fbRes.ok) {
          model = fbModel
          response = fbRes
          break
        }
      } catch {
        // try next
      }
    }
  }

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini API greška (${response.status} na modelu ${model}): ${errText.slice(0, 200)}`)
  }

  const data = await response.json()
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  if (!rawText) {
    throw new Error('Gemini API nije vratio sadržaj.')
  }

  let introText = ''
  let subjectText = `${lead.name} i očuvanje hrvatskih korijena – podrška digitalizaciji rodoslovlja`
  let noteText = 'Generirano prema formuli (kompliment, most, poanta).'

  try {
    const parsed = JSON.parse(rawText)
    introText = (parsed.personalized_intro || parsed.body || '').trim()
    if (parsed.subject) subjectText = parsed.subject.trim()
    if (parsed.personalization_note) noteText = parsed.personalization_note.trim()
  } catch {
    introText = rawText.replace(/```json|```/g, '').trim()
  }

  const greeting = buildGreeting(lead)
  const fullBody = `${greeting}

${introText}

Mi u Hrvatskom rodoslovnom društvu već godinama predano radimo na istraživanju i spašavanju zaboravljene obiteljske povijesti. Kako bismo istražena rodoslovlja, stare matične knjige i vrijednu arhivsku građu trajno sačuvali od propadanja za buduće naraštaje, pokrenuli smo akciju prikupljanja donacija za kupnju profesionalnih skenera i računala za digitalizaciju.

Svaka Vaša podrška, bez obzira na iznos, izravno pomaže očuvanju hrvatskih korijena. Ako prepoznajete vrijednost ovog cilja, od srca Vas molimo da nas podržite uplatom prema podacima u nastavku (ili jednostavnim skeniranjem 2D barkoda za mobilno bankarstvo).`

  return {
    subject: subjectText,
    body: fullBody,
    personalization_note: `${noteText} [Model: ${model}]`,
    used_model: model
  }
}
