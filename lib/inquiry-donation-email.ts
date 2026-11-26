import 'server-only'
import crypto from 'crypto'
import bwipjs from 'bwip-js'
import { DatabaseService, MailSendersDB } from '@/lib/database'
import { getCampaignSettings } from '@/lib/mailcrawl/db'
import {
  buildHrdMasterEmail,
  escapeHtml,
  formatHrdEmailDate,
} from '@/lib/hrd-email-system'
import { INQUIRY_ARCHIVE_EMAIL } from '@/lib/inquiry-close-email'
import { getGoogleWorkspaceClients } from '@/lib/google-auth'
import { buildRawMimeMessage } from '@/lib/mime-builder'
import { sendEmail } from '@/lib/mail'
import { formatDateTimeDMY } from '@/lib/utils'

export interface DonationPaymentAssets {
  recipientName: string
  recipientStreet: string
  recipientCity: string
  iban: string
  model: string
  reference: string
  purpose: string
  description: string
  amountNote: string
  hub3Payload: string
  hub3Buffer: Buffer
  hub3DataUrl: string
  epcQrPayload: string
  epcQrBuffer: Buffer
  epcQrDataUrl: string
}

export interface DonationEmailTokenPayload {
  fid: number
  iid: number
  exp: number
}

const ACTION_TOKEN_TTL_MS = 30 * 60 * 1000

function getActionTokenSecret(settings?: any): string {
  const s = settings ?? DatabaseService.getSettings()
  const base =
    process.env.SESSION_SECRET ||
    String(s?.adminPassword || '') ||
    'hrd-pavao-ritter-vitezovic-feedback-donation'
  return crypto.createHash('sha256').update(`donation-token:${base}`).digest('hex')
}

