import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { ResearchInquiriesDB, InquiryFeedbackDB, ExternalUsersDB, DatabaseService, MailSendersDB, getAppDb } from '@/lib/database'
import {
  buildCombinedContactString,
  buildUniqueAttachmentName,
  formatBytesCompact,
  formatSupplementDividerBlock,
  HARD_GMAIL_TOTAL_ATTACHMENTS_BYTES,
  pickEarliestInquiryDate,
  seedInitialSourceMessage,
  type InquiryAttachment,
  type InquirySourceMessage,
} from '@/lib/inquiry-grouping'
import { TrashService, extractActor, type TrashActor } from '@/lib/trash'
import {
  getInquiryCaseCapabilities,
  getInquiryPermissions,
  getUserAccessRights,
  parseAccessRights,
} from '@/lib/inquiry-permissions'
import { assertEmailsAllowedToContact, DoNotContactBlockedError, getDoNotContactEmailSet } from '@/lib/do-not-contact'
import { sendEmail } from '@/lib/mail'
import { buildInquiryClosedEmail, INQUIRY_ARCHIVE_EMAIL } from '@/lib/inquiry-close-email'
import { sanitizeInquiryFeedbackForClient } from '@/lib/inquiry-feedback'
import { formatHrdEmailDate } from '@/lib/hrd-email-system'
import { getMemberActiveFunctions } from '@/lib/utils'
import { resolveServerSenderIdentity } from '@/lib/sender-role-server'
import {
  getGoogleWorkspaceClients,
  formatGmailError,
} from '@/lib/google-auth'
import {
  processHtmlImagesAndExtractInlineAttachments,
  buildRawMimeMessage,
  getSocietyLogoFromSettings,
  isGmailOrGoogleHostedImageUrl,
  looksLikeBarcodeOrSlipInsteadOfLogo,
  cleanBase64,
  OutgoingAttachment,
} from '@/lib/mime-builder'
import { getCampaignSettings } from '@/lib/mailcrawl/db'
import { buildUnifiedPaymentAndSignatureHtml } from '@/lib/mailcrawl/mailer'
import { generateId } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function escapeHtml(str: string | undefined | null): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function decodeBase64UrlToBuffer(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function decodeBase64Url(s: string): string {
  return decodeBase64UrlToBuffer(s).toString('utf8')
}

function htmlToPlainText(html: string): string {
  if (!html) return ''
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractSenderName(raw: string): string {
  if (!raw) return 'Nepoznati pošiljatelj'
  const match = raw.match(/^"?([^"<]+)"?\s*<.*>$/)
  const name = match ? match[1].trim() : raw.replace(/<.*>/, '').trim()
  return name.replace(/^["']|["']$/g, '').trim() || raw.trim()
}

function extractEmailAddress(raw: string): string {
  if (!raw) return ''
  const match = raw.match(/<([^>]+)>/)
  if (match) return match[1].trim().toLowerCase()
  const emailMatch = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return emailMatch ? emailMatch[0].trim().toLowerCase() : ''
}

function extractPhoneFromText(text: string): string {
  if (!text) return ''
  const m = text.match(/(?:\+385|00385|0)\s*(?:9[125789]|[1-5]\d)\s*[\d\s/-]{5,11}/)
  return m ? m[0].trim() : ''
}

function parseInquiry(row: any) {
  if (!row) return row
  let attachments = []
  if (row.attachments) {
    try {
      attachments = typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments
    } catch {
      attachments = []
    }
  }
  let emailLogs = []
  if (row.email_logs) {
    try {
      emailLogs = typeof row.email_logs === 'string' ? JSON.parse(row.email_logs) : row.email_logs
    } catch {
      emailLogs = []
    }
  }
  let sourceMessages: InquirySourceMessage[] = []
  if (row.source_messages) {
    try {
      sourceMessages = typeof row.source_messages === 'string' ? JSON.parse(row.source_messages) : row.source_messages
    } catch {
      sourceMessages = []
    }
  }

  // Normalize legacy 'pending' status to 'unassigned'
  let normalizedStatus = row.status || 'unassigned'
  if (normalizedStatus === 'pending') {
    normalizedStatus = 'unassigned'
  }

  let requesterEmail = (row.requester_email || '').trim()
  if (!requesterEmail && row.requester_contact) {
    requesterEmail = extractEmailAddress(row.requester_contact)
  }

  return {
    ...row,
    status: normalizedStatus,
    requester_email: requesterEmail,
    attachments: Array.isArray(attachments) ? attachments : [],
    email_logs: Array.isArray(emailLogs) ? emailLogs : [],
    source_messages: Array.isArray(sourceMessages) ? sourceMessages : [],
  }
}

function getUploadDir(): string {
  const uploadDir = process.env.UPLOAD_FOLDER || path.join(process.cwd(), 'data', 'uploads')
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }
  return uploadDir
}

function computeFileSha256FromUrl(urlStr?: string | null): string | null {
  try {
    if (!urlStr) return null
    const filenameOnDisk = decodeURIComponent(String(urlStr).split('/').pop() || '')
    if (!filenameOnDisk) return null
    const filePath = path.join(getUploadDir(), path.basename(filenameOnDisk))
    if (!fs.existsSync(filePath)) return null
    const buf = fs.readFileSync(filePath)
    return crypto.createHash('sha256').update(buf).digest('hex')
  } catch {
    return null
  }
}

function deleteDiskFileIfUnreferenced(urlStr?: string | null, keepUrls?: Set<string>) {
  try {
    if (!urlStr) return
    if (keepUrls && keepUrls.has(urlStr)) return
    const filenameOnDisk = decodeURIComponent(String(urlStr).split('/').pop() || '')
    if (!filenameOnDisk) return
    const filePath = path.join(getUploadDir(), path.basename(filenameOnDisk))
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch {}
}

function mergeAttachmentsWithDeduplication(
  existingAttachments: InquiryAttachment[],
  incomingAttachments: InquiryAttachment[],
  supplementIndex: number,
  deleteDuplicateDiskFiles: boolean
): {
  mergedAttachments: InquiryAttachment[]
  addedAttachments: InquiryAttachment[]
  addedAttachmentsCount: number
  skippedDuplicatesCount: number
} {
  const existingUrls = new Set<string>()
  const existingHashes = new Set<string>()
  const existingNamesLower = new Set<string>()

  const normalizedExisting = (existingAttachments || []).map((att) => {
    const copy = { ...att }
    if (copy.url) existingUrls.add(copy.url)
    if (copy.name) existingNamesLower.add(copy.name.trim().toLowerCase())
    if (!copy.sha256 && copy.url) {
      copy.sha256 = computeFileSha256FromUrl(copy.url)
    }
    if (copy.sha256) existingHashes.add(copy.sha256)
    return copy
  })

  const addedAttachments: InquiryAttachment[] = []
  let skippedDuplicatesCount = 0

  for (const rawInc of incomingAttachments || []) {
    const inc = { ...rawInc }
    if (!inc.sha256 && inc.url) {
      inc.sha256 = computeFileSha256FromUrl(inc.url)
    }

    if (inc.sha256 && existingHashes.has(inc.sha256)) {
      skippedDuplicatesCount++
      if (deleteDuplicateDiskFiles) {
        deleteDiskFileIfUnreferenced(inc.url, existingUrls)
      }
      continue
    }

    const safeName = buildUniqueAttachmentName(inc.name || 'privitak', existingNamesLower, supplementIndex)
    inc.name = safeName
    existingNamesLower.add(safeName.toLowerCase())
    if (inc.sha256) existingHashes.add(inc.sha256)
    if (inc.url) existingUrls.add(inc.url)

    addedAttachments.push(inc)
  }

  return {
    mergedAttachments: [...normalizedExisting, ...addedAttachments],
    addedAttachments,
    addedAttachmentsCount: addedAttachments.length,
    skippedDuplicatesCount,
  }
}

async function fetchAndStoreGmailMessage(
  gmail: any,
  gmailMessageId: string,
  targetEmail: string
): Promise<{
  gmailMessageId: string
  gmailThreadId: string | null
  requesterName: string
  effectiveEmail: string
  subjectHeader: string
  inquiryDate: string
  receivedAtIso: string
  cleanBodyText: string
  phoneFound: string
  savedAttachments: InquiryAttachment[]
}> {
  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: gmailMessageId,
    format: 'full',
  })

  const payload = msg.data.payload
  const headers: any[] = payload?.headers ?? []
  const getHeader = (name: string) =>
    headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''

  const fromHeader = getHeader('From')
  const replyToHeader = getHeader('Reply-To')
  const subjectHeader = getHeader('Subject') || 'Rodoslovni upit'
  const dateHeader = getHeader('Date')

  const fromEmail = extractEmailAddress(fromHeader)
  const replyToEmail = extractEmailAddress(replyToHeader)
  const effectiveEmail =
    replyToEmail && replyToEmail !== targetEmail.toLowerCase() ? replyToEmail : fromEmail

  let requesterName = extractSenderName(
    replyToHeader && extractSenderName(replyToHeader) !== replyToEmail
      ? replyToHeader
      : fromHeader
  )
  if (!requesterName || requesterName === effectiveEmail) {
    requesterName = effectiveEmail.split('@')[0] || 'Podnositelj upita'
  }

  let inquiryDate = new Date().toISOString().slice(0, 10)
  let receivedAtIso = new Date().toISOString()
  if (dateHeader) {
    const parsedDate = new Date(dateHeader)
    if (!isNaN(parsedDate.getTime())) {
      inquiryDate = parsedDate.toISOString().slice(0, 10)
      receivedAtIso = parsedDate.toISOString()
    }
  } else if (msg.data.internalDate) {
    const parsedDate = new Date(Number(msg.data.internalDate))
    if (!isNaN(parsedDate.getTime())) {
      inquiryDate = parsedDate.toISOString().slice(0, 10)
      receivedAtIso = parsedDate.toISOString()
    }
  }

  let plainText = ''
  let htmlText = ''
  const savedAttachments: InquiryAttachment[] = []

  const partsToWalk: any[] = [payload]
  const allParts: any[] = []
  while (partsToWalk.length > 0) {
    const p = partsToWalk.shift()
    if (!p) continue
    allParts.push(p)
    if (Array.isArray(p.parts)) {
      partsToWalk.push(...p.parts)
    }
  }

  const uploadDir = getUploadDir()
  const resolvedMsgId = msg.data.id || gmailMessageId

  for (const part of allParts) {
    const rawMime = (part.mimeType || 'application/octet-stream').toLowerCase()
    const filename = (part.filename || '').trim()
    const hasFilename = Boolean(filename.length > 0)

    if (rawMime === 'text/plain' && part.body?.data && !hasFilename) {
      plainText += decodeBase64Url(part.body.data) + '\n'
    } else if (rawMime === 'text/html' && part.body?.data && !hasFilename) {
      htmlText += decodeBase64Url(part.body.data) + '\n'
    } else if (hasFilename && (part.body?.attachmentId || part.body?.data)) {
      const lowerName = filename.toLowerCase()
      if (lowerName.includes('logo_drustva') || lowerName.includes('campaign-logo')) {
        continue
      }

      try {
        let buffer: Buffer | null = null
        if (part.body?.data) {
          buffer = decodeBase64UrlToBuffer(part.body.data)
        } else if (part.body?.attachmentId) {
          const attRes = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: gmailMessageId,
            id: part.body.attachmentId,
          })
          if (attRes?.data?.data) {
            buffer = decodeBase64UrlToBuffer(attRes.data.data)
          }
        }

        if (buffer && buffer.length > 0) {
          const partHeaders = part.headers || []
          const contentDisposition =
            partHeaders.find((h: any) => h.name?.toLowerCase() === 'content-disposition')?.value || ''
          const isInline = contentDisposition.toLowerCase().includes('inline')
          if (isInline && rawMime.startsWith('image/') && buffer.length < 2048) {
            continue
          }

          const sha256 = crypto.createHash('sha256').update(buffer).digest('hex')
          const ext = path.extname(filename) || (rawMime.startsWith('image/') ? '.png' : '.bin')
          const baseName = path
            .basename(filename, ext)
            .replace(/[^a-zA-Z0-9čćžšđČĆŽŠĐ_-]/g, '_')
            .slice(0, 60)
          const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${baseName}${ext}`
          const filePath = path.join(uploadDir, uniqueName)
          fs.writeFileSync(filePath, buffer)

          let fileType = 'document'
          if (rawMime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(filename)) {
            fileType = 'image'
          } else if (rawMime === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
            fileType = 'pdf'
          } else if (/\.(doc|docx)$/i.test(filename)) {
            fileType = 'word'
          }

          savedAttachments.push({
            id: generateId(),
            name: filename,
            url: `/api/uploads/${uniqueName}`,
            fileType,
            size: buffer.length,
            mimeType: rawMime,
            sha256,
            source_gmail_message_id: resolvedMsgId,
            source_date: inquiryDate,
            source_subject: subjectHeader,
          })
        }
      } catch (attErr) {
        console.warn('[Inquiries] Greška pri spremanju privitka iz Gmaila:', attErr)
      }
    }
  }

  const cleanBodyText =
    plainText.trim() || htmlToPlainText(htmlText) || (msg.data.snippet || '').trim() || '(Bez teksta)'
  const phoneFound = extractPhoneFromText(cleanBodyText)

  return {
    gmailMessageId: resolvedMsgId,
    gmailThreadId: msg.data.threadId || null,
    requesterName,
    effectiveEmail,
    subjectHeader,
    inquiryDate,
    receivedAtIso,
    cleanBodyText,
    phoneFound,
    savedAttachments,
  }
}

export async function buildSupportAndDonationBlockHtml(): Promise<{
  html: string
  barcodeDataUrl: string
  signatureBlockHtml: string
}> {
  const campaignSettings = getCampaignSettings()
  const { paymentBoxHtml, signatureBlockHtml, barcodeDataUrl } =
    await buildUnifiedPaymentAndSignatureHtml(campaignSettings, {}, false)

  const html = `
<div class="hrd-donation-support-block" style="margin-top:20px;padding-top:16px;border-top:1px solid rgb(226,232,240);font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:rgb(30,41,59)">
  Ako želite podržati rad Društva, to možete učiniti:
  <br>
  <br>
  <strong>Učlanjenjem u Društvo:</strong> Pristupom postajete dio naše istraživačke zajednice, uz pristup predavanjima, literaturi i razmjeni iskustava s drugim istraživačima (upute i pristupnicu možete pronaći na našoj web stranici: <a href="https://www.rodoslovlje.hr/o-drustvu/clanstvo/online-pristupnica" target="_blank" style="color:#2563eb;text-decoration:underline">https://www.rodoslovlje.hr/o-drustvu/clanstvo/online-pristupnica</a>).
  <br>
  <br>
  <strong>Dobrovoljnom donacijom:</strong> Svaki prilog pomaže nam u nabavi opreme, održavanju baza podataka i očuvanju arhivske baštine. Podatke za uplatu donacije možete pronaći na:
  ${paymentBoxHtml}
  ${signatureBlockHtml}
</div>`.trim()

  return { html, barcodeDataUrl, signatureBlockHtml }
}

async function fetchGmailSignatureAndAlias(gmail: any, targetEmail: string, settings: any): Promise<{
  signature: string
  displayName: string
}> {
  let signature = ''
  let displayName = ''

  try {
    const sendAsRes = await gmail.users.settings.sendAs.list({ userId: 'me' })
    const aliases: any[] = sendAsRes?.data?.sendAs ?? []
    const matched =
      aliases.find((a) => a.sendAsEmail?.toLowerCase() === targetEmail.toLowerCase()) ||
      aliases.find((a) => a.isPrimary) ||
      aliases.find((a) => a.isDefault) ||
      aliases[0]

    if (matched) {
      signature = matched.signature || ''
      displayName = matched.displayName || ''
    }
  } catch {}

  if (!signature && settings?.paymentEmailSignature) {
    const rawSig = String(settings.paymentEmailSignature).trim()
    if (rawSig) {
      signature = rawSig.includes('<')
        ? rawSig
        : `<div style="font-family:sans-serif;font-size:13px;color:#475569;">${rawSig.replace(/\n/g, '<br/>')}</div>`
    }
  }

  const societyLogo = getSocietyLogoFromSettings()
  if (signature && societyLogo) {
    signature = signature.replace(/<img\b[^>]*>/gi, (imgTag) => {
      const srcMatch = imgTag.match(/\bsrc=(["'])(.*?)\1/i)
      if (!srcMatch) return imgTag
      const src = srcMatch[2].replace(/&amp;/g, '&').trim()
      const isPrivateGmailUrl = /^https?:\/\//i.test(src) && isGmailOrGoogleHostedImageUrl(src)
      const isCid = /^cid:/i.test(src)
      const isDataBarcode =
        /^data:image\//i.test(src) &&
        looksLikeBarcodeOrSlipInsteadOfLogo(cleanBase64(src), imgTag)
      if (isPrivateGmailUrl || isCid || isDataBarcode) {
        return imgTag.replace(
          srcMatch[0],
          `src="${societyLogo.dataUrl}" data-filename="logo_drustva.png" alt="Logo društva"`
        )
      }
      return imgTag
    })
  }

  return { signature, displayName }
}

async function resolveAuthorizedActor(
  request: NextRequest,
  body?: any
): Promise<{ actor: TrashActor; dbUser: any | null }> {
  const actor = extractActor(request, body)
  const roleLower = (actor.role || '').trim().toLowerCase()
  const hasId = Boolean(actor.id && actor.id !== 'unknown')
  const emailLower = (actor.email || '').trim().toLowerCase()

  if (roleLower === 'admin') {
    return {
      actor,
      dbUser: {
        id: Number.isFinite(Number(actor.id)) ? Number(actor.id) : 2579,
        name: actor.name || 'Administrator',
        email: actor.email || 'admin',
        role: 'admin',
        accessRights: null,
      },
    }
  }

  const db = getAppDb()
  const numericId = Number(actor.id)
  let member: any = null

  if (roleLower !== 'external') {
    if (hasId && Number.isFinite(numericId) && numericId > 0) {
      member = db
        .prepare('SELECT id, name, email, role, access_rights FROM members WHERE id = ? LIMIT 1')
        .get(numericId)
    }

    if (!member && emailLower) {
      member = db
        .prepare('SELECT id, name, email, role, access_rights FROM members WHERE lower(trim(email)) = ? LIMIT 1')
        .get(emailLower)
    }
  }

  if (!member) {
    const ext =
      (hasId && Number.isFinite(numericId) && numericId > 0
        ? ExternalUsersDB.getRawById(numericId)
        : null) || (emailLower ? ExternalUsersDB.getRawByEmail(emailLower) : null)

    if (!ext || ext.is_active === 0 || ext.is_active === false) {
      return { actor, dbUser: null }
    }

    const parsedExtRights = parseAccessRights(ext.access_rights)
    return {
      actor: {
        id: String(ext.id),
        name: ext.name || actor.name,
        role: 'external',
        email: ext.email || actor.email || '',
      },
      dbUser: {
        id: Number(ext.id),
        name: ext.name,
        email: ext.email,
        role: 'external',
        isExternal: true,
        organization: ext.organization || '',
        hasAssignedInquiries: true,
        accessRights: parsedExtRights,
        access_rights: parsedExtRights,
      },
    }
  }

  const parsedRights = parseAccessRights(member.access_rights)
  return {
    actor: {
      id: String(member.id),
      name: member.name || actor.name,
      role: member.role || actor.role || 'member',
      email: member.email || actor.email || '',
    },
    dbUser: {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role || 'member',
      accessRights: parsedRights,
      access_rights: parsedRights,
    },
  }
}

export async function GET(request: NextRequest) {
  try {
    const { dbUser } = await resolveAuthorizedActor(request)
    if (!dbUser) {
      return NextResponse.json({ error: 'Potrebna je prijava u sustav.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const id = searchParams.get('id')
    const gmailMessageId = searchParams.get('gmailMessageId')
    const status = searchParams.get('status') || 'all'
    const projectId = searchParams.get('projectId') || searchParams.get('project_id') || undefined

    if (action === 'donation-preview') {
      const { html, barcodeDataUrl } = await buildSupportAndDonationBlockHtml()
      const settings = DatabaseService.getSettings()
      return NextResponse.json({
        donationBlockHtml: html,
        barcodeDataUrl,
        officialMailbox: settings?.gmailMailbox || 'rodoslovlje@rodoslovlje.hr',
      })
    }

    if (action === 'match-candidates') {
      const perms = getInquiryPermissions(dbUser)
      const ar = getUserAccessRights(dbUser)
      const canMatch =
        dbUser.role === 'admin' ||
        dbUser.role === 'moderator' ||
        perms.zaprimljeno.edit ||
        perms.canEditAny ||
        ar.gmail?.edit === true
      if (!canMatch) {
        return NextResponse.json(
          { error: 'Nemate ovlast za prebacivanje e-mail poruka u istraživanja.' },
          { status: 403 }
        )
      }

      const rawEmail = (searchParams.get('email') || '').trim()
      const normalizedEmail = (extractEmailAddress(rawEmail) || rawEmail).trim().toLowerCase()
      const threadId = (searchParams.get('threadId') || '').trim()
      const rawName = (searchParams.get('name') || '').trim().toLowerCase()

      const allParsed = ResearchInquiriesDB.getAll('all').map(parseInquiry)

      const toSummary = (inq: any, matchReason?: string) => {
        const sources =
          Array.isArray(inq.source_messages) && inq.source_messages.length > 0
            ? inq.source_messages
            : [seedInitialSourceMessage(inq)]
        return {
          id: Number(inq.id),
          subject: inq.subject,
          requester_name: inq.requester_name,
          requester_email: inq.requester_email || '',
          inquiry_date: inq.inquiry_date,
          status: inq.status,
          assigned_to_id: inq.assigned_to_id || null,
          assigned_to_name: inq.assigned_to_name || null,
          source_count: sources.length,
          attachments_count: Array.isArray(inq.attachments) ? inq.attachments.length : 0,
          matchReason: matchReason || undefined,
        }
      }

      const doesMatch = (inq: any): string | null => {
        const sources = Array.isArray(inq.source_messages) ? inq.source_messages : []
        if (threadId) {
          if (
            String(inq.gmail_thread_id || '') === threadId ||
            sources.some((s: any) => String(s?.gmail_thread_id || '') === threadId)
          ) {
            return 'Ista e-mail nit (Thread)'
          }
        }
        if (normalizedEmail) {
          const inqEmail = String(inq.requester_email || '').trim().toLowerCase()
          const contactEmail = extractEmailAddress(inq.requester_contact || '')
          if (
            inqEmail === normalizedEmail ||
            contactEmail === normalizedEmail ||
            sources.some((s: any) => String(s?.from_email || '').trim().toLowerCase() === normalizedEmail)
          ) {
            return 'Ista e-mail adresa pošiljatelja'
          }
        }
        if (rawName.length >= 4) {
          const inqName = String(inq.requester_name || '').trim().toLowerCase()
          if (inqName && inqName === rawName) {
            return 'Isto ime i prezime podnositelja'
          }
        }
        return null
      }

      const matchingOpen: any[] = []
      const matchingClosed: any[] = []
      const otherOpen: any[] = []

      for (const inq of allParsed) {
        const isClosed = inq.status === 'completed' || inq.status === 'rejected'
        const reason = doesMatch(inq)
        if (isClosed) {
          if (reason) {
            matchingClosed.push(toSummary(inq, reason))
          }
          continue
        }
        if (reason) {
          matchingOpen.push(toSummary(inq, reason))
        } else if (otherOpen.length < 150) {
          otherOpen.push(toSummary(inq))
        }
      }

      return NextResponse.json({
        matchingOpen,
        matchingClosed,
        otherOpen,
      })
    }

    if (gmailMessageId) {
      const item = ResearchInquiriesDB.getByGmailMessageId(gmailMessageId)
      const parsed = item ? parseInquiry(item) : null
      const ar = getUserAccessRights(dbUser)
      const hasGmailAccess =
        dbUser.role === 'admin' ||
        dbUser.role === 'moderator' ||
        Boolean(ar.gmail?.view || ar.gmail?.edit)
      if (!hasGmailAccess && (!parsed || !getInquiryCaseCapabilities(parsed, dbUser).canView)) {
        return NextResponse.json({ error: 'Nemate ovlast za pregled ovog upita.' }, { status: 403 })
      }
      if (parsed && parsed.id) {
        parsed.feedback = sanitizeInquiryFeedbackForClient(InquiryFeedbackDB.getByInquiryId(Number(parsed.id)))
      }
      return NextResponse.json({
        inquiry: parsed,
      })
    }

    if (id) {
      const item = ResearchInquiriesDB.get(parseInt(id, 10))
      if (!item) {
        return NextResponse.json({ error: 'Upit nije pronađen.' }, { status: 404 })
      }
      const parsed = parseInquiry(item)
      if (!getInquiryCaseCapabilities(parsed, dbUser).canView) {
        return NextResponse.json(
          { error: 'Nemate ovlast za pregled ovog istraživačkog predmeta.' },
          { status: 403 }
        )
      }
      parsed.feedback = sanitizeInquiryFeedbackForClient(InquiryFeedbackDB.getByInquiryId(Number(parsed.id)))
      return NextResponse.json(parsed)
    }

    const items = ResearchInquiriesDB.getAll(status, projectId)
      .map(parseInquiry)
      .filter((item) => getInquiryCaseCapabilities(item, dbUser).canView)
    const feedbackMap = InquiryFeedbackDB.getByInquiryIds(items.map((i) => Number(i.id)))
    for (const item of items) {
      item.feedback = sanitizeInquiryFeedbackForClient(feedbackMap[Number(item.id)]) || null
    }
    return NextResponse.json({ inquiries: items })
  } catch (e: any) {
    console.error('Error in GET /api/projects/inquiries:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { actor, dbUser } = await resolveAuthorizedActor(request, body)
    if (!dbUser) {
      return NextResponse.json({ error: 'Potrebna je prijava u sustav.' }, { status: 401 })
    }

    const { action, id, ...data } = body

    const serialize = (d: any) => {
      const copy = { ...d }
      if (copy.attachments && typeof copy.attachments !== 'string') {
        copy.attachments = JSON.stringify(copy.attachments)
      }
      if (copy.email_logs && typeof copy.email_logs !== 'string') {
        copy.email_logs = JSON.stringify(copy.email_logs)
      }
      if (copy.source_messages && typeof copy.source_messages !== 'string') {
        copy.source_messages = JSON.stringify(copy.source_messages)
      }
      if (copy.requester_email === undefined && copy.requester_contact) {
        const extracted = extractEmailAddress(copy.requester_contact)
        if (extracted) copy.requester_email = extracted
      }
      return copy
    }

    // 1. Create inquiry or attach follow-up email from Gmail ("U istraživanje" / "Pridruži predmetu")
    if (action === 'from-gmail') {
      const perms = getInquiryPermissions(dbUser)
      const ar = getUserAccessRights(dbUser)
      const canCreateFromGmail =
        dbUser.role === 'admin' ||
        dbUser.role === 'moderator' ||
        perms.zaprimljeno.edit ||
        perms.canEditAny ||
        ar.gmail?.edit === true
      if (!canCreateFromGmail) {
        return NextResponse.json(
          { error: 'Nemate ovlast za prebacivanje e-mail poruka u istraživanja.' },
          { status: 403 }
        )
      }
      const {
        gmailMessageId,
        mailbox,
        assigned_to_id,
        assigned_to_name,
        created_by,
        project_id,
        project_name,
        forceNew,
        attachToInquiryId,
      } = data

      if (!gmailMessageId) {
        return NextResponse.json({ error: 'Nedostaje ID e-mail poruke (gmailMessageId).' }, { status: 400 })
      }

      // Check if this Gmail message was already imported into inquiries
      if (!forceNew) {
        const existing = ResearchInquiriesDB.getByGmailMessageId(gmailMessageId)
        if (existing) {
          return NextResponse.json({
            success: true,
            alreadyExisted: true,
            inquiry: parseInquiry(existing),
          })
        }
      }

      const targetIdNum = attachToInquiryId ? Number(attachToInquiryId) : 0
      let targetInquiry: any = null
      if (targetIdNum > 0) {
        const targetRaw = ResearchInquiriesDB.get(targetIdNum)
        if (!targetRaw) {
          return NextResponse.json(
            { error: 'Odabrani istraživački predmet nije pronađen.' },
            { status: 404 }
          )
        }
        targetInquiry = parseInquiry(targetRaw)
        if (targetInquiry.status === 'completed' || targetInquiry.status === 'rejected') {
          return NextResponse.json(
            {
              error:
                'Predmet je trajno zatvoren i zaključan — u zatvoreni predmet nije moguće dodavati dopune. Otvorite novi predmet.',
            },
            { status: 403 }
          )
        }
      }

      const { gmail, targetEmail } = getGoogleWorkspaceClients({
        targetEmailOverride: mailbox,
        requireTargetEmail: true,
      })

      const extracted = await fetchAndStoreGmailMessage(gmail, gmailMessageId, targetEmail)

      if (targetInquiry) {
        const existingSources: InquirySourceMessage[] =
          Array.isArray(targetInquiry.source_messages) && targetInquiry.source_messages.length > 0
            ? [...targetInquiry.source_messages]
            : [seedInitialSourceMessage(targetInquiry)]

        const supplementIndex = existingSources.length + 1
        const newSourceMsgId = generateId()
        const {
          mergedAttachments,
          addedAttachments,
          addedAttachmentsCount,
          skippedDuplicatesCount,
        } = mergeAttachmentsWithDeduplication(
          targetInquiry.attachments || [],
          extracted.savedAttachments,
          supplementIndex,
          true
        )

        const addedAttIdSet = new Set(addedAttachments.map((a) => a.id))
        const taggedMergedAttachments = mergedAttachments.map((att) =>
          addedAttIdSet.has(att.id) ? { ...att, source_message_id: newSourceMsgId } : att
        )

        const newSourceMsg: InquirySourceMessage = {
          id: newSourceMsgId,
          gmail_message_id: extracted.gmailMessageId,
          gmail_thread_id: extracted.gmailThreadId,
          received_at: extracted.receivedAtIso,
          received_date: extracted.inquiryDate,
          from_name: extracted.requesterName,
          from_email: extracted.effectiveEmail,
          subject: extracted.subjectHeader,
          body_text: extracted.cleanBodyText,
          attachments_names: addedAttachments.map((a) => a.name),
          attachment_ids: addedAttachments.map((a) => a.id),
          added_at: new Date().toISOString(),
          added_by: actor.name || created_by || 'Administrator',
          is_initial: false,
        }

        const nextSources = [...existingSources, newSourceMsg].sort((a, b) =>
          String(a.received_at || a.received_date || '').localeCompare(
            String(b.received_at || b.received_date || '')
          )
        )

        const dividerBlock = formatSupplementDividerBlock({
          index: supplementIndex,
          receivedAt: extracted.receivedAtIso,
          fromName: extracted.requesterName,
          fromEmail: extracted.effectiveEmail,
          subject: extracted.subjectHeader,
          bodyText: extracted.cleanBodyText,
        })

        const nextText = [String(targetInquiry.inquiry_text || '').trim(), dividerBlock]
          .filter(Boolean)
          .join('\n')

        const nextInquiryDate = pickEarliestInquiryDate(
          targetInquiry.inquiry_date,
          extracted.inquiryDate
        )
        const nextContact = buildCombinedContactString(
          targetInquiry.requester_contact,
          targetInquiry.requester_email,
          [extracted.effectiveEmail, extracted.phoneFound]
        )

        ResearchInquiriesDB.update(targetIdNum, {
          inquiry_date: nextInquiryDate,
          inquiry_text: nextText,
          requester_contact: nextContact,
          attachments: JSON.stringify(taggedMergedAttachments),
          source_messages: JSON.stringify(nextSources),
          gmail_thread_id: targetInquiry.gmail_thread_id || extracted.gmailThreadId || null,
        })

        const updatedTarget = parseInquiry(ResearchInquiriesDB.get(targetIdNum))

        try {
          DatabaseService.insertLog({
            userId: actor.id || 'admin',
            userName: actor.name || created_by || 'Administrator',
            userRole: actor.role || 'admin',
            action: 'Pridružen dodatni e-mail istraživanju',
            details: `E-mail "${extracted.subjectHeader}" od ${extracted.requesterName} (${extracted.effectiveEmail}) pridružen predmetu #${targetIdNum} ("${targetInquiry.subject}") — dodano privitaka: ${addedAttachmentsCount}${
              skippedDuplicatesCount > 0 ? `, preskočeno duplikata: ${skippedDuplicatesCount}` : ''
            }`,
            timestamp: new Date().toISOString(),
          })
        } catch {}

        return NextResponse.json({
          success: true,
          alreadyExisted: false,
          attached: true,
          attachedMessageId: newSourceMsgId,
          addedAttachmentsCount,
          skippedDuplicatesCount,
          inquiry: updatedTarget,
        })
      }

      const contactCombined = [extracted.effectiveEmail, extracted.phoneFound].filter(Boolean).join(', ')
      const initialSourceId = generateId()
      const taggedInitialAttachments = extracted.savedAttachments.map((att) => ({
        ...att,
        source_message_id: initialSourceId,
      }))
      const initialSourceMsg: InquirySourceMessage = {
        id: initialSourceId,
        gmail_message_id: extracted.gmailMessageId,
        gmail_thread_id: extracted.gmailThreadId,
        received_at: extracted.receivedAtIso,
        received_date: extracted.inquiryDate,
        from_name: extracted.requesterName,
        from_email: extracted.effectiveEmail,
        subject: extracted.subjectHeader,
        body_text: extracted.cleanBodyText,
        attachments_names: taggedInitialAttachments.map((a) => a.name),
        attachment_ids: taggedInitialAttachments.map((a) => a.id),
        added_at: new Date().toISOString(),
        added_by: actor.name || created_by || 'Administrator',
        is_initial: true,
      }

      const hasAssignee = Boolean(assigned_to_id || (assigned_to_name && String(assigned_to_name).trim()))
      const newInquiryData = {
        requester_name: extracted.requesterName,
        requester_email: extracted.effectiveEmail,
        requester_contact: contactCombined || extracted.effectiveEmail,
        inquiry_date: extracted.inquiryDate,
        subject: extracted.subjectHeader,
        inquiry_text: extracted.cleanBodyText,
        assigned_to_id: assigned_to_id ? Number(assigned_to_id) : null,
        assigned_to_name: assigned_to_name || null,
        assigned_date: hasAssignee ? new Date().toISOString().slice(0, 10) : null,
        status: hasAssignee ? 'active' : 'unassigned',
        priority: 'normal',
        project_id: project_id || null,
        project_name: project_name || null,
        attachments: JSON.stringify(taggedInitialAttachments),
        email_logs: JSON.stringify([]),
        source_messages: JSON.stringify([initialSourceMsg]),
        gmail_message_id: extracted.gmailMessageId,
        gmail_thread_id: extracted.gmailThreadId,
        created_by: created_by || 'Administrator',
      }

      const newId = ResearchInquiriesDB.insert(newInquiryData)
      const created = ResearchInquiriesDB.get(newId)

      try {
        DatabaseService.insertLog({
          userId: actor.id || 'admin',
          userName: actor.name || created_by || 'Administrator',
          userRole: actor.role || 'admin',
          action: 'Upit iz e-maila u istraživanje',
          details: `E-mail "${extracted.subjectHeader}" od ${extracted.requesterName} (${extracted.effectiveEmail}) prebačen u Upiti i istraživanja (#${newId})`,
          timestamp: new Date().toISOString(),
        })
      } catch {}

      return NextResponse.json({
        success: true,
        alreadyExisted: false,
        inquiry: parseInquiry(created),
      })
    }

    // 2. Send official email from an inquiry (to Researcher w/ Requester in CC, OR to Requester waiting for free researcher)
    if (action === 'send-email') {
      if (!id) {
        return NextResponse.json({ error: 'Nedostaje ID istraživanja.' }, { status: 400 })
      }
      const existingRaw = ResearchInquiriesDB.get(Number(id))
      if (!existingRaw) {
        return NextResponse.json({ error: 'Istraživanje nije pronađeno.' }, { status: 404 })
      }
      const inquiry = parseInquiry(existingRaw)
      if (inquiry.status === 'completed') {
        return NextResponse.json(
          { error: 'Predmet je trajno zatvoren i zaključan. Slanje novih poruka unutar zatvorenog predmeta nije dopušteno; za dopune je potrebno otvoriti novi upit.' },
          { status: 403 }
        )
      }
      const caps = getInquiryCaseCapabilities(inquiry, dbUser)
      if (!caps.canSendOfficialEmail) {
        return NextResponse.json(
          { error: 'Nemate ovlast za slanje službenih e-mailova iz ovog predmeta.' },
          { status: 403 }
        )
      }

      const {
        emailType, // 'to_researcher' | 'to_researcher_supplement' | 'to_requester_wait' | 'to_requester_check'
        to,
        cc,
        subject,
        messageHtml,
        includeDonationBlock = true,
        includeAttachments = true,
        attachmentIds,
        assigned_to_id,
        assigned_to_name,
        sender,
        isTest = false,
        testEmail,
      } = data

      const effectiveTo = isTest ? String(testEmail || '').trim() : String(to || '').trim()
      if (!effectiveTo) {
        return NextResponse.json(
          {
            error: isTest
              ? 'Unesite e-mail adresu za slanje TEST poruke.'
              : 'Polje primatelja (Za) je obavezno.',
          },
          { status: 400 }
        )
      }

      try {
        assertEmailsAllowedToContact(effectiveTo, !isTest ? cc : undefined)
      } catch (err) {
        if (err instanceof DoNotContactBlockedError) {
          return NextResponse.json({ error: err.message }, { status: 403 })
        }
        throw err
      }

      const { gmail, targetEmail, settings } = getGoogleWorkspaceClients({
        requireTargetEmail: true,
      })

      const campaignSettings = getCampaignSettings()
      const sigInfo = await fetchGmailSignatureAndAlias(gmail, targetEmail, settings)
      const { html: donationBlockHtml, signatureBlockHtml } = await buildSupportAndDonationBlockHtml()

      // Donacijski blok već na dnu sadrži unificirani potpis iz "Donacije & kampanje".
      // Ako bi donacijski blok bio isključen, svejedno dodajemo unificirani potpis.
      const footerBlock = includeDonationBlock ? donationBlockHtml : signatureBlockHtml

      const formattedBodyHtml = `<!DOCTYPE html>
<html lang="hr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 24px 10px; background-color: #F8FAFC; color: #1F2937; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; width: 100%;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-collapse: collapse;">
          <tr>
            <td bgcolor="#1E3A5F" style="background-color: #1E3A5F; padding: 24px 32px; text-align: left;">
              <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 18px; font-weight: bold; color: #FFFFFF; letter-spacing: 0.04em; line-height: 1.3; margin: 0; text-transform: uppercase;">
                HRVATSKO RODOSLOVNO DRUŠTVO
              </div>
              <div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #F8FAFC; font-weight: normal; letter-spacing: 0.02em; margin-top: 4px;">
                Pavao Ritter Vitezović
              </div>
            </td>
          </tr>
          <tr>
            <td height="4" bgcolor="#D97706" style="background-color: #D97706; height: 4px; font-size: 1px; line-height: 4px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding: 28px 32px; background-color: #FFFFFF; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.65; color: #1F2937;">
              <div>${messageHtml || ''}</div>
              ${footerBlock ? `<br/>${footerBlock}` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()

      // Load inquiry attachments from disk if requested (supports selective attachmentIds for supplements)
      const outgoingAttachments: OutgoingAttachment[] = []
      if (includeAttachments && Array.isArray(inquiry.attachments) && inquiry.attachments.length > 0) {
        const filterSet =
          Array.isArray(attachmentIds) && attachmentIds.length > 0
            ? new Set(attachmentIds.map((x: any) => String(x)))
            : Array.isArray(attachmentIds) && attachmentIds.length === 0
            ? new Set<string>()
            : null
        const uploadDir = getUploadDir()
        for (const att of inquiry.attachments) {
          if (filterSet !== null && !filterSet.has(String(att.id || ''))) {
            continue
          }
          try {
            const urlStr = String(att.url || '')
            const filenameOnDisk = decodeURIComponent(urlStr.split('/').pop() || '')
            if (!filenameOnDisk) continue
            const filePath = path.join(uploadDir, path.basename(filenameOnDisk))
            if (fs.existsSync(filePath)) {
              const buf = fs.readFileSync(filePath)
              const ext = path.extname(att.name || filenameOnDisk).toLowerCase()
              let mimeType = att.mimeType || 'application/octet-stream'
              if (ext === '.pdf') mimeType = 'application/pdf'
              else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg'
              else if (ext === '.png') mimeType = 'image/png'
              else if (ext === '.gif') mimeType = 'image/gif'
              else if (ext === '.webp') mimeType = 'image/webp'
              else if (ext === '.doc') mimeType = 'application/msword'
              else if (ext === '.docx') {
                mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              }

              outgoingAttachments.push({
                filename: att.name || filenameOnDisk,
                mimeType,
                contentBase64: buf.toString('base64'),
                size: buf.length,
              })
            }
          } catch (readErr) {
            console.warn('[Inquiries] Nije moguće pročitati privitak za slanje:', readErr)
          }
        }
      }

      const totalAttachmentBytes = outgoingAttachments.reduce((acc, a) => acc + (Number(a.size) || 0), 0)
      if (totalAttachmentBytes > HARD_GMAIL_TOTAL_ATTACHMENTS_BYTES) {
        return NextResponse.json(
          {
            error: `Ukupna veličina odabranih privitaka (${formatBytesCompact(
              totalAttachmentBytes
            )}) prelazi Gmail ograničenje (~25 MB nakon kodiranja). Isključite dio privitaka prije slanja ili koristite vanjsku poveznicu.`,
          },
          { status: 400 }
        )
      }

      const { processedHtml, inlineAttachments, remainingAttachments } =
        await processHtmlImagesAndExtractInlineAttachments(
          formattedBodyHtml,
          outgoingAttachments,
          gmail
        )

      const baseSubject = subject || inquiry.subject || 'Rodoslovni upit'
      const effectiveSubject =
        isTest && !baseSubject.toUpperCase().startsWith('[TEST]')
          ? `[TEST] ${baseSubject}`
          : baseSubject

      const rawMime = await buildRawMimeMessage({
        from: targetEmail,
        fromDisplayName:
          campaignSettings.sender_name ||
          sigInfo.displayName ||
          'Hrvatsko rodoslovno društvo "Pavao Ritter Vitezović"',
        to: effectiveTo,
        // Kod slanja TEST maila nikad ne šaljemo na CC (kako podnositelj upita ne bi dobio testnu poruku)
        cc: !isTest && cc && String(cc).trim() ? String(cc).trim() : undefined,
        subject: effectiveSubject,
        htmlBody: processedHtml,
        attachments: remainingAttachments,
        inlineAttachments,
      })

      const sendRes = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: rawMime,
          threadId: !isTest ? inquiry.gmail_thread_id || undefined : undefined,
        },
      })

      const newMsgId = sendRes.data.id
      const newThreadId = sendRes.data.threadId || inquiry.gmail_thread_id || undefined

      // Ako je TEST mail, ne mijenjamo status upita niti šaljemo pravim primateljima
      if (isTest) {
        return NextResponse.json({
          success: true,
          isTest: true,
          sentTo: effectiveTo,
          inquiry,
        })
      }

      // Add INBOX label so the sent email is also directly visible in the INBOX view as a clear audit trail
      if (newMsgId) {
        try {
          await gmail.users.messages.modify({
            userId: 'me',
            id: newMsgId,
            requestBody: {
              addLabelIds: ['INBOX'],
            },
          })
        } catch (labelErr) {
          console.warn('[Inquiries] Nije moguće dodati INBOX oznaku na poslani mail:', labelErr)
        }
      }

      const senderName = sender?.userName || 'Administrator'
      const senderRole = sender?.userRole || 'admin'
      const senderId = sender?.userId ? String(sender.userId) : 'admin'

      if (newMsgId) {
        MailSendersDB.recordSender({
          messageId: newMsgId,
          threadId: newThreadId,
          userId: senderId,
          userName: senderName,
          userRole: senderRole,
          actionType:
            emailType === 'to_researcher'
              ? 'inquiry_assign'
              : emailType === 'to_researcher_supplement'
              ? 'inquiry_supplement'
              : 'reply',
          recipient: String(to).trim(),
          subject: subject || inquiry.subject,
        })
      }

      const newLogEntry = {
        id: generateId(),
        type: emailType || 'custom',
        sent_at: new Date().toISOString(),
        sent_by_id: senderId,
        sent_by_name: senderName,
        sent_by_role: senderRole,
        to: String(to).trim(),
        cc: cc ? String(cc).trim() : '',
        subject: subject || inquiry.subject,
        html_body: formattedBodyHtml,
        attachments_names: outgoingAttachments.map((a) => a.filename),
        gmail_message_id: newMsgId || null,
        gmail_thread_id: newThreadId || null,
      }

      const updatedLogs = [...(inquiry.email_logs || []), newLogEntry]
      const updatePayload: Record<string, any> = {
        email_logs: JSON.stringify(updatedLogs),
      }

      if (newThreadId && !inquiry.gmail_thread_id) {
        updatePayload.gmail_thread_id = newThreadId
      }

      if (emailType === 'to_researcher') {
        if (assigned_to_id !== undefined) {
          updatePayload.assigned_to_id = assigned_to_id ? Number(assigned_to_id) : inquiry.assigned_to_id
        }
        if (assigned_to_name !== undefined) {
          updatePayload.assigned_to_name = assigned_to_name || inquiry.assigned_to_name
        }
        if (!inquiry.assigned_date) {
          updatePayload.assigned_date = new Date().toISOString().slice(0, 10)
        }
        if (inquiry.status === 'unassigned' || inquiry.status === 'pending') {
          updatePayload.status = 'active'
        }
      }

      ResearchInquiriesDB.update(Number(id), updatePayload)
      const updatedInquiry = parseInquiry(ResearchInquiriesDB.get(Number(id)))

      try {
        DatabaseService.insertLog({
          userId: senderId,
          userName: senderName,
          userRole: senderRole,
          action:
            emailType === 'to_researcher'
              ? 'Proslijeđen upit istraživaču (e-mail)'
              : emailType === 'to_researcher_supplement'
              ? 'Proslijeđena dopuna upita istraživaču (e-mail)'
              : emailType === 'to_requester_check'
              ? 'Poslana provjera statusa podnositelju upita (e-mail)'
              : 'Poslana obavijest podnositelju upita (e-mail)',
          details: `Upit #${id} ("${inquiry.subject}"): poslan e-mail za ${to}${cc ? ` (CC: ${cc})` : ''}`,
          timestamp: new Date().toISOString(),
        })
      } catch {}

      return NextResponse.json({
        success: true,
        inquiry: updatedInquiry,
        emailLog: newLogEntry,
      })
    }

    if (action === 'add') {
      const perms = getInquiryPermissions(dbUser)
      const canAdd =
        dbUser.role === 'admin' ||
        dbUser.role === 'moderator' ||
        perms.zaprimljeno.edit ||
        perms.canEditAny
      if (!canAdd) {
        return NextResponse.json(
          { error: 'Nemate ovlast za dodavanje novih istraživačkih upita.' },
          { status: 403 }
        )
      }
      const payload = serialize(data)
      const hasAssignee = Boolean(
        payload.assigned_to_id || (payload.assigned_to_name && String(payload.assigned_to_name).trim())
      )
      if (!payload.status || payload.status === 'pending') {
        payload.status = hasAssignee ? 'active' : 'unassigned'
      } else if (payload.status === 'unassigned' && hasAssignee) {
        payload.status = 'active'
      }
      if (hasAssignee && !payload.assigned_date) {
        payload.assigned_date = new Date().toISOString().slice(0, 10)
      }
      const newId = ResearchInquiriesDB.insert(payload)
      const created = ResearchInquiriesDB.get(newId)
      return NextResponse.json({ success: true, inquiry: parseInquiry(created) })
    }

    if (action === 'update') {
      if (!id) {
        return NextResponse.json({ error: 'Nedostaje ID upita.' }, { status: 400 })
      }
      const oldInquiry = ResearchInquiriesDB.get(Number(id))
      if (!oldInquiry) {
        return NextResponse.json({ error: 'Upit nije pronađen.' }, { status: 404 })
      }
      const oldParsed = parseInquiry(oldInquiry)
      if (oldParsed.status === 'completed') {
        return NextResponse.json(
          { error: 'Predmet je trajno zatvoren i zaključan. Daljnji rad i izmjene na zatvorenom predmetu više nisu mogući; za dopune je potrebno otvoriti novi upit.' },
          { status: 403 }
        )
      }
      const caps = getInquiryCaseCapabilities(oldParsed, dbUser)
      if (!caps.canEdit) {
        return NextResponse.json(
          { error: 'Nemate ovlast za uređivanje ovog istraživačkog predmeta.' },
          { status: 403 }
        )
      }

      const nextData = { ...data }
      if (!caps.canReassign) {
        delete nextData.assigned_to_id
        delete nextData.assigned_to_name
        delete nextData.assigned_date
        if (nextData.status !== undefined) {
          const requestedStatus = nextData.status === 'pending' ? 'unassigned' : String(nextData.status)
          if (requestedStatus !== oldParsed.status && requestedStatus !== 'completed' && requestedStatus !== 'active') {
            return NextResponse.json(
              { error: 'Kao dodijeljeni istraživač možete uređivati predmet i zatvoriti ga ili ponovno aktivirati.' },
              { status: 403 }
            )
          }
          nextData.status = requestedStatus
        }
      }

      if (nextData.status === 'completed' && !caps.canCloseCase) {
        return NextResponse.json(
          { error: 'Nemate ovlast za zatvaranje ovog predmeta.' },
          { status: 403 }
        )
      }

      TrashService.checkAndTrashInquiryUpdates(Number(id), oldInquiry, nextData, actor)
      const payload = serialize(nextData)
      if (payload.status === 'pending') {
        payload.status = 'unassigned'
      }
      ResearchInquiriesDB.update(Number(id), payload)
      const updated = ResearchInquiriesDB.get(Number(id))
      const updatedParsed = parseInquiry(updated)

      try {
        if (Array.isArray(nextData.email_logs)) {
          const oldResponses = new Map<string, string>(
            (oldParsed?.email_logs || [])
              .filter((l: any) => l?.response_text)
              .map((l: any) => [String(l.id), `${l.response_date || ''}:${l.response_text || ''}`])
          )
          const changedEntry = nextData.email_logs.find(
            (l: any) => l?.response_text && oldResponses.get(String(l.id)) !== `${l.response_date || ''}:${l.response_text || ''}`
          )
          if (changedEntry) {
            DatabaseService.insertLog({
              userId: actor.id || 'admin',
              userName: actor.name || 'Administrator',
              userRole: actor.role || 'admin',
              action: 'Evidentiran odgovor osobe u istraživanju',
              details: `Upit #${id} ("${oldInquiry?.subject || ''}"): evidentiran odgovor od ${changedEntry.response_date || '—'}`,
              timestamp: new Date().toISOString(),
            })
          }
        }

        const oldAttKeys = new Set(
          (oldParsed?.attachments || []).map((a: any) => String(a?.url || a?.id || a?.name || ''))
        )
        const addedAtts = (updatedParsed?.attachments || []).filter(
          (a: any) => !oldAttKeys.has(String(a?.url || a?.id || a?.name || ''))
        )
        if (addedAtts.length > 0) {
          DatabaseService.insertLog({
            userId: actor.id || 'admin',
            userName: actor.name || 'Administrator',
            userRole: actor.role || 'admin',
            action: 'Dodane datoteke u istraživanje',
            details: `Upit #${id} ("${oldParsed?.subject || ''}"): dodane datoteke (${addedAtts
              .map((a: any) => a?.name || 'datoteka')
              .join(', ')}) — ${actor.name}${caps.isAssignedResearcher && !caps.isAdmin ? ' (dodijeljeni istraživač)' : ''}`,
            timestamp: new Date().toISOString(),
          })
        }

        if (payload.status === 'completed' && oldParsed.status !== 'completed') {
          DatabaseService.insertLog({
            userId: actor.id || 'admin',
            userName: actor.name || 'Administrator',
            userRole: actor.role || 'admin',
            action: 'Zatvoren predmet istraživanja',
            details: `Upit #${id} ("${oldParsed?.subject || ''}"): predmet zatvorio/la ${actor.name}${caps.isAssignedResearcher && !caps.isAdmin ? ' (dodijeljeni istraživač)' : ''}`,
            timestamp: new Date().toISOString(),
          })
        } else if (payload.status === 'active' && oldParsed.status === 'completed') {
          DatabaseService.insertLog({
            userId: actor.id || 'admin',
            userName: actor.name || 'Administrator',
            userRole: actor.role || 'admin',
            action: 'Ponovno otvoren predmet istraživanja',
            details: `Upit #${id} ("${oldParsed?.subject || ''}"): predmet ponovno otvorio/la ${actor.name}`,
            timestamp: new Date().toISOString(),
          })
        }
      } catch {}
      return NextResponse.json({ success: true, inquiry: updatedParsed })
    }

    if (action === 'close-case') {
      if (!id) {
        return NextResponse.json({ error: 'Nedostaje ID istraživačkog predmeta.' }, { status: 400 })
      }
      const oldInquiry = ResearchInquiriesDB.get(Number(id))
      if (!oldInquiry) {
        return NextResponse.json({ error: 'Istraživački predmet nije pronađen.' }, { status: 404 })
      }
      const oldParsed = parseInquiry(oldInquiry)
      const caps = getInquiryCaseCapabilities(oldParsed, dbUser)

      const isTest = Boolean(data.isTest)
      const testEmail = String(data.testEmail || '').trim()
      const testTarget: 'all' | 'both' | 'requester' | 'researcher' | 'archive' =
        data.testTarget === 'requester' ||
        data.testTarget === 'researcher' ||
        data.testTarget === 'archive' ||
        data.testTarget === 'both'
          ? data.testTarget
          : 'all'
      const closingNote = String(data.closingNote || '').trim()
      const confirmedPermanentLock = Boolean(data.confirmedPermanentLock)

      if (!isTest) {
        if (oldParsed.status === 'completed') {
          return NextResponse.json(
            { error: 'Predmet je već zatvoren i trajno zaključan.' },
            { status: 400 }
          )
        }
        if (!caps.canCloseCase) {
          return NextResponse.json(
            { error: 'Nemate ovlast za zatvaranje ovog istraživačkog predmeta.' },
            { status: 403 }
          )
        }
        if (!confirmedPermanentLock) {
          return NextResponse.json(
            { error: 'Potrebna je potvrda da nakon zatvaranja više neće biti moguće nastaviti raditi na ovom predmetu.' },
            { status: 400 }
          )
        }
      } else {
        const canRunTest =
          caps.canCloseCase || caps.isAdmin || caps.isModerator || caps.canView
        if (!canRunTest) {
          return NextResponse.json(
            { error: 'Nemate ovlast za testiranje zatvaranja ovog predmeta.' },
            { status: 403 }
          )
        }
        if (!testEmail || !testEmail.includes('@')) {
          return NextResponse.json(
            { error: 'Unesite valjanu testnu e-mail adresu za slanje [TEST] obavijesti.' },
            { status: 400 }
          )
        }
      }

      // Spoji eventualne najnovije izmjene iz obrasca
      const formUpdates = data.formUpdates && typeof data.formUpdates === 'object' ? { ...data.formUpdates } : {}
      delete formUpdates.id
      delete formUpdates.action
      delete formUpdates.actor
      delete formUpdates.email_logs
      if (!caps.canReassign) {
        delete formUpdates.assigned_to_id
        delete formUpdates.assigned_to_name
        delete formUpdates.assigned_date
      }

      const mergedInquiry = {
        ...oldParsed,
        ...formUpdates,
        status: isTest ? oldParsed.status : 'completed',
      }
      if (!mergedInquiry.requester_email && mergedInquiry.requester_contact) {
        mergedInquiry.requester_email = extractEmailAddress(mergedInquiry.requester_contact)
      }

      // Dohvati podatke dodijeljenog istraživača iz baze članova ili vanjskih suradnika
      const db = getAppDb()
      let researcherRow: any = null
      const assignedIdNum = Number(mergedInquiry.assigned_to_id)
      if (Number.isFinite(assignedIdNum) && assignedIdNum > 0) {
        researcherRow =
          db
            .prepare('SELECT id, name, email, do_not_contact FROM members WHERE id = ? LIMIT 1')
            .get(assignedIdNum) || ExternalUsersDB.getRawById(assignedIdNum)
      } else if (mergedInquiry.assigned_to_name && String(mergedInquiry.assigned_to_name).trim()) {
        const cleanAssignedName = String(mergedInquiry.assigned_to_name).trim().toLowerCase()
        researcherRow =
          db
            .prepare('SELECT id, name, email, do_not_contact FROM members WHERE lower(trim(name)) = ? LIMIT 1')
            .get(cleanAssignedName) ||
          db
            .prepare('SELECT id, name, email FROM external_users WHERE lower(trim(name)) = ? LIMIT 1')
            .get(cleanAssignedName)
      }

      const researcherName =
        researcherRow?.name ||
        (mergedInquiry.assigned_to_name ? String(mergedInquiry.assigned_to_name).trim() : '') ||
        ''
      const researcherEmail = researcherRow?.email ? String(researcherRow.email).trim() : ''
      const researcherDoNotContact = Boolean(researcherRow?.do_not_contact === 1)

      const requesterEmail = mergedInquiry.requester_email
        ? String(mergedInquiry.requester_email).trim()
        : extractEmailAddress(mergedInquiry.requester_contact || '')

      const blockedEmails = getDoNotContactEmailSet()
      const requesterBlocked = Boolean(
        requesterEmail && blockedEmails.has(requesterEmail.toLowerCase())
      )
      const researcherBlocked = Boolean(
        researcherDoNotContact ||
          (researcherEmail && blockedEmails.has(researcherEmail.toLowerCase()))
      )

      const appSettings = DatabaseService.getSettings()
      const closedDate = new Date()
      const rawClosedByName = actor.name || dbUser.name || 'Administrator'
      const roleLower = String(actor.role || dbUser.role).toLowerCase()

      const senderIdentity = resolveServerSenderIdentity(
        {
          userId: actor.id || dbUser.id,
          userName: rawClosedByName,
          userEmail: actor.email || dbUser.email,
          userRole: actor.role || dbUser.role,
          userFunction:
            roleLower === 'external'
              ? dbUser.organization
                ? `Vanjski suradnik (${dbUser.organization})`
                : 'Vanjski suradnik'
              : undefined,
        },
        appSettings
      ) || {
        userId: actor.id || dbUser.id,
        userName: rawClosedByName,
        userEmail: actor.email || dbUser.email,
        userRole: actor.role || dbUser.role,
        userFunction: roleLower === 'admin' ? 'Administrator' : 'Član Društva',
      }
      const closedByName = senderIdentity.userName || rawClosedByName

      const emailInput = {
        id: Number(id),
        subject: mergedInquiry.subject || 'Rodoslovni upit',
        requesterName: mergedInquiry.requester_name || 'Podnositelj upita',
        requesterContact: mergedInquiry.requester_contact || null,
        requesterEmail,
        researcherName: researcherName || null,
        researcherEmail: researcherEmail || null,
        inquiryDate: mergedInquiry.inquiry_date || null,
        closedDate,
        closedByName,
        closingNote: closingNote || null,
        actionsTaken: mergedInquiry.actions_taken || null,
        collectedDocuments: mergedInquiry.collected_documents || null,
        researchResult: mergedInquiry.research_result || null,
        attachmentsCount: Array.isArray(mergedInquiry.attachments) ? mergedInquiry.attachments.length : 0,
      }

      const deliverCloseEmail = async (params: {
        to: string
        subject: string
        html: string
        plainText: string
        inlineAttachments?: any[]
        actionType: string
        attachToInquiryThread?: boolean
      }): Promise<{
        sent: boolean
        channel: 'gmail' | 'smtp' | 'none'
        messageId?: string | null
        threadId?: string | null
        error?: string
      }> => {
        const effectiveSubject =
          isTest && !params.subject.toUpperCase().startsWith('[TEST]')
            ? `[TEST] ${params.subject}`
            : params.subject

        // 1. Pokušaj putem Google Workspace Gmail API-ja
        try {
          const { gmail, targetEmail, settings: gwSettings } = getGoogleWorkspaceClients({
            requireTargetEmail: true,
          })
          const campaignSettings = getCampaignSettings()
          const sigInfo = await fetchGmailSignatureAndAlias(gmail, targetEmail, gwSettings)

          const mappedInline = (params.inlineAttachments || []).map((att) => ({
            filename: att.filename,
            mimeType: att.contentType || 'image/png',
            contentBase64: Buffer.isBuffer(att.content)
              ? att.content.toString('base64')
              : String(att.content || ''),
            contentId: att.cid,
          }))

          const { processedHtml, inlineAttachments, remainingAttachments } =
            await processHtmlImagesAndExtractInlineAttachments(params.html, [], gmail)

          const mergedInline = [...mappedInline, ...inlineAttachments]
          const rawMime = await buildRawMimeMessage({
            from: targetEmail,
            fromDisplayName:
              campaignSettings.sender_name ||
              sigInfo.displayName ||
              'Hrvatsko rodoslovno društvo "Pavao Ritter Vitezović"',
            to: params.to,
            subject: effectiveSubject,
            htmlBody: processedHtml,
            attachments: remainingAttachments,
            inlineAttachments: mergedInline,
          })

          const sendRes = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
              raw: rawMime,
              threadId:
                !isTest && params.attachToInquiryThread !== false
                  ? mergedInquiry.gmail_thread_id || undefined
                  : undefined,
            },
          })
          const newMsgId = sendRes.data.id || null
          const newThreadId = sendRes.data.threadId || mergedInquiry.gmail_thread_id || null

          if (!isTest && newMsgId) {
            try {
              await gmail.users.messages.modify({
                userId: 'me',
                id: newMsgId,
                requestBody: { addLabelIds: ['INBOX'] },
              })
            } catch {}
            try {
              MailSendersDB.recordSender({
                messageId: newMsgId,
                threadId: newThreadId || undefined,
                userId: String(senderIdentity.userId || 'admin'),
                userName: closedByName,
                userRole: String(senderIdentity.userRole || 'admin'),
                actionType: params.actionType,
                recipient: params.to,
                subject: effectiveSubject,
              })
            } catch {}
          }

          return { sent: true, channel: 'gmail', messageId: newMsgId, threadId: newThreadId }
        } catch (gmailErr: any) {
          // 2. Automatski fallback na konfigurirani SMTP poslužitelj
          if (appSettings?.smtpHost && appSettings?.smtpFrom) {
            try {
              await sendEmail({
                to: params.to,
                subject: effectiveSubject,
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
            error: formatGmailError(gmailErr) || gmailErr?.message || 'Ni Gmail ni SMTP nisu konfigurirani.',
          }
        }
      }

      if (isTest) {
        const requesterBuilt = buildInquiryClosedEmail({
          role: 'requester',
          inquiry: emailInput,
          settings: appSettings,
          sender: senderIdentity,
        })
        const researcherBuilt = buildInquiryClosedEmail({
          role: 'researcher',
          inquiry: {
            ...emailInput,
            researcherName: researcherName || 'Testni istraživač',
          },
          settings: appSettings,
          sender: senderIdentity,
        })
        const archiveBuilt = buildInquiryClosedEmail({
          role: 'archive',
          inquiry: {
            ...emailInput,
            researcherName: researcherName || 'Testni istraživač',
          },
          settings: appSettings,
          sender: senderIdentity,
        })

        const sentChannels: Array<{ role: 'requester' | 'researcher' | 'archive'; label: string; channel: string; subject: string; error?: string; sent: boolean }> = []

        if (testTarget === 'all' || testTarget === 'both' || testTarget === 'requester') {
          const resReq = await deliverCloseEmail({
            to: testEmail,
            subject: requesterBuilt.subject,
            html: requesterBuilt.html,
            plainText: requesterBuilt.plainText,
            inlineAttachments: requesterBuilt.inlineAttachments,
            actionType: 'inquiry_closed_requester_test',
          })
          sentChannels.push({
            role: 'requester',
            label: 'Obavijest podnositelju upita',
            channel: resReq.channel,
            subject: `[TEST] ${requesterBuilt.subject}`,
            sent: resReq.sent,
            error: resReq.error,
          })
        }

        if (testTarget === 'all' || testTarget === 'both' || testTarget === 'researcher') {
          const resRes = await deliverCloseEmail({
            to: testEmail,
            subject: researcherBuilt.subject,
            html: researcherBuilt.html,
            plainText: researcherBuilt.plainText,
            inlineAttachments: researcherBuilt.inlineAttachments,
            actionType: 'inquiry_closed_researcher_test',
          })
          sentChannels.push({
            role: 'researcher',
            label: 'Obavijest dodijeljenom istraživaču',
            channel: resRes.channel,
            subject: `[TEST] ${researcherBuilt.subject}`,
            sent: resRes.sent,
            error: resRes.error,
          })
        }

        if (testTarget === 'all' || testTarget === 'archive') {
          const resArch = await deliverCloseEmail({
            to: testEmail,
            subject: archiveBuilt.subject,
            html: archiveBuilt.html,
            plainText: archiveBuilt.plainText,
            inlineAttachments: archiveBuilt.inlineAttachments,
            actionType: 'inquiry_closed_archive_test',
            attachToInquiryThread: false,
          })
          sentChannels.push({
            role: 'archive',
            label: `Arhiva Društva (${INQUIRY_ARCHIVE_EMAIL})`,
            channel: resArch.channel,
            subject: `[TEST] ${archiveBuilt.subject}`,
            sent: resArch.sent,
            error: resArch.error,
          })
        }

        const anySent = sentChannels.some((c) => c.sent)
        const allSent = sentChannels.every((c) => c.sent)
        if (!anySent) {
          return NextResponse.json(
            { error: sentChannels[0]?.error || 'Slanje testnih e-mailova nije uspjelo.' },
            { status: 500 }
          )
        }

        const steps = [
          {
            title: '1. Druga potvrda i zaključavanje',
            status: 'ok' as const,
            detail: `Simulirano potvrđivanje trajnog zaključavanja predmeta #${id} (u stvarnom radu nastavak rada na predmetu više neće biti moguć).`,
          },
          {
            title: '2. Podnositelj upita (stvarni primatelj)',
            status: requesterEmail && !requesterBlocked ? ('ok' as const) : ('warn' as const),
            detail: requesterBlocked
              ? `Preskočeno: adresa ${requesterEmail} ima oznaku „Ne kontaktirati”.`
              : requesterEmail
              ? `U stvarnom zatvaranju mail ide na ${requesterEmail} s uputom za slanje novog upita ako je potrebna promjena/dorada.`
              : 'Podnositelj nema upisanu e-mail adresu — u stvarnom zatvaranju ovaj mail bi se preskočio.',
          },
          {
            title: '3. Dodijeljeni istraživač (stvarni primatelj)',
            status: researcherEmail && !researcherBlocked ? ('ok' as const) : ('warn' as const),
            detail: researcherBlocked
              ? `Preskočeno: istraživač (${researcherName || researcherEmail}) ima oznaku „Ne kontaktirati”.`
              : researcherName && researcherEmail
              ? `U stvarnom zatvaranju mail ide istraživaču ${researcherName} (${researcherEmail}).`
              : researcherName
              ? `Istraživač ${researcherName} nema upisanu e-mail adresu u bazi članova.`
              : 'Predmet trenutno nema dodijeljenog istraživača.',
          },
          {
            title: `4. Arhiva Društva (${INQUIRY_ARCHIVE_EMAIL})`,
            status: 'ok' as const,
            detail: `U stvarnom zatvaranju automatski se šalje arhivski sažetak predmeta #${id} na ${INQUIRY_ARCHIVE_EMAIL}.`,
          },
          {
            title: '5. Slanje [TEST] poruka na vašu testnu adresu',
            status: allSent ? ('ok' as const) : ('warn' as const),
            detail: `Poslano ${sentChannels.filter((c) => c.sent).length}/${sentChannels.length} testnih e-mailova na ${testEmail} (${sentChannels.map((c) => `${c.label}: ${c.sent ? c.channel.toUpperCase() : 'GREŠKA'}`).join(', ')}).`,
          },
          {
            title: '6. Zaštita baze podataka',
            status: 'ok' as const,
            detail: `Predmet #${id} ostao je nepromijenjen (status: ${oldParsed.status}), stvarni primatelji nisu kontaktirani.`,
          },
        ]

        return NextResponse.json({
          success: true,
          isTest: true,
          testEmail,
          sentChannels,
          steps,
          recipientsPreview: {
            requester: {
              name: emailInput.requesterName,
              email: requesterEmail || null,
              blocked: requesterBlocked,
            },
            researcher: {
              name: researcherName || null,
              email: researcherEmail || null,
              blocked: researcherBlocked,
            },
          },
        })
      }

      // Stvarno zatvaranje i trajno zaključavanje predmeta
      const updateFields = serialize({
        ...formUpdates,
        status: 'completed',
      })
      TrashService.checkAndTrashInquiryUpdates(Number(id), oldInquiry, { ...formUpdates, status: 'completed' }, actor)
      ResearchInquiriesDB.update(Number(id), updateFields)

      const newEmailLogs: any[] = [...(oldParsed.email_logs || [])]
      const nowIso = closedDate.toISOString()

      const emailDispatch: {
        requester: { status: 'sent' | 'skipped_no_email' | 'skipped_do_not_contact' | 'error'; to?: string | null; channel?: string; error?: string }
        researcher: { status: 'sent' | 'skipped_no_assignee' | 'skipped_no_email' | 'skipped_do_not_contact' | 'error'; name?: string | null; to?: string | null; channel?: string; error?: string }
        archive: { status: 'sent' | 'error'; to: string; channel?: string; error?: string }
      } = {
        requester: { status: 'skipped_no_email', to: null },
        researcher: { status: researcherName ? 'skipped_no_email' : 'skipped_no_assignee', name: researcherName || null, to: null },
        archive: { status: 'error', to: INQUIRY_ARCHIVE_EMAIL },
      }

      // 1) Automatski e-mail podnositelju
      if (!requesterEmail) {
        emailDispatch.requester = { status: 'skipped_no_email', to: null }
      } else if (requesterBlocked) {
        emailDispatch.requester = { status: 'skipped_do_not_contact', to: requesterEmail }
      } else {
        const reqEmailBuilt = buildInquiryClosedEmail({
          role: 'requester',
          inquiry: emailInput,
          settings: appSettings,
          sender: senderIdentity,
        })
        const resReq = await deliverCloseEmail({
          to: requesterEmail,
          subject: reqEmailBuilt.subject,
          html: reqEmailBuilt.html,
          plainText: reqEmailBuilt.plainText,
          inlineAttachments: reqEmailBuilt.inlineAttachments,
          actionType: 'inquiry_closed_requester',
        })
        if (resReq.sent) {
          emailDispatch.requester = { status: 'sent', to: requesterEmail, channel: resReq.channel }
          newEmailLogs.push({
            id: generateId(),
            type: 'case_closed_requester',
            sent_at: nowIso,
            sent_by_id: String(senderIdentity.userId || 'admin'),
            sent_by_name: closedByName,
            sent_by_role: String(senderIdentity.userRole || 'admin'),
            to: requesterEmail,
            cc: '',
            subject: reqEmailBuilt.subject,
            html_body: reqEmailBuilt.html,
            gmail_message_id: resReq.messageId || null,
            gmail_thread_id: resReq.threadId || mergedInquiry.gmail_thread_id || null,
          })
        } else {
          emailDispatch.requester = { status: 'error', to: requesterEmail, channel: resReq.channel, error: resReq.error }
        }
      }

      // 2) Automatski e-mail dodijeljenom istraživaču
      if (!researcherName) {
        emailDispatch.researcher = { status: 'skipped_no_assignee', name: null, to: null }
      } else if (!researcherEmail) {
        emailDispatch.researcher = { status: 'skipped_no_email', name: researcherName, to: null }
      } else if (researcherBlocked) {
        emailDispatch.researcher = { status: 'skipped_do_not_contact', name: researcherName, to: researcherEmail }
      } else {
        const resEmailBuilt = buildInquiryClosedEmail({
          role: 'researcher',
          inquiry: emailInput,
          settings: appSettings,
          sender: senderIdentity,
        })
        const resRes = await deliverCloseEmail({
          to: researcherEmail,
          subject: resEmailBuilt.subject,
          html: resEmailBuilt.html,
          plainText: resEmailBuilt.plainText,
          inlineAttachments: resEmailBuilt.inlineAttachments,
          actionType: 'inquiry_closed_researcher',
        })
        if (resRes.sent) {
          emailDispatch.researcher = { status: 'sent', name: researcherName, to: researcherEmail, channel: resRes.channel }
          newEmailLogs.push({
            id: generateId(),
            type: 'case_closed_researcher',
            sent_at: nowIso,
            sent_by_id: String(senderIdentity.userId || 'admin'),
            sent_by_name: closedByName,
            sent_by_role: String(senderIdentity.userRole || 'admin'),
            to: researcherEmail,
            cc: '',
            subject: resEmailBuilt.subject,
            html_body: resEmailBuilt.html,
            gmail_message_id: resRes.messageId || null,
            gmail_thread_id: resRes.threadId || mergedInquiry.gmail_thread_id || null,
          })
        } else {
          emailDispatch.researcher = { status: 'error', name: researcherName, to: researcherEmail, channel: resRes.channel, error: resRes.error }
        }
      }

      // 3) Automatski arhivski e-mail za arhivu Društva (rodoslovlje@rodoslovlje.hr)
      {
        const archEmailBuilt = buildInquiryClosedEmail({
          role: 'archive',
          inquiry: emailInput,
          settings: appSettings,
          sender: senderIdentity,
        })
        const resArch = await deliverCloseEmail({
          to: INQUIRY_ARCHIVE_EMAIL,
          subject: archEmailBuilt.subject,
          html: archEmailBuilt.html,
          plainText: archEmailBuilt.plainText,
          inlineAttachments: archEmailBuilt.inlineAttachments,
          actionType: 'inquiry_closed_archive',
          attachToInquiryThread: false,
        })
        if (resArch.sent) {
          emailDispatch.archive = { status: 'sent', to: INQUIRY_ARCHIVE_EMAIL, channel: resArch.channel }
          newEmailLogs.push({
            id: generateId(),
            type: 'case_closed_archive',
            sent_at: nowIso,
            sent_by_id: String(senderIdentity.userId || 'admin'),
            sent_by_name: closedByName,
            sent_by_role: String(senderIdentity.userRole || 'admin'),
            to: INQUIRY_ARCHIVE_EMAIL,
            cc: '',
            subject: archEmailBuilt.subject,
            html_body: archEmailBuilt.html,
            gmail_message_id: resArch.messageId || null,
            gmail_thread_id: resArch.threadId || null,
          })
        } else {
          emailDispatch.archive = { status: 'error', to: INQUIRY_ARCHIVE_EMAIL, channel: resArch.channel, error: resArch.error }
        }
      }

      ResearchInquiriesDB.update(Number(id), {
        email_logs: JSON.stringify(newEmailLogs),
      })
      const finalInquiry = parseInquiry(ResearchInquiriesDB.get(Number(id)))

      try {
        const notifiedParts: string[] = []
        if (emailDispatch.requester.status === 'sent') notifiedParts.push(`podnositelj (${emailDispatch.requester.to})`)
        if (emailDispatch.researcher.status === 'sent') notifiedParts.push(`istraživač (${emailDispatch.researcher.to})`)
        if (emailDispatch.archive.status === 'sent') notifiedParts.push(`arhiva Društva (${emailDispatch.archive.to})`)
        const notifySummary = notifiedParts.length > 0
          ? ` Automatska obavijest poslana: ${notifiedParts.join(', ')}.`
          : ' Bez poslanih automatskih e-mailova.'

        DatabaseService.insertLog({
          userId: actor.id || 'admin',
          userName: closedByName,
          userRole: actor.role || 'admin',
          action: 'Zatvoren predmet istraživanja',
          details: `Upit #${id} ("${finalInquiry?.subject || ''}"): predmet trajno zatvorio/la ${closedByName}${caps.isAssignedResearcher && !caps.isAdmin ? ' (dodijeljeni istraživač)' : ''}.${notifySummary} Zatvoreno: ${formatHrdEmailDate(closedDate)}.`,
          timestamp: nowIso,
        })
      } catch {}

      return NextResponse.json({
        success: true,
        inquiry: finalInquiry,
        emailDispatch,
      })
    }

    if (action === 'merge') {
      if (String(dbUser.role || '').toLowerCase() !== 'admin') {
        return NextResponse.json(
          { error: 'Spajanje postojećih istraživačkih predmeta trenutno je dopušteno isključivo administratoru.' },
          { status: 403 }
        )
      }

      const targetId = Number(data.targetId || id)
      const rawSourceIds: any[] = Array.isArray(data.sourceIds) ? data.sourceIds : []
      const sourceIds = Array.from(
        new Set(
          rawSourceIds
            .map((x) => Number(x))
            .filter((n) => Number.isInteger(n) && n > 0 && n !== targetId)
        )
      )

      if (!Number.isInteger(targetId) || targetId <= 0 || sourceIds.length === 0) {
        return NextResponse.json(
          { error: 'Odaberite glavni predmet i barem jedan otvoreni predmet za spajanje.' },
          { status: 400 }
        )
      }

      const targetRaw = ResearchInquiriesDB.get(targetId)
      if (!targetRaw) {
        return NextResponse.json(
          { error: 'Glavni istraživački predmet nije pronađen.' },
          { status: 404 }
        )
      }
      const target = parseInquiry(targetRaw)
      if (target.status === 'completed' || target.status === 'rejected') {
        return NextResponse.json(
          { error: 'Glavni predmet je zatvoren/zaključan i nije ga moguće spajati.' },
          { status: 403 }
        )
      }

      const sources: any[] = []
      for (const sId of sourceIds) {
        const sRaw = ResearchInquiriesDB.get(sId)
        if (!sRaw) {
          return NextResponse.json(
            { error: `Predmet #${sId} nije pronađen.` },
            { status: 404 }
          )
        }
        const sParsed = parseInquiry(sRaw)
        if (sParsed.status === 'completed' || sParsed.status === 'rejected') {
          return NextResponse.json(
            { error: `Predmet #${sId} je zatvoren/zaključan i ne može se spojiti.` },
            { status: 403 }
          )
        }
        const existingFeedback = InquiryFeedbackDB.getByInquiryId(sId)
        if (existingFeedback) {
          return NextResponse.json(
            { error: `Predmet #${sId} već ima zapis ankete zadovoljstva i ne može se spojiti.` },
            { status: 400 }
          )
        }
        sources.push(sParsed)
      }

      // Sort sources chronologically by FIFO order
      sources.sort((a, b) => {
        const dA = String(a.inquiry_date || '9999-12-31')
        const dB = String(b.inquiry_date || '9999-12-31')
        if (dA !== dB) return dA.localeCompare(dB)
        return Number(a.id) - Number(b.id)
      })

      let mergedSources: InquirySourceMessage[] =
        Array.isArray(target.source_messages) && target.source_messages.length > 0
          ? [...target.source_messages]
          : [seedInitialSourceMessage(target)]

      let mergedAttachments: InquiryAttachment[] = [...(target.attachments || [])]
      let totalAddedAttachments = 0
      let totalSkippedDuplicates = 0
      let mergedText = String(target.inquiry_text || '').trim()
      let mergedContact = buildCombinedContactString(target.requester_contact, target.requester_email)
      let mergedEmailLogs = [...(target.email_logs || [])]
      const seenLogIds = new Set(mergedEmailLogs.map((l: any) => String(l?.id || '')))
      const seenGmailIds = new Set(
        mergedSources.map((m) => String(m?.gmail_message_id || '').trim()).filter(Boolean)
      )

      let mergedResearcherResponse = String(target.researcher_response || '').trim()
      let mergedActionsTaken = String(target.actions_taken || '').trim()
      let mergedCollectedDocs = String(target.collected_documents || '').trim()
      let mergedResearchResult = String(target.research_result || '').trim()
      let mergedNotes = String(target.notes || '').trim()
      let mergedExternalLink = String(target.external_link || '').trim()

      let assignedToId = target.assigned_to_id || null
      let assignedToName = target.assigned_to_name || null
      let assignedDate = target.assigned_date || null
      let nextStatus = target.status === 'pending' ? 'unassigned' : target.status
      let nextThreadId = target.gmail_thread_id || null

      const appendWorkField = (currentVal: string, incomingVal: string | null | undefined, srcId: number) => {
        const inc = String(incomingVal || '').trim()
        if (!inc) return currentVal
        if (!currentVal) return inc
        if (currentVal.includes(inc)) return currentVal
        return `${currentVal}\n\n[Iz spojenog predmeta #${srcId}]:\n${inc}`
      }

      for (const src of sources) {
        const srcEmail = src.requester_email || extractEmailAddress(src.requester_contact || '')
        mergedContact = buildCombinedContactString(mergedContact, target.requester_email, [
          srcEmail,
          src.requester_contact,
        ])

        if (!nextThreadId && src.gmail_thread_id) {
          nextThreadId = src.gmail_thread_id
        }

        if (!assignedToId && !assignedToName && (src.assigned_to_id || src.assigned_to_name)) {
          assignedToId = src.assigned_to_id || null
          assignedToName = src.assigned_to_name || null
          assignedDate = src.assigned_date || new Date().toISOString().slice(0, 10)
          if (nextStatus === 'unassigned') {
            nextStatus = 'active'
          }
        }

        const srcMessageList: InquirySourceMessage[] =
          Array.isArray(src.source_messages) && src.source_messages.length > 0
            ? src.source_messages
            : [seedInitialSourceMessage(src)]

        const supplementIdx = mergedSources.length + 1
        // Do NOT delete files on disk during merge because target references them (Trash only snapshots DB row)
        const attMerge = mergeAttachmentsWithDeduplication(
          mergedAttachments,
          src.attachments || [],
          supplementIdx,
          false
        )
        mergedAttachments = attMerge.mergedAttachments
        totalAddedAttachments += attMerge.addedAttachmentsCount
        totalSkippedDuplicates += attMerge.skippedDuplicatesCount

        for (const m of srcMessageList) {
          const gId = String(m?.gmail_message_id || '').trim()
          if (gId && seenGmailIds.has(gId)) continue
          if (gId) seenGmailIds.add(gId)
          mergedSources.push({
            ...m,
            is_initial: false,
            merged_from_inquiry_id: m.merged_from_inquiry_id || Number(src.id),
          })
        }

        const srcBody = String(src.inquiry_text || '').trim()
        if (srcBody && !mergedText.includes(srcBody)) {
          const divider = formatSupplementDividerBlock({
            index: supplementIdx,
            receivedAt: src.created_at || `${src.inquiry_date || ''}T10:00:00`,
            fromName: src.requester_name || target.requester_name,
            fromEmail: srcEmail,
            subject: src.subject || `Predmet #${src.id}`,
            bodyText: srcBody,
            mergedFromInquiryId: Number(src.id),
          })
          mergedText = [mergedText, divider].filter(Boolean).join('\n')
        }

        for (const log of src.email_logs || []) {
          const logId = String(log?.id || '')
          if (logId && seenLogIds.has(logId)) continue
          if (logId) seenLogIds.add(logId)
          mergedEmailLogs.push(log)
        }

        mergedResearcherResponse = appendWorkField(mergedResearcherResponse, src.researcher_response, src.id)
        mergedActionsTaken = appendWorkField(mergedActionsTaken, src.actions_taken, src.id)
        mergedCollectedDocs = appendWorkField(mergedCollectedDocs, src.collected_documents, src.id)
        mergedResearchResult = appendWorkField(mergedResearchResult, src.research_result, src.id)
        mergedNotes = appendWorkField(mergedNotes, src.notes, src.id)
        if (!mergedExternalLink && src.external_link) {
          mergedExternalLink = String(src.external_link).trim()
        } else if (
          mergedExternalLink &&
          src.external_link &&
          !mergedExternalLink.includes(String(src.external_link).trim())
        ) {
          mergedNotes = appendWorkField(mergedNotes, `Vanjska poveznica: ${src.external_link}`, src.id)
        }
      }

      mergedSources.sort((a, b) =>
        String(a.received_at || a.received_date || '').localeCompare(
          String(b.received_at || b.received_date || '')
        )
      )
      mergedEmailLogs.sort((a: any, b: any) =>
        String(a?.sent_at || '').localeCompare(String(b?.sent_at || ''))
      )

      const earliestDate = pickEarliestInquiryDate(
        target.inquiry_date,
        ...sources.map((s) => s.inquiry_date)
      )

      ResearchInquiriesDB.update(targetId, {
        inquiry_date: earliestDate,
        inquiry_text: mergedText,
        requester_contact: mergedContact,
        assigned_to_id: assignedToId,
        assigned_to_name: assignedToName,
        assigned_date: assignedDate,
        status: nextStatus,
        researcher_response: mergedResearcherResponse || null,
        actions_taken: mergedActionsTaken || null,
        collected_documents: mergedCollectedDocs || null,
        research_result: mergedResearchResult || null,
        notes: mergedNotes || null,
        external_link: mergedExternalLink || null,
        attachments: JSON.stringify(mergedAttachments),
        email_logs: JSON.stringify(mergedEmailLogs),
        source_messages: JSON.stringify(mergedSources),
        gmail_thread_id: nextThreadId,
      })

      for (const src of sources) {
        TrashService.trashResearchInquiry(Number(src.id), actor)
      }

      const updatedTarget = parseInquiry(ResearchInquiriesDB.get(targetId))

      try {
        DatabaseService.insertLog({
          userId: actor.id || 'admin',
          userName: actor.name || 'Administrator',
          userRole: actor.role || 'admin',
          action: 'Spojeni istraživački predmeti',
          details: `Administrator ${actor.name || 'Administrator'} spojio je predmete [${sources
            .map((s) => `#${s.id}`)
            .join(', ')}] u glavni predmet #${targetId} ("${target.subject}"). Sačuvan FIFO datum: ${formatHrdEmailDate(
            earliestDate
          )}. Dodano privitaka: ${totalAddedAttachments}${
            totalSkippedDuplicates > 0 ? `, preskočeno duplikata: ${totalSkippedDuplicates}` : ''
          }.`,
          timestamp: new Date().toISOString(),
        })
      } catch {}

      return NextResponse.json({
        success: true,
        inquiry: updatedTarget,
        mergedSourceIds: sources.map((s) => Number(s.id)),
        addedAttachmentsCount: totalAddedAttachments,
        skippedDuplicatesCount: totalSkippedDuplicates,
      })
    }

    if (action === 'delete') {
      if (!id) {
        return NextResponse.json({ error: 'Nedostaje ID upita.' }, { status: 400 })
      }
      const oldInquiry = ResearchInquiriesDB.get(Number(id))
      if (!oldInquiry) {
        return NextResponse.json({ error: 'Upit nije pronađen.' }, { status: 404 })
      }
      const caps = getInquiryCaseCapabilities(parseInquiry(oldInquiry), dbUser)
      if (!caps.canDeleteCase) {
        return NextResponse.json(
          { error: 'Nemate ovlast za brisanje ovog istraživačkog predmeta.' },
          { status: 403 }
        )
      }
      TrashService.trashResearchInquiry(Number(id), actor)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Nepoznata akcija.' }, { status: 400 })
  } catch (e: any) {
    console.error('Error in POST /api/projects/inquiries:', e)
    return NextResponse.json({ error: formatGmailError(e) || e.message }, { status: 500 })
  }
}
