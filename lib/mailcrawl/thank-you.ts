import 'server-only'
import { DatabaseService, MailSendersDB } from '@/lib/database'
import {
  buildHrdMasterEmail,
  deduplicateHrdOrganizationName,
  escapeHtml,
  type SenderIdentityInput,
} from '@/lib/hrd-email-system'
import { formatDateDMY } from '@/lib/utils'
import {
  buildGreeting,
  capitalizeRespectfulPronouns,
  normalizeOrganizationName,
} from '@/lib/mailcrawl/ai'
import { createSmtpTransporter } from '@/lib/mailcrawl/mailer'
import { getCampaignSettings, isOptedOut } from '@/lib/mailcrawl/db'
import { recordApiUsage } from '@/lib/mailcrawl/usage'
import type { CampaignSettings } from '@/lib/mailcrawl/types'
import { assertEmailsAllowedToContact } from '@/lib/do-not-contact'
import { getGoogleWorkspaceClients } from '@/lib/google-auth'
import { buildRawMimeMessage } from '@/lib/mime-builder'
import { sendEmail } from '@/lib/mail'

export interface DonorThankYouContext {
  leadId?: number
  sentId?: number
  memberId?: number | null
  name: string
  entityType?: string
  contactPerson?: string
  contactRole?: string
  email?: string
  city?: string
  oib?: string
  website?: string
  activityCategory?: string
  activitySummary?: string
  donatedAmount: string
  donatedAt: string
  donationNote?: string
  thankYouSentAt?: string
  thankYouSentTo?: string
  thankYouCount?: number
  thankYouSubject?: string
  thankYouBody?: string
}

export interface ThankYouDraftResult {
  subject: string
  greeting: string
  body: string
  personalizationNote: string
  usedModel?: string
}

export function isPlaceholderDonorEmail(email?: string | null): boolean {
  const clean = String(email || '').trim().toLowerCase()
  if (!clean) return true
  if (clean.endsWith('@manual.local')) return true
  if (clean.includes('#don-')) return true
  if (clean.includes('izravna uplata')) return true
  if (!clean.includes('@') || !clean.includes('.')) return true
  return false
}

export function formatDonationAmountEur(raw?: string | number | null): string {
  const num = parseFloat(String(raw ?? '0').replace(',', '.').replace(/[^0-9.\-]/g, ''))
  if (!Number.isFinite(num) || num <= 0) {
    const rawStr = String(raw || '').trim()
    return rawStr ? `${rawStr} EUR` : 'Evidentirana donacija'
  }
  return `${num.toFixed(2).replace('.', ',')} EUR`
}

export function isMemberDonor(ctx: Pick<DonorThankYouContext, 'entityType' | 'memberId'>): boolean {
  const et = String(ctx.entityType || '').trim().toLowerCase()
  return et === 'clan' || Boolean(ctx.memberId && Number(ctx.memberId) > 0)
}

export function isIndividualDonor(ctx: Pick<DonorThankYouContext, 'entityType' | 'name' | 'memberId'>): boolean {
  if (isMemberDonor(ctx)) return true
  const et = String(ctx.entityType || '').trim().toLowerCase()
  if (et === 'fizicka_osoba' || et === 'osoba' || et === 'gradanin') return true
  if (et === 'tvrtka' || et === 'obrt' || et === 'udruga') return false
  return !/\b(d\.o\.o\.|j\.d\.o\.o\.|d\.d\.|obrt|udruga|zaklada|zadruga|institut|opg|vl\.)\b/i.test(
    ctx.name || ''
  )
}

function extractMeaningfulDonationNote(rawNote?: string | null): string {
  const raw = String(rawNote || '').trim()
  if (!raw) return ''
  const parts = raw
    .split('|')
    .map((p) => p.trim())
    .filter((p) => {
      if (!p) return false
      const lower = p.toLowerCase()
      if (lower === 'uplaćeno prema pozivu za donaciju') return false
      if (lower === 'donacija za rad društva i digitalizaciju') return false
      if (lower.startsWith('način uplate:')) return false
      return true
    })
  return parts.join(' • ').trim()
}