export function createDonationEmailActionToken(
  feedbackId: number,
  inquiryId: number,
  settings?: any
): string {
  const payload: DonationEmailTokenPayload = {
    fid: Number(feedbackId),
    iid: Number(inquiryId),
    exp: Date.now() + ACTION_TOKEN_TTL_MS,
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = crypto
    .createHmac('sha256', getActionTokenSecret(settings))
    .update(encoded)
    .digest('base64url')
  return `${encoded}.${sig}`
}

export function verifyDonationEmailActionToken(
  token: string,
  settings?: any
): DonationEmailTokenPayload | null {
  try {
    const clean = String(token || '').trim()
    const parts = clean.split('.')
    if (parts.length !== 2) return null
    const [encoded, sig] = parts
    const expectedSig = crypto
      .createHmac('sha256', getActionTokenSecret(settings))
      .update(encoded)
      .digest('base64url')

    const a = Buffer.from(sig, 'utf8')
    const b = Buffer.from(expectedSig, 'utf8')
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as DonationEmailTokenPayload
    if (!parsed || !Number.isFinite(parsed.fid) || !Number.isFinite(parsed.iid)) return null
    if (!parsed.exp || Date.now() > parsed.exp) return null
    return parsed
  } catch {
    return null
  }
}

export async function buildDonationPaymentAssets(
  requesterName = '',
  appSettingsInput?: any
): Promise<DonationPaymentAssets> {
  const appSettings = appSettingsInput ?? DatabaseService.getSettings()
  let campaignSettings: any = null
  try {
    campaignSettings = getCampaignSettings()
  } catch {
    campaignSettings = null
  }

  const recipientName = 'Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”'
  const recipientShortForHub3 = (
    campaignSettings?.org_name || 'HRD Pavao R. Vitezovic'
  )
    .trim()
    .slice(0, 25)
  const recipientStreet = (
    campaignSettings?.org_street || 'Trg Marka Marulića 21'
  ).trim()
  const recipientCity = (campaignSettings?.org_city || '10000 Zagreb').trim()
  const iban = String(
    appSettings?.iban || campaignSettings?.org_iban || 'HR6523600001102892498'
  )
    .replace(/\s+/g, '')
    .toUpperCase()
    .slice(0, 21)

  const model = String(campaignSettings?.payment_model || 'HR00')
    .replace(/\s+/g, '')
    .toUpperCase()
    .slice(0, 4)

  const currentYear = String(new Date().getFullYear())
  let reference = String(campaignSettings?.payment_reference || currentYear).trim()
  if (reference.includes('{OIB}')) {
    reference = reference.replace(/\{OIB\}/g, currentYear)
  }
  reference = (reference || currentYear).slice(0, 22)

  const purpose = 'CHAR'
  const description = 'Donacija za rad Društva'
  const amountNote = 'Proizvoljan iznos prema Vašoj želji'

  const payerName = String(requesterName || '').trim().slice(0, 30)

  const hub3Payload = [
    'HRVHUB30',
    'EUR',
    '000000000000000',
    payerName,
    '',
    '',
    recipientShortForHub3,
    recipientStreet.slice(0, 25),
    recipientCity.slice(0, 27),
    iban,
    model,
    reference,
    purpose,
    description.slice(0, 35),
  ].join('\n')

  const hub3Buffer = await (bwipjs.toBuffer({
    bcid: 'pdf417',
    text: hub3Payload,
    scale: 2,
    rowmult: 4,
    height: 18,
    columns: 9,
    paddingwidth: 6,
    paddingheight: 6,
    backgroundcolor: 'FFFFFF',
  } as any) as unknown as Promise<Buffer>)

  // Standardni EPC069-12 v002 SEPA QR kod (UTF-8, bez fiksnog iznosa)
  const epcQrPayload = [
    'BCD',
    '002',
    '1',
    'SCT',
    '',
    'Hrvatsko rodoslovno drustvo Pavao Ritter Vitezovic'.slice(0, 70),
    iban,
    '',
    purpose,
    '',
    description.slice(0, 140),
  ].join('\n')

  const epcQrBuffer = await (bwipjs.toBuffer({
    bcid: 'qrcode',
    text: epcQrPayload,
    eclevel: 'M',
    scale: 4,
    paddingwidth: 4,
    paddingheight: 4,
    backgroundcolor: 'FFFFFF',
  } as any) as unknown as Promise<Buffer>)

  return {
    recipientName,
    recipientStreet,
    recipientCity,
    iban,
    model,
    reference,
    purpose,
    description,
    amountNote,
    hub3Payload,
    hub3Buffer,
    hub3DataUrl: `data:image/png;base64,${hub3Buffer.toString('base64')}`,
    epcQrPayload,
    epcQrBuffer,
    epcQrDataUrl: `data:image/png;base64,${epcQrBuffer.toString('base64')}`,
  }
}

export function buildDonationInstructionsEmail(params: {
  inquiry: {
    id: number
    subject: string
    requesterName: string
  }
  assets: DonationPaymentAssets
  settings?: any
  forBrowserPreview?: boolean
}) {
  const { inquiry, assets, settings, forBrowserPreview = false } = params
  const safeSubject = String(inquiry.subject || 'Rodoslovno istraživanje').trim()
  const emailSubject = `Podaci i QR kod za donaciju — HRD „Pavao Ritter Vitezović”`

  const bodyParagraphs = [
    `od srca Vam zahvaljujemo na spremnosti da podržite rad Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović” nakon završenog istraživačkog predmeta #${inquiry.id} („${safeSubject}”).`,
    `U nastavku Vam dostavljamo potpune podatke za uplatu dobrovoljne donacije, kao i 2D HUB-3A barkod (za hrvatsko mobilno bankarstvo) te SEPA QR kod za brzo i jednostavno skeniranje.`,
    `Iznos donacije je u potpunosti proizvoljan, u skladu s Vašim mogućnostima i željom — svaka podrška izravno pomaže digitalizaciji rodoslovne građe, radu naših istraživača i očuvanju hrvatske obiteljske baštine.`,
  ]

  const infoBoxHtml = `
    <div><strong>Primatelj:</strong> ${escapeHtml(assets.recipientName)}</div>
    <div><strong>Adresa:</strong> ${escapeHtml(assets.recipientStreet)}, ${escapeHtml(assets.recipientCity)}</div>
    <div><strong>IBAN:</strong> <span style="font-family: monospace; font-weight: bold; color: #1E3A5F;">${escapeHtml(assets.iban)}</span></div>
    <div><strong>Model i poziv na broj:</strong> ${escapeHtml(assets.model)} ${escapeHtml(assets.reference)}</div>
    <div><strong>Šifra namjene:</strong> ${escapeHtml(assets.purpose)} (dobrotvorno plaćanje)</div>
    <div><strong>Opis plaćanja:</strong> ${escapeHtml(assets.description)}</div>
    <div><strong>Iznos:</strong> ${escapeHtml(assets.amountNote)}</div>
  `

  const hub3Src = forBrowserPreview ? assets.hub3DataUrl : 'cid:donation_hub3_cid'
  const epcQrSrc = forBrowserPreview ? assets.epcQrDataUrl : 'cid:donation_epc_qr_cid'

  const extraContentHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; margin-top: 12px; margin-bottom: 14px;">
      <tr>
        <td align="center" style="padding: 16px;">
          <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; font-weight: bold; color: #7C2D12; margin-bottom: 6px;">
            1. 2D barkod za brzo plaćanje (HUB-3A — hrvatsko m-bankarstvo)
          </div>
          <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1F2937; margin-bottom: 12px;">
            Otvorite aplikaciju svoje banke (m-zaba, PBZ, Erste George, OTP, RBA, HPB), odaberite „Skeniraj i plati”, skenirajte donji barkod i upišite željeni iznos donacije.
          </div>
          <div style="display: inline-block; background-color: #FFFFFF; padding: 10px; border: 1px solid #E2E8F0;">
            <img src="${hub3Src}" alt="2D HUB-3A barkod za donaciju" width="320" style="display: block; max-width: 320px; width: 100%; height: auto;" />
          </div>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; margin-bottom: 8px;">
      <tr>
        <td align="center" style="padding: 16px;">
          <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; font-weight: bold; color: #7C2D12; margin-bottom: 6px;">
            2. SEPA QR kod (za EU i inozemno mobilno bankarstvo)
          </div>
          <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1F2937; margin-bottom: 12px;">
            Za uplate putem europskih i inozemnih bankovnih aplikacija skenirajte ovaj SEPA QR kod.
          </div>
          <div style="display: inline-block; background-color: #FFFFFF; padding: 10px; border: 1px solid #E2E8F0;">
            <img src="${epcQrSrc}" alt="SEPA QR kod za donaciju" width="190" style="display: block; max-width: 190px; width: 100%; height: auto;" />
          </div>
        </td>
      </tr>
    </table>
  `

  const built = buildHrdMasterEmail({
    templateType: 'zahvala',
    title: 'Upute i QR kod za podršku radu Društva',
    greeting: `Poštovani/a ${inquiry.requesterName || 'podupiratelju Društva'},`,
    bodyTextOrHtml: bodyParagraphs.join('\n\n'),
    infoBoxTitle: 'Podaci za uplatu dobrovoljne donacije',
    infoBoxHtml,
    extraContentHtml,
    closingText: 'Od srca zahvaljujemo na povjerenju i podršci,',
    settings,
    sender: null,
    forBrowserPreview,
  })

  const inlineAttachments = [
    ...built.inlineAttachments,
    {
      filename: 'hub3_barkod_donacija.png',
      content: assets.hub3Buffer,
      contentType: 'image/png',
      cid: 'donation_hub3_cid',
      contentDisposition: 'inline' as const,
    },
    {
      filename: 'sepa_qr_donacija.png',
      content: assets.epcQrBuffer,
      contentType: 'image/png',
      cid: 'donation_epc_qr_cid',
      contentDisposition: 'inline' as const,
    },
  ]

  return {
    ...built,
    inlineAttachments,
    subject: emailSubject,
  }
}

export function buildAdminDonationInterestNotificationEmail(params: {
  inquiry: {
    id: number
    subject: string
    requesterName: string
    researcherName?: string | null
  }
  targetEmail: string
  requestedAtIso: string
  settings?: any
  forBrowserPreview?: boolean
}) {
  const { inquiry, targetEmail, requestedAtIso, settings, forBrowserPreview = false } = params
  const safeSubject = String(inquiry.subject || 'Rodoslovno istraživanje').trim()
  const emailSubject = `Obavijest Administratoru: Zatraženi podaci za donaciju — Predmet #${inquiry.id}`

  const bodyText = [
    `Obavještavamo Vas da je u sklopu javne ankete zadovoljstva istraživanjem naručitelj odabrao opciju financijske podrške radu Društva te zatražio slanje podataka i QR koda za uplatu na svoju e-mail adresu.`,
    `Sustav je korisniku automatski poslao kompletan e-mail s podacima za uplatu, 2D HUB-3A barkodom i SEPA QR kodom.`,
  ].join('\n\n')

  const infoBoxHtml = `
    <div><strong>Predmet:</strong> #${inquiry.id} — ${escapeHtml(safeSubject)}</div>
    <div><strong>Naručitelj:</strong> ${escapeHtml(inquiry.requesterName || 'Naručitelj')}</div>
    <div><strong>E-mail na koji su poslane upute:</strong> ${escapeHtml(targetEmail)}</div>
    ${inquiry.researcherName ? `<div><strong>Istraživač:</strong> ${escapeHtml(inquiry.researcherName)}</div>` : ''}
    <div><strong>Vrijeme zahtjeva:</strong> ${escapeHtml(formatDateTimeDMY(requestedAtIso))} (${escapeHtml(formatHrdEmailDate(requestedAtIso))})</div>
  `

  const built = buildHrdMasterEmail({
    templateType: 'sluzbena_obavijest',
    title: 'Zatraženi podaci za donaciju iz ankete',
    greeting: 'Poštovani Administratore,',
    bodyTextOrHtml: bodyText,
    infoBoxTitle: 'Sažetak događaja',
    infoBoxHtml,
    closingText: 'Automatska obavijest sustava „Rodoslovac”,',
    settings,
    sender: null,
    forBrowserPreview,
  })

  return {
    ...built,
    subject: emailSubject,
  }
}

function isValidEmail(val?: string | null): boolean {
  if (!val) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val).trim())
}