function getEntityLabelCroatian(entityType?: string): 'tvrtka' | 'obrt' | 'udruga' | 'fizička osoba' {
  const et = String(entityType || '').trim().toLowerCase()
  if (et === 'obrt') return 'obrt'
  if (et === 'udruga') return 'udruga'
  if (et === 'fizicka_osoba') return 'fizička osoba'
  return 'tvrtka'
}

export function buildDonorGreeting(ctx: Pick<DonorThankYouContext, 'name' | 'entityType' | 'contactPerson'>): string {
  const individual = isIndividualDonor(ctx)
  const person = (ctx.contactPerson || '').trim() || (individual ? (ctx.name || '').trim() : '')
  if (person) {
    return buildGreeting({ contact_person: person })
  }
  return 'Poštovani,'
}

export function buildPersonalizedThankYouDraft(ctx: DonorThankYouContext): ThankYouDraftResult {
  const memberDonor = isMemberDonor(ctx)
  const individual = isIndividualDonor(ctx)
  const amountFormatted = formatDonationAmountEur(ctx.donatedAmount)
  const dateFormatted = ctx.donatedAt ? formatDateDMY(ctx.donatedAt, ctx.donatedAt) : ''
  const meaningfulNote = extractMeaningfulDonationNote(ctx.donationNote)
  const greeting = buildDonorGreeting(ctx)
  const donorName = String(ctx.name || 'Donator').trim()
  const contact = String(ctx.contactPerson || '').trim()
  const cityMention = ctx.city ? ` (${ctx.city})` : ''

  const datePhrase = dateFormatted ? ` evidentiranu dana ${dateFormatted}` : ''
  const purposePhrase = meaningfulNote
    ? ` za namjenu „${meaningfulNote}”`
    : ''

  if (memberDonor) {
    const subject = `Iskrena zahvala članu Društva na donaciji — Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”`
    const body = `${greeting}

od srca Vam zahvaljujemo na Vašoj dodatnoj, velikodušnoj donaciji u iznosu od ${amountFormatted}${datePhrase}${purposePhrase}, kojom uz svoje članstvo dodatno podupirete rad i projekte Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović”.

Posebno cijenimo nesebičnu odanost naših članica i članova koji svojim doprinosom omogućuju očuvanje starih matičnih knjiga, nabavu opreme za digitalizaciju i daljnja rodoslovna istraživanja za buduće naraštaje.

Još jednom Vam iskreno hvala na povjerenju, zajedništvu i plemenitoj podršci našem Društvu.`

    return {
      subject: capitalizeRespectfulPronouns(normalizeOrganizationName(subject)),
      greeting,
      body: capitalizeRespectfulPronouns(normalizeOrganizationName(body)),
      personalizationNote: `Personalizirana zahvala za člana Društva (${donorName}, ${amountFormatted}${dateFormatted ? `, ${dateFormatted}` : ''}).`,
    }
  }

  if (individual) {
    const subject = `Iskrena zahvala na Vašoj donaciji — Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”`
    const body = `${greeting}

u ime Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović” i svih naših istraživača od srca Vam zahvaljujemo na velikodušnoj donaciji u iznosu od ${amountFormatted}${datePhrase}${purposePhrase}.

Vaša osobna podrška izravno pridonosi istraživanju hrvatskih rodoslovlja, digitalizaciji starih matičnih knjiga te očuvanju obiteljske i zavičajne baštine za buduće naraštaje. Upravo zahvaljujući ljudima koji prepoznaju vrijednost naših korijena i obiteljskih priča, ova dragocjena građa ostaje trajno sačuvana od zaborava.

Još jednom Vam iskreno hvala na povjerenju, plemenitosti i podršci našem radu.`

    return {
      subject: capitalizeRespectfulPronouns(normalizeOrganizationName(subject)),
      greeting,
      body: capitalizeRespectfulPronouns(normalizeOrganizationName(body)),
      personalizationNote: `Personalizirana zahvala za fizičku osobu (${donorName}, ${amountFormatted}${dateFormatted ? `, ${dateFormatted}` : ''}).`,
    }
  }

  const entityWord = getEntityLabelCroatian(ctx.entityType)
  const entityNounInstrumental =
    entityWord === 'obrt'
      ? `obrtu ${donorName}`
      : entityWord === 'udruga'
      ? `udruzi ${donorName}`
      : `tvrtki ${donorName}`
  const entityNounGenitive =
    entityWord === 'obrt'
      ? `obrta ${donorName}`
      : entityWord === 'udruga'
      ? `udruge ${donorName}`
      : `tvrtke ${donorName}`

  const subject = `Iskrena zahvala ${entityWord === 'obrt' ? 'obrtu' : entityWord === 'udruga' ? 'udruzi' : 'tvrtki'} ${donorName} na donaciji za očuvanje baštine`

  const opener = contact
    ? `u ime Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović” najiskrenije zahvaljujemo Vama osobno i ${entityNounInstrumental}${cityMention} na vrijednoj donaciji u iznosu od ${amountFormatted}${datePhrase}${purposePhrase}.`
    : `u ime Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović” najiskrenije zahvaljujemo ${entityNounInstrumental}${cityMention} na vrijednoj donaciji u iznosu od ${amountFormatted}${datePhrase}${purposePhrase}.`

  const activityBridge = ctx.activityCategory
    ? ` Posebno cijenimo što uz vlastitu djelatnost (${ctx.activityCategory}) pokazujete istinsku društvenu odgovornost i brigu za očuvanje hrvatske kulturne i obiteljske baštine.`
    : ` Posebno cijenimo Vašu društvenu odgovornost i spremnost da podržite očuvanje hrvatske kulturne i obiteljske baštine.`

  const body = `${greeting}

${opener}

Vaša podrška izravno omogućuje nabavu opreme i digitalizaciju starih matičnih knjiga, rodoslovnih zbirki i povijesnih zapisa, kako bi ostali trajno dostupni istraživačima i budućim generacijama.${activityBridge}

Doprinos ${entityNounGenitive} ugrađuje važan kamenčić u mozaik očuvanja naših korijena te Vam se radujemo i u budućim prigodama suradnje i očuvanja hrvatske povijesne memorije.`

  return {
    subject: capitalizeRespectfulPronouns(normalizeOrganizationName(subject)),
    greeting,
    body: capitalizeRespectfulPronouns(normalizeOrganizationName(body)),
    personalizationNote: `Personalizirana zahvala za ${entityWord} ${donorName} (${amountFormatted}${dateFormatted ? `, ${dateFormatted}` : ''}).`,
  }
}