export function resolveAdminNotificationEmails(appSettings?: any): string[] {
  const s = appSettings ?? DatabaseService.getSettings()
  const candidates = [
    String(s?.gmailMailbox || '').trim(),
    String(s?.smtpFrom || '').trim(),
    String(s?.adminBackupEmail || '').trim(),
    INQUIRY_ARCHIVE_EMAIL,
  ]
  const seen = new Set<string>()
  const result: string[] = []
  for (const c of candidates) {
    if (!isValidEmail(c)) continue
    const lower = c.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    result.push(c)
  }
  return result.length > 0 ? result : [INQUIRY_ARCHIVE_EMAIL]
}

export async function deliverPublicEmail(params: {
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
  appSettings?: any
  actionType?: string
  threadId?: string | null
}): Promise<{
  sent: boolean
  channel: 'gmail' | 'smtp' | 'none'
  messageId?: string | null
  threadId?: string | null
  error?: string
}> {
  const appSettings = params.appSettings ?? DatabaseService.getSettings()

  try {
    const { gmail, targetEmail } = getGoogleWorkspaceClients({ requireTargetEmail: true })
    let campaignSettings: any = null
    try {
      campaignSettings = getCampaignSettings()
    } catch {
      campaignSettings = null
    }

    let displayName = ''
    try {
      const sendAsRes = await gmail.users.settings.sendAs.list({ userId: 'me' })
      const aliases: any[] = sendAsRes?.data?.sendAs ?? []
      const matched =
        aliases.find((a) => a.sendAsEmail?.toLowerCase() === targetEmail.toLowerCase()) ||
        aliases.find((a) => a.isPrimary) ||
        aliases.find((a) => a.isDefault) ||
        aliases[0]
      if (matched) displayName = matched.displayName || ''
    } catch {}

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
      fromDisplayName:
        campaignSettings?.sender_name ||
        displayName ||
        'Hrvatsko rodoslovno društvo "Pavao Ritter Vitezović"',
      to: params.to,
      subject: params.subject,
      htmlBody: params.html,
      textBody: params.plainText,
      inlineAttachments: mappedInline,
    })

    const sendRes = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMime,
        threadId: params.threadId || undefined,
      },
    })
    const newMsgId = sendRes.data.id || null
    const newThreadId = sendRes.data.threadId || params.threadId || null

    if (newMsgId) {
      try {
        MailSendersDB.recordSender({
          messageId: newMsgId,
          threadId: newThreadId || undefined,
          userId: 'public_feedback',
          userName: 'Sustav ankete zadovoljstva',
          userRole: 'public',
          actionType: params.actionType || 'inquiry_donation_instructions',
          recipient: params.to,
          subject: params.subject,
        })
      } catch {}
    }

    return { sent: true, channel: 'gmail', messageId: newMsgId, threadId: newThreadId }
  } catch (gmailErr: any) {
    if (appSettings?.smtpHost && appSettings?.smtpFrom) {
      try {
        await sendEmail({
          to: params.to,
          subject: params.subject,
          body: params.plainText,
          html: params.html,
          config: appSettings,
          attachments: params.inlineAttachments,
        })
        return { sent: true, channel: 'smtp', messageId: null, threadId: null }
      } catch (smtpErr: any) {
        return {
          sent: false,
          channel: 'smtp',
          error: smtpErr?.message || gmailErr?.message || 'Greška pri SMTP slanju.',
        }
      }
    }
    return {
      sent: false,
      channel: 'none',
      error: gmailErr?.message || 'Ni Gmail ni SMTP nisu konfigurirani.',
    }
  }
}