async function callGeminiThankYou(apiKey: string, modelId: string, prompt: string): Promise<Response> {
  const cleanModel = modelId.replace(/^models\//, '').trim()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const makeRequest = (withZeroThinking: boolean) => {
    const generationConfig: Record<string, any> = {
      temperature: 0.65,
      responseMimeType: 'application/json',
    }
    if (withZeroThinking && /(?:2\.5|3\.|gemini-3|flash)/i.test(cleanModel)) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 }
    }
    return fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      }),
    })
  }

  let res = await makeRequest(true)
  if (res.status === 400) {
    res = await makeRequest(false)
  }
  if (res.ok) {
    const cloned = await res.clone().json().catch(() => null)
    recordApiUsage({
      provider: 'gemini',
      operation: 'thank_you',
      model: cleanModel,
      credits: 1,
      inputTokens: Number(cloned?.usageMetadata?.promptTokenCount || 0),
      outputTokens: Number(cloned?.usageMetadata?.candidatesTokenCount || 0),
      statusCode: res.status,
      success: true,
    })
  } else {
    const errTxt = await res.clone().text().catch(() => '')
    recordApiUsage({
      provider: 'gemini',
      operation: 'thank_you',
      model: cleanModel,
      credits: 0,
      statusCode: res.status,
      success: false,
      errorMessage: errTxt.slice(0, 180),
    })
  }
  return res
}

export async function generateAiThankYouDraft(
  ctx: DonorThankYouContext,
  settings: CampaignSettings,
  customInstruction = ''
): Promise<ThankYouDraftResult> {
  const apiKey = (settings.gemini_api_key || process.env.GEMINI_API_KEY || '').trim()
  if (!apiKey) {
    return buildPersonalizedThankYouDraft(ctx)
  }

  let model = (settings.gemini_model || 'gemini-flash-latest').trim()
  const memberDonor = isMemberDonor(ctx)
  const individual = isIndividualDonor(ctx)
  const amountFormatted = formatDonationAmountEur(ctx.donatedAmount)
  const dateFormatted = ctx.donatedAt ? formatDateDMY(ctx.donatedAt, ctx.donatedAt) : ''
  const meaningfulNote = extractMeaningfulDonationNote(ctx.donationNote)
  const greeting = buildDonorGreeting(ctx)

  const prompt = `Uloga: Predsjedništvo i tajništvo neprofitne udruge Hrvatsko rodoslovno društvo Pavao Ritter Vitezović.
Zadatak: Napiši iskren, topao, kulturan i profesionalan e-mail ZAHVALE za već zaprimljenu donaciju (ne tražimo novu uplatu i ne spominjemo uplatnicu niti barkod!).

Podaci o donatoru i uplati:
- Vrsta donatora: ${memberDonor ? 'Član/ica Društva (dodatna dobrovoljna donacija uz članstvo)' : individual ? 'Fizička osoba / građanin' : getEntityLabelCroatian(ctx.entityType)}
- Naziv / Ime i prezime donatora: ${ctx.name}
${ctx.contactPerson ? `- Kontakt osoba: ${ctx.contactPerson}${ctx.contactRole ? ` (${ctx.contactRole})` : ''}` : ''}
${ctx.city ? `- Mjesto / grad: ${ctx.city}` : ''}
${ctx.activityCategory || ctx.activitySummary ? `- Djelatnost: ${[ctx.activityCategory, ctx.activitySummary].filter(Boolean).join(' — ').slice(0, 600)}` : ''}
- Iznos donacije: ${amountFormatted}
${dateFormatted ? `- Datum donacije: ${dateFormatted}` : ''}
${meaningfulNote ? `- Svrha / napomena uplate: ${meaningfulNote}` : ''}
${customInstruction ? `- Posebna uputa administratora: ${customInstruction}` : ''}

Obavezna pravila:
1. Jezik: isključivo hrvatski jezik s ispravnim dijakritičkim znakovima (č, ć, ž, š, đ).
2. Zamjenice iz poštovanja (Vi, Vas, Vam, Vama, Vaš, Vaša, Vaše, Vašeg, Vašem, Vašu, Vašim, Vaših) OBAVEZNO piši velikim početnim slovom!
3. Kada spominješ društvo, OBAVEZNO koristi puni naziv: Hrvatsko rodoslovno društvo Pavao Ritter Vitezović.
4. Prvi redak tijela poruke započni točnim oslovljavanjem: "${greeting}".
5. Napiši 2 do 3 skladna odlomka zahvale (ukupno ~80–130 riječi), bez ponovnog traženja novca, uplatnica ili potpisa na kraju (službeni potpis društva automatski se dodaje u podnožje HTML poruke).
6. Vrati isključivo valjani JSON objekt:
{
  "subject": "Topao i konkretan naslov zahvale na hrvatskom jeziku",
  "body": "Oslovljavanje i 2-3 odlomka teksta zahvale odvojena praznim retkom",
  "personalization_note": "Kratka napomena za administratora kako je poruka personalizirana"
}`

  let response = await callGeminiThankYou(apiKey, model, prompt)
  if ([503, 429, 404].includes(response.status)) {
    const fallbackList = [
      'gemini-flash-latest',
      'gemini-flash-lite-latest',
      'gemini-2.5-flash',
      'gemini-1.5-flash',
    ]
    for (const fbModel of fallbackList) {
      if (fbModel === model) continue
      try {
        const fbRes = await callGeminiThankYou(apiKey, fbModel, prompt)
        if (fbRes.ok) {
          model = fbModel
          response = fbRes
          break
        }
      } catch {}
    }
  }

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(
      `Gemini API greška (${response.status} na modelu ${model}): ${errText.slice(0, 180)}`
    )
  }

  const data = await response.json()
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  if (!rawText) {
    throw new Error('Gemini API nije vratio sadržaj zahvale.')
  }

  const fallback = buildPersonalizedThankYouDraft(ctx)
  let subjectText = fallback.subject
  let bodyText = fallback.body
  let noteText = `AI personalizirana zahvala (${model})`

  try {
    const parsed = JSON.parse(rawText)
    if (parsed?.subject) subjectText = String(parsed.subject).trim()
    if (parsed?.body) bodyText = String(parsed.body).trim()
    if (parsed?.personalization_note) noteText = `${String(parsed.personalization_note).trim()} [Model: ${model}]`
  } catch {
    const cleaned = rawText.replace(/```json|```/g, '').trim()
    if (cleaned) bodyText = cleaned
  }

  return {
    subject: capitalizeRespectfulPronouns(normalizeOrganizationName(subjectText)),
    greeting,
    body: capitalizeRespectfulPronouns(normalizeOrganizationName(bodyText)),
    personalizationNote: noteText,
    usedModel: model,
  }
}

export function buildDonationThankYouEmailHtml(params: {
  donor: DonorThankYouContext
  subject: string
  bodyText: string
  sender?: SenderIdentityInput | null
  appSettings?: any
  forBrowserPreview?: boolean
}) {
  const { donor, subject, bodyText, sender, forBrowserPreview = false } = params
  const appSettings = params.appSettings ?? DatabaseService.getSettings()
  const cleanBody = deduplicateHrdOrganizationName(String(bodyText || '').trim())
  const cleanSubject = deduplicateHrdOrganizationName(
    String(subject || '').trim() || 'Zahvala na donaciji — HRD „Pavao Ritter Vitezović”'
  )

  // Ako tijelo već počinje pozdravom ("Poštovani..."), ne dupliciramo pozdrav u zaglavlju pisma
  const startsWithGreeting = /^poštovan/i.test(cleanBody)
  const greeting = startsWithGreeting ? '' : buildDonorGreeting(donor)

  const amountFormatted = formatDonationAmountEur(donor.donatedAmount)
  const dateFormatted = donor.donatedAt ? formatDateDMY(donor.donatedAt, donor.donatedAt) : '—'
  const meaningfulNote = extractMeaningfulDonationNote(donor.donationNote)

  const infoBoxHtml = `
    <div><strong>Donator:</strong> ${escapeHtml(donor.name)}${donor.oib ? ` (OIB: ${escapeHtml(donor.oib)})` : ''}</div>
    <div><strong>Iznos donacije:</strong> <span style="font-weight: bold; color: #15803D;">${escapeHtml(amountFormatted)}</span></div>
    <div><strong>Datum uplate:</strong> ${escapeHtml(dateFormatted)}</div>
    ${meaningfulNote ? `<div><strong>Namjena / napomena:</strong> ${escapeHtml(meaningfulNote)}</div>` : ''}
  `

  const built = buildHrdMasterEmail({
    templateType: 'zahvala',
    title: 'Zahvala na podršci i donaciji Društvu',
    greeting,
    bodyTextOrHtml: cleanBody,
    infoBoxTitle: 'Evidencija zaprimljene donacije',
    infoBoxHtml,
    closingText: 'Od srca zahvaljujemo na povjerenju i velikodušnoj podršci,',
    settings: appSettings,
    sender,
    forBrowserPreview,
  })

  return {
    ...built,
    subject: cleanSubject,
  }
}

export async function deliverDonationThankYouEmail(params: {
  to: string
  subject: string
  html: string
  plainText: string
  inlineAttachments?: Array<{
    filename: string
    content: Buffer
    contentType: string
    cid: string
    contentDisposition?: 'inline' | 'attachment'
  }>
  campaignSettings: CampaignSettings
  appSettings?: any
  sender?: SenderIdentityInput | null
  website?: string
  oib?: string
  isTest?: boolean
}): Promise<{
  sent: boolean
  channel: 'campaign_smtp' | 'gmail' | 'system_smtp' | 'none'
  messageId?: string | null
  error?: string
}> {
  const recipient = String(params.to || '').trim()
  if (!recipient || isPlaceholderDonorEmail(recipient)) {
    return {
      sent: false,
      channel: 'none',
      error: 'Primatelj nema valjanu e-mail adresu.',
    }
  }

  const effectiveSubject =
    params.isTest && !params.subject.toUpperCase().startsWith('[TEST]')
      ? `[TEST] ${params.subject}`
      : params.subject

  if (!params.isTest) {
    assertEmailsAllowedToContact(recipient)
    const optCheck = isOptedOut({
      email: recipient,
      website: params.website,
      oib: params.oib,
    })
    if (optCheck.optedOut) {
      return {
        sent: false,
        channel: 'none',
        error: optCheck.reason || `Primatelj (${recipient}) je na listi odjava (Ne kontaktirati).`,
      }
    }
  }

  const campaignSettings = params.campaignSettings ?? getCampaignSettings()
  const appSettings = params.appSettings ?? DatabaseService.getSettings()
  const senderName = (
    campaignSettings.sender_name ||
    campaignSettings.org_name ||
    'Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”'
  ).trim()
  const senderEmail = (
    campaignSettings.sender_email ||
    appSettings?.smtpFrom ||
    'rodoslovlje@rodoslovlje.hr'
  ).trim()

  let lastError = ''

  // 1. Pokušaj putem konfiguriranog SMTP-a kampanje donacija
  if (
    campaignSettings.smtp_host &&
    campaignSettings.smtp_user &&
    campaignSettings.smtp_pass
  ) {
    try {
      const transporter = createSmtpTransporter(campaignSettings)
      const info = await transporter.sendMail({
        from: `"${senderName.replace(/"/g, '')}" <${senderEmail}>`,
        replyTo: senderEmail,
        to: recipient,
        subject: effectiveSubject,
        text: params.plainText,
        html: params.html,
        attachments: params.inlineAttachments || [],
      })
      return {
        sent: true,
        channel: 'campaign_smtp',
        messageId: info?.messageId || null,
      }
    } catch (smtpErr: any) {
      lastError = smtpErr?.message || 'Greška pri slanju putem SMTP-a kampanje.'
    }
  }

  // 2. Fallback: Gmail Workspace API
  try {
    const { gmail, targetEmail } = getGoogleWorkspaceClients({ requireTargetEmail: true })
    const mappedInline = (params.inlineAttachments || []).map((att) => ({
      filename: att.filename,
      mimeType: att.contentType || 'image/png',
      contentBase64: Buffer.isBuffer(att.content)
        ? att.content.toString('base64')
        : String(att.content || ''),
      contentId: att.cid,
    }))

    const rawMime = await buildRawMimeMessage({
      from: targetEmail,
      fromDisplayName: senderName,
      to: recipient,
      subject: effectiveSubject,
      htmlBody: params.html,
      textBody: params.plainText,
      inlineAttachments: mappedInline,
    })

    const sendRes = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawMime },
    })
    const newMsgId = sendRes.data.id || null

    if (!params.isTest && newMsgId) {
      try {
        MailSendersDB.recordSender({
          messageId: newMsgId,
          threadId: sendRes.data.threadId || undefined,
          userId: params.sender?.userId !== undefined ? String(params.sender.userId) : 'admin',
          userName: params.sender?.userName || 'Administrator',
          userRole: params.sender?.userRole || 'admin',
          actionType: 'donation_thank_you',
          recipient,
          subject: effectiveSubject,
        })
      } catch {}
    }

    return { sent: true, channel: 'gmail', messageId: newMsgId }
  } catch (gmailErr: any) {
    if (!lastError) lastError = gmailErr?.message || ''
  }

  // 3. Fallback: Sistemski SMTP iz glavnih postavki CMS-a
  if (appSettings?.smtpHost && appSettings?.smtpFrom) {
    try {
      const info = await sendEmail({
        to: recipient,
        subject: effectiveSubject,
        body: params.plainText,
        html: params.html,
        config: appSettings,
        attachments: params.inlineAttachments,
      })
      return {
        sent: true,
        channel: 'system_smtp',
        messageId: info?.messageId || null,
      }
    } catch (sysErr: any) {
      lastError = sysErr?.message || lastError
    }
  }

  return {
    sent: false,
    channel: 'none',
    error:
      lastError ||
      'Nije konfiguriran nijedan kanal za slanje e-pošte (SMTP kampanje, Gmail ili sistemski SMTP).',
  }
}
