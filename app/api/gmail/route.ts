import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'
import {
  getGoogleWorkspaceClients,
  validateServiceAccountJson,
  formatGmailError,
  ServiceAccountCredentials,
} from '@/lib/google-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export type { ServiceAccountCredentials }
export { validateServiceAccountJson }

function getGmailClientFromConfig(rawJson?: string | null, overrideMailbox?: string | null) {
  return getGoogleWorkspaceClients({
    rawJsonOverride: rawJson,
    targetEmailOverride: overrideMailbox,
    requireTargetEmail: true,
  })
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
  } catch {
    // Fallback if sendAs is unavailable
  }

  // Fallback to signature from application settings if Gmail signature is empty
  if (!signature && settings?.paymentEmailSignature) {
    const rawSig = String(settings.paymentEmailSignature).trim()
    if (rawSig) {
      signature = rawSig.includes('<')
        ? rawSig
        : `<div style="font-family:sans-serif;font-size:13px;color:#475569;">${rawSig.replace(/\n/g, '<br/>')}</div>`
    }
  }

  return { signature, displayName }
}

function decodeBase64UrlToBuffer(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function decodeBase64Url(s: string): string {
  return decodeBase64UrlToBuffer(s).toString('utf8')
}

function encodeMimeHeader(text: string): string {
  if (!text) return ''
  if (/[^\x20-\x7E]/.test(text)) {
    return `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`
  }
  return text
}

function parseMessageHeaders(headers: any[]) {
  const get = (name: string) =>
    headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''
  return {
    from: get('From'),
    to: get('To'),
    cc: get('Cc'),
    bcc: get('Bcc'),
    replyTo: get('Reply-To'),
    subject: get('Subject'),
    date: get('Date'),
    messageId: get('Message-ID') || get('Message-Id'),
    references: get('References'),
    inReplyTo: get('In-Reply-To'),
    contentType: get('Content-Type'),
  }
}

export interface ParsedAttachment {
  attachmentId: string
  filename: string
  mimeType: string
  size: number
  contentId?: string
  isInline?: boolean
  inlineDataUrl?: string
}

async function extractBodyAndAttachments(
  payload: any,
  messageId: string,
  mailbox: string,
  gmail?: any
): Promise<{
  body: { text: string; html: string }
  attachments: ParsedAttachment[]
}> {
  if (!payload) return { body: { text: '', html: '' }, attachments: [] }

  let text = ''
  let html = ''
  const attachments: ParsedAttachment[] = []
  const cidMap = new Map<string, string>()

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

  for (const part of allParts) {
    const partHeaders = part.headers || []
    const contentDisposition =
      partHeaders.find((h: any) => h.name?.toLowerCase() === 'content-disposition')?.value || ''
    const contentIdRaw =
      partHeaders.find((h: any) => h.name?.toLowerCase() === 'content-id')?.value ||
      partHeaders.find((h: any) => h.name?.toLowerCase() === 'x-attachment-id')?.value ||
      ''
    const contentId = contentIdRaw.replace(/^<|>$/g, '').trim()

    const mimeType = part.mimeType || 'application/octet-stream'
    const hasFilename = Boolean(part.filename && part.filename.trim().length > 0)
    const isImage = mimeType.toLowerCase().startsWith('image/')
    const isInline =
      contentDisposition.toLowerCase().includes('inline') || Boolean(contentId)

    if (mimeType === 'text/plain' && part.body?.data && !hasFilename) {
      text += decodeBase64Url(part.body.data)
    } else if (mimeType === 'text/html' && part.body?.data && !hasFilename) {
      html += decodeBase64Url(part.body.data)
    } else if (part.body?.attachmentId) {
      const inlineUrl = `/api/gmail?action=attachment&mailbox=${encodeURIComponent(
        mailbox
      )}&messageId=${encodeURIComponent(messageId)}&attachmentId=${encodeURIComponent(
        part.body.attachmentId
      )}&filename=${encodeURIComponent(part.filename || 'slika')}&mimeType=${encodeURIComponent(
        mimeType
      )}&inline=1`

      let dataUrl: string | undefined

      // If it's an image and we have the gmail client,
      // fetch attachment bytes directly so the HTML contains a real self-contained data URL.
      if (gmail && isImage) {
        try {
          const attRes = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId,
            id: part.body.attachmentId,
          })
          if (attRes?.data?.data) {
            const b64 = attRes.data.data.replace(/-/g, '+').replace(/_/g, '/')
            dataUrl = `data:${mimeType};base64,${b64}`
          }
        } catch {
          // Fallback to inlineUrl
        }
      }

      const effectiveUrl = dataUrl || inlineUrl

      if (contentId) {
        cidMap.set(contentId, effectiveUrl)
        // Also store without domain part if Content-ID is like image001.png@01DA...
        const shortCid = contentId.split('@')[0]
        if (shortCid) cidMap.set(shortCid, effectiveUrl)
      }
      if (part.filename) {
        cidMap.set(part.filename, effectiveUrl)
        cidMap.set(part.filename.toLowerCase(), effectiveUrl)
        cidMap.set(encodeURIComponent(part.filename), effectiveUrl)
      }

      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename || (isImage ? 'slika.png' : 'privitak'),
        mimeType,
        size: part.body.size || 0,
        contentId: contentId || undefined,
        isInline,
        inlineDataUrl: dataUrl,
      })
    } else if (part.body?.data && (isImage || contentId || hasFilename)) {
      // Small inline image or attachment embedded directly in part.body.data
      const b64 = part.body.data.replace(/-/g, '+').replace(/_/g, '/')
      const dataUrl = `data:${mimeType};base64,${b64}`
      if (contentId) {
        cidMap.set(contentId, dataUrl)
        const shortCid = contentId.split('@')[0]
        if (shortCid) cidMap.set(shortCid, dataUrl)
      }
      if (part.filename) {
        cidMap.set(part.filename, dataUrl)
        cidMap.set(part.filename.toLowerCase(), dataUrl)
      }
      attachments.push({
        attachmentId: `inline_${attachments.length}`,
        filename: part.filename || (isImage ? 'slika.png' : 'privitak'),
        mimeType,
        size: part.body.size || Math.round((b64.length * 3) / 4),
        contentId: contentId || undefined,
        isInline: true,
        inlineDataUrl: dataUrl,
      })
    }
  }

  // Replace cid: and filename references in HTML with actual downloadable/inline URLs or data URLs
  if (html && cidMap.size > 0) {
    html = html.replace(/src=(["'])(?:cid:)?([^"']+)\1/gi, (fullMatch, quote, rawVal) => {
      const cleanVal = rawVal.replace(/^<|>$/g, '').trim()
      const resolved =
        cidMap.get(cleanVal) ||
        cidMap.get(cleanVal.toLowerCase()) ||
        cidMap.get(cleanVal.split('@')[0]) ||
        cidMap.get(decodeURIComponent(cleanVal)) ||
        cidMap.get(cleanVal.split(/[/\\]/).pop() || '')
      if (resolved) {
        return `src=${quote}${resolved}${quote}`
      }
      return fullMatch
    })
  }

  return { body: { text, html }, attachments }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') ?? 'list'
  const mailboxParam = searchParams.get('mailbox') ?? undefined
  const messageId = searchParams.get('messageId')
  const attachmentId = searchParams.get('attachmentId')
  const isInlineParam = searchParams.get('inline') === '1'
  const readonlyParam = searchParams.get('readonly') === '1'
  const folder = (searchParams.get('folder') ?? 'INBOX').toUpperCase()
  const pageToken = searchParams.get('pageToken') || undefined
  const q = searchParams.get('q') ?? ''

  // 1. Status check endpoint (used by Settings UI and Inbox header)
  if (action === 'status') {
    const settings = DatabaseService.getSettings()
    const rawJson = settings?.googleServiceAccountJson
    const targetEmail = (mailboxParam || settings?.gmailMailbox || '').trim()
    const validation = validateServiceAccountJson(rawJson)

    if (!validation.valid || !validation.credentials) {
      return NextResponse.json({
        connected: false,
        configured: false,
        targetEmail: targetEmail || null,
        error: validation.error || 'Service Account JSON ključ nije konfiguriran.',
      })
    }

    if (!targetEmail) {
      return NextResponse.json({
        connected: false,
        configured: false,
        clientEmail: validation.credentials.client_email,
        projectId: validation.credentials.project_id,
        targetEmail: null,
        error: 'Adresa sandučića (Impersonated User) nije unesena.',
      })
    }

    try {
      const { gmail, serviceAccount } = getGmailClientFromConfig(rawJson, targetEmail)
      const [profileRes, inboxLabelRes, sigInfo] = await Promise.all([
        gmail.users.getProfile({ userId: 'me' }),
        gmail.users.labels.get({ userId: 'me', id: 'INBOX' }).catch(() => null),
        fetchGmailSignatureAndAlias(gmail, targetEmail, settings),
      ])

      return NextResponse.json({
        connected: true,
        configured: true,
        targetEmail,
        emailAddress: profileRes.data.emailAddress || targetEmail,
        messagesTotal: profileRes.data.messagesTotal ?? 0,
        threadsTotal: profileRes.data.threadsTotal ?? 0,
        unreadInboxCount: inboxLabelRes?.data?.messagesUnread ?? 0,
        signature: sigInfo.signature,
        displayName: sigInfo.displayName,
        clientEmail: serviceAccount.client_email,
        projectId: serviceAccount.project_id,
      })
    } catch (error: any) {
      return NextResponse.json({
        connected: false,
        configured: true,
        targetEmail,
        clientEmail: validation.credentials.client_email,
        projectId: validation.credentials.project_id,
        error: formatGmailError(error),
      })
    }
  }

  try {
    const { gmail, targetEmail, settings } = getGmailClientFromConfig(undefined, mailboxParam)

    // 2. Download or display inline attachment endpoint
    if (action === 'attachment' && messageId && attachmentId) {
      const filename = searchParams.get('filename') || 'privitak'
      const mimeType = searchParams.get('mimeType') || 'application/octet-stream'

      const att = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: attachmentId,
      })

      const data = att.data.data
      if (!data) {
        return NextResponse.json({ error: 'Privitak je prazan ili nije pronađen.' }, { status: 404 })
      }

      const buffer = decodeBase64UrlToBuffer(data)
      const encodedFilename = encodeURIComponent(filename)
      const dispositionType = isInlineParam ? 'inline' : 'attachment'

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(buffer.length),
          'Cache-Control': 'private, max-age=3600',
          'Content-Disposition': `${dispositionType}; filename="${filename.replace(/"/g, '')}"; filename*=UTF-8''${encodedFilename}`,
        },
      })
    }

    // 3. List Gmail templates (stored in Gmail as Drafts / Canned Responses or under a Templates label)
    if (action === 'templates') {
      const [draftsRes, labelsRes] = await Promise.all([
        gmail.users.drafts
          .list({
            userId: 'me',
            maxResults: 50,
            includeSpamTrash: false,
          })
          .catch(() => null),
        gmail.users.labels.list({ userId: 'me' }).catch(() => null),
      ])

      const draftRefs: Array<{ messageId: string; draftId?: string }> = []
      const seenMessageIds = new Set<string>()

      for (const d of draftsRes?.data?.drafts ?? []) {
        const mId = d.message?.id
        if (mId && !seenMessageIds.has(mId)) {
          seenMessageIds.add(mId)
          draftRefs.push({ messageId: mId, draftId: d.id || undefined })
        }
      }

      // Also check if the mailbox has a dedicated custom label for templates (e.g. "Templates", "Predlošci")
      const templateLabelNames = new Set([
        'templates',
        'template',
        'predlošci',
        'predlosci',
        'predložak',
        'predlozak',
        'canned responses',
      ])
      const matchingLabelIds = (labelsRes?.data?.labels ?? [])
        .filter((l) => l.id && l.name && templateLabelNames.has(l.name.trim().toLowerCase()))
        .map((l) => l.id!)

      if (matchingLabelIds.length > 0) {
        const labeledList = await gmail.users.messages
          .list({
            userId: 'me',
            labelIds: matchingLabelIds,
            maxResults: 50,
            includeSpamTrash: false,
          })
          .catch(() => null)

        for (const m of labeledList?.data?.messages ?? []) {
          if (m.id && !seenMessageIds.has(m.id)) {
            seenMessageIds.add(m.id)
            draftRefs.push({ messageId: m.id })
          }
        }
      }

      const rawTemplates = await Promise.all(
        draftRefs.map(async ({ messageId: mId, draftId }) => {
          try {
            const msg = await gmail.users.messages.get({
              userId: 'me',
              id: mId,
              format: 'full',
            })
            const msgLabels = msg.data.labelIds ?? []
            if (msgLabels.includes('TRASH') || msgLabels.includes('SPAM')) {
              return null
            }

            const payload = msg.data.payload
            const headers = parseMessageHeaders(payload?.headers ?? [])
            const { body } = await extractBodyAndAttachments(payload, mId, targetEmail, gmail)

            const cleanSubject = (headers.subject || '').trim()
            const snippet = (msg.data.snippet || '').trim()

            // Skip completely blank drafts with no subject and no body
            if (!cleanSubject && !body.html.trim() && !body.text.trim() && !snippet) {
              return null
            }

            // Native Gmail Canned Responses / Templates are saved as standalone drafts without To or In-Reply-To
            const isStandaloneTemplate = !headers.inReplyTo && !headers.to.trim()
            const internalDate = Number(msg.data.internalDate || 0)

            return {
              id: mId,
              draftId,
              name: cleanSubject || snippet.slice(0, 60) || 'Predložak bez naslova',
              subject: cleanSubject,
              snippet,
              html: body.html,
              text: body.text,
              internalDate,
              isStandaloneTemplate,
            }
          } catch {
            return null
          }
        })
      )

      const templates = rawTemplates
        .filter((t): t is NonNullable<typeof t> => t !== null)
        .sort((a, b) => {
          if (a.isStandaloneTemplate !== b.isStandaloneTemplate) {
            return a.isStandaloneTemplate ? -1 : 1
          }
          return (b.internalDate || 0) - (a.internalDate || 0)
        })

      return NextResponse.json(
        {
          templates,
          mailbox: targetEmail,
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        }
      )
    }

    // 4. Single message detail endpoint
    if (action === 'message' && messageId) {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      })

      const payload = msg.data.payload
      const headers = parseMessageHeaders(payload?.headers ?? [])
      const { body, attachments } = await extractBodyAndAttachments(payload, messageId, targetEmail, gmail)
      const labelIds = msg.data.labelIds ?? []

      // Automatically mark as read if it was unread (unless user is in readonly mode)
      if (labelIds.includes('UNREAD') && !readonlyParam) {
        try {
          await gmail.users.messages.modify({
            userId: 'me',
            id: messageId,
            requestBody: { removeLabelIds: ['UNREAD'] },
          })
        } catch {}
      }

      return NextResponse.json({
        id: msg.data.id,
        threadId: msg.data.threadId,
        labelIds: readonlyParam ? labelIds : labelIds.filter((l) => l !== 'UNREAD'),
        starred: labelIds.includes('STARRED'),
        snippet: msg.data.snippet,
        ...headers,
        body,
        attachments,
        mailbox: targetEmail,
      })
    }

    // 4. List messages endpoint (with unread messages sorted at the top!)
    const labelIds: string[] = []
    let includeSpamTrash = false

    if (folder === 'INBOX') labelIds.push('INBOX')
    else if (folder === 'STARRED') labelIds.push('STARRED')
    else if (folder === 'SENT') labelIds.push('SENT')
    else if (folder === 'DRAFT') labelIds.push('DRAFT')
    else if (folder === 'TRASH') {
      labelIds.push('TRASH')
      includeSpamTrash = true
    } else if (folder === 'SPAM') {
      labelIds.push('SPAM')
      includeSpamTrash = true
    }

    // Exclude Trash and Spam explicitly when viewing any folder other than TRASH or SPAM
    const baseFilter =
      folder !== 'TRASH' && folder !== 'SPAM' ? '-in:trash -in:spam' : ''
    const mainQuery = [baseFilter, q.trim()].filter(Boolean).join(' ')
    const unreadQuery = [baseFilter, q.trim(), 'is:unread'].filter(Boolean).join(' ')

    const [list, unreadList, inboxLabel, sigInfo] = await Promise.all([
      gmail.users.messages.list({
        userId: 'me',
        maxResults: 30,
        pageToken,
        labelIds: labelIds.length > 0 ? labelIds : undefined,
        includeSpamTrash,
        q: mainQuery || undefined,
      }),
      !pageToken && folder !== 'SENT' && folder !== 'DRAFT'
        ? gmail.users.messages
            .list({
              userId: 'me',
              maxResults: 25,
              labelIds: labelIds.length > 0 ? labelIds : undefined,
              includeSpamTrash,
              q: unreadQuery,
            })
            .catch(() => null)
        : Promise.resolve(null),
      gmail.users.labels.get({ userId: 'me', id: 'INBOX' }).catch(() => null),
      !pageToken
        ? fetchGmailSignatureAndAlias(gmail, targetEmail, settings)
        : Promise.resolve({ signature: '', displayName: '' }),
    ])

    // Combine and deduplicate message IDs (unread first, then regular list)
    const combinedRefs: Array<{ id: string; threadId?: string | null }> = []
    const seenIds = new Set<string>()

    for (const m of unreadList?.data?.messages ?? []) {
      if (m.id && !seenIds.has(m.id)) {
        seenIds.add(m.id)
        combinedRefs.push({ id: m.id, threadId: m.threadId })
      }
    }
    for (const m of list.data.messages ?? []) {
      if (m.id && !seenIds.has(m.id)) {
        seenIds.add(m.id)
        combinedRefs.push({ id: m.id, threadId: m.threadId })
      }
    }

    const rawMessages = await Promise.all(
      combinedRefs.map(async (m) => {
        try {
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id: m.id!,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Date', 'Content-Type'],
          })
          const headers = parseMessageHeaders(msg.data.payload?.headers ?? [])
          const msgLabels = msg.data.labelIds ?? []

          // Double-check live labels on the message object so deleted/trashed/archived emails never appear
          if (folder !== 'TRASH' && msgLabels.includes('TRASH')) return null
          if (folder !== 'SPAM' && msgLabels.includes('SPAM')) return null
          if (folder === 'INBOX' && !msgLabels.includes('INBOX')) return null
          if (folder === 'TRASH' && !msgLabels.includes('TRASH')) return null
          if (folder === 'SPAM' && !msgLabels.includes('SPAM')) return null

          const ct = headers.contentType.toLowerCase()
          const hasAttachments = ct.includes('multipart/mixed') || ct.includes('multipart/related')
          const internalDate = Number(msg.data.internalDate || 0)
          return {
            id: msg.data.id,
            threadId: msg.data.threadId,
            snippet: msg.data.snippet,
            labelIds: msgLabels,
            unread: msgLabels.includes('UNREAD'),
            starred: msgLabels.includes('STARRED'),
            hasAttachments,
            internalDate,
            ...headers,
          }
        } catch {
          // Message was permanently deleted (404 Not Found)
          return null
        }
      })
    )

    const messages = rawMessages.filter((m): m is NonNullable<typeof m> => m !== null)

    // Strictly sort: UNREAD messages at the top (newest first), then READ messages (newest first)
    messages.sort((a, b) => {
      if (a.unread !== b.unread) {
        return a.unread ? -1 : 1
      }
      return (b.internalDate || 0) - (a.internalDate || 0)
    })

    return NextResponse.json(
      {
        messages,
        nextPageToken: list.data.nextPageToken,
        resultSizeEstimate: list.data.resultSizeEstimate,
        unreadInboxCount: inboxLabel?.data?.messagesUnread ?? 0,
        signature: sigInfo.signature,
        displayName: sigInfo.displayName,
        mailbox: targetEmail,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    )
  } catch (error: any) {
    console.error('Gmail API GET error:', error)
    return NextResponse.json({ error: formatGmailError(error) }, { status: 400 })
  }
}

export interface OutgoingAttachment {
  filename: string
  mimeType: string
  contentBase64: string
  contentId?: string
  isInline?: boolean
  size?: number
}

export interface InlineMimeAttachment {
  contentId: string
  filename: string
  mimeType: string
  contentBase64: string
}

function generateCid(index: number, mailbox = 'rodoslovlje.hr'): string {
  const domain = mailbox && mailbox.includes('@') ? mailbox.split('@')[1] : 'rodoslovlje.hr'
  return `img_${Date.now()}_${index}@${domain}`
}

function formatBase64(data: string): string {
  const clean = data.replace(/^data:[^;]+;base64,/, '').replace(/[\r\n\s]+/g, '')
  if (!clean) return ''
  return clean.replace(/(.{76})/g, '$1\r\n')
}

function ensureResponsiveImgStyle(existingStyle?: string): string {
  if (!existingStyle) {
    return 'max-width: 100%; height: auto;'
  }
  let s = existingStyle.trim().replace(/^['"]|['"]$/g, '')
  if (s.length > 0 && !s.endsWith(';')) s += ';'
  if (!/max-width\s*:/i.test(s)) {
    s += ' max-width: 100%;'
  }
  if (!/height\s*:/i.test(s)) {
    s += ' height: auto;'
  }
  return s.trim()
}

async function processHtmlImagesAndExtractInlineAttachments(
  html: string,
  rawAttachments: OutgoingAttachment[] = [],
  gmail?: any,
  mailboxEmail = 'rodoslovlje.hr'
): Promise<{
  processedHtml: string
  inlineAttachments: InlineMimeAttachment[]
  remainingAttachments: OutgoingAttachment[]
}> {
  const remainingAttachments: OutgoingAttachment[] = [...(rawAttachments || [])]
  const inlineAttachments: InlineMimeAttachment[] = []
  const usedCids = new Set<string>()

  function allocateCid(index: number, hintCid?: string): string {
    let clean = (hintCid || '').replace(/^cid:/i, '').replace(/^<|>$/g, '').trim()
    if (!clean) {
      clean = generateCid(index, mailboxEmail)
    } else if (!clean.includes('@')) {
      const domain = mailboxEmail.includes('@') ? mailboxEmail.split('@')[1] : 'rodoslovlje.hr'
      clean = `${clean}@${domain}`
    }

    let finalCid = clean
    let counter = 2
    while (usedCids.has(finalCid)) {
      finalCid = `${clean.split('@')[0]}_${counter++}@${clean.split('@')[1] || 'rodoslovlje.hr'}`
    }
    usedCids.add(finalCid)
    return finalCid
  }

  function findAndRemoveAttachment(predicate: (att: OutgoingAttachment) => boolean): OutgoingAttachment | null {
    const idx = remainingAttachments.findIndex(predicate)
    if (idx >= 0) {
      return remainingAttachments.splice(idx, 1)[0]
    }
    return null
  }

  if (!html || !html.trim()) {
    // Check if any attachment is explicitly flagged inline or has contentId
    for (let i = remainingAttachments.length - 1; i >= 0; i--) {
      const att = remainingAttachments[i]
      if (att.isInline || att.contentId) {
        remainingAttachments.splice(i, 1)
        const cid = allocateCid(inlineAttachments.length + 1, att.contentId)
        inlineAttachments.push({
          contentId: cid,
          filename: att.filename,
          mimeType: att.mimeType || 'image/png',
          contentBase64: att.contentBase64.replace(/^data:[^;]+;base64,/, ''),
        })
      }
    }
    return { processedHtml: html, inlineAttachments, remainingAttachments }
  }

  let processedHtml = html
  let imgIndex = 0

  // Regex to extract each <img> tag
  const imgTagRegex = /<img\b([^>]*?)>/gi
  const imgMatches: Array<{ fullTag: string; attrsStr: string }> = []
  let tagMatch
  while ((tagMatch = imgTagRegex.exec(html)) !== null) {
    imgMatches.push({
      fullTag: tagMatch[0],
      attrsStr: tagMatch[1],
    })
  }

  for (const item of imgMatches) {
    imgIndex++
    // Parse attributes from the <img> tag
    const attrRegex = /([a-zA-Z0-9_-]+)(?:\s*=\s*(?:(?:"([^"]*)")|(?:'([^']*)')|([^\s>]+)))?/g
    const attrs: Record<string, string> = {}
    let attrMatch
    while ((attrMatch = attrRegex.exec(item.attrsStr)) !== null) {
      const key = attrMatch[1].toLowerCase()
      if (key === 'img') continue
      const val = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ''
      attrs[key] = val
    }

    const rawSrc = (attrs['src'] || '').trim()
    const decodedSrc = rawSrc.replace(/&amp;/g, '&')
    const altText = (attrs['alt'] || '').trim()
    const titleText = (attrs['title'] || '').trim()
    const dataFilename = (attrs['data-filename'] || attrs['data-name'] || '').trim()
    const hintName = dataFilename || altText || titleText

    let targetCid: string | null = null
    let targetFilename: string | null = null
    let targetMimeType: string = 'image/png'
    let targetBase64: string | null = null

    // Case 1: src is already a cid: protocol (e.g. src="cid:img_...")
    if (decodedSrc.toLowerCase().startsWith('cid:')) {
      const cleanCid = decodedSrc.replace(/^cid:/i, '').replace(/^<|>$/g, '').trim()
      targetCid = cleanCid

      // Look for a matching attachment in remainingAttachments
      const matched = findAndRemoveAttachment((att) => {
        const attCid = (att.contentId || '').replace(/^<|>$/g, '').trim().toLowerCase()
        if (attCid && (attCid === cleanCid.toLowerCase() || attCid === cleanCid.split('@')[0].toLowerCase())) return true
        const fname = att.filename.toLowerCase()
        const fnameNoExt = fname.replace(/\.[^.]+$/, '')
        const cidNoExt = cleanCid.toLowerCase().split('@')[0].replace(/\.[^.]+$/, '')
        if (fname === cleanCid.toLowerCase() || fnameNoExt === cidNoExt) return true
        if (hintName && fnameNoExt === hintName.toLowerCase().replace(/\.[^.]+$/, '')) return true
        return false
      })

      if (matched) {
        targetFilename = matched.filename
        targetMimeType = matched.mimeType || 'image/png'
        targetBase64 = matched.contentBase64.replace(/^data:[^;]+;base64,/, '')
      }
    }
    // Case 2: src is a data URL (data:image/...;base64,...)
    else if (decodedSrc.startsWith('data:image/')) {
      const dataUrlMatch = decodedSrc.match(/^data:([^;]+);base64,(.+)$/)
      if (dataUrlMatch) {
        targetMimeType = dataUrlMatch[1]
        targetBase64 = dataUrlMatch[2].replace(/\s/g, '')
        const ext = targetMimeType.split('/')[1]?.split('+')[0] || 'png'

        // Check if an image attachment exists in remainingAttachments (e.g. user attached Uplatnica.png)
        const matched = findAndRemoveAttachment((att) => {
          if (hintName && att.filename.toLowerCase() === hintName.toLowerCase()) return true
          if (
            hintName &&
            att.filename.replace(/\.[^.]+$/, '').toLowerCase() === hintName.replace(/\.[^.]+$/, '').toLowerCase()
          )
            return true
          if (
            targetBase64 &&
            att.contentBase64 &&
            att.contentBase64.replace(/^data:[^;]+;base64,/, '') === targetBase64
          )
            return true
          if (att.mimeType?.startsWith('image/')) return true
          return false
        })

        if (matched) {
          targetFilename = matched.filename
          targetMimeType = matched.mimeType || targetMimeType
          if (matched.contentBase64) {
            targetBase64 = matched.contentBase64.replace(/^data:[^;]+;base64,/, '')
          }
        } else {
          targetFilename = hintName
            ? hintName.includes('.')
              ? hintName
              : `${hintName}.${ext}`
            : `Uplatnica.${ext}`
        }
        targetCid = allocateCid(imgIndex)
      }
    }
    // Case 3: src points to /api/gmail?action=attachment
    else if (decodedSrc.includes('/api/gmail') && decodedSrc.includes('action=attachment')) {
      try {
        const urlObj = new URL(decodedSrc, 'http://localhost')
        const messageId = urlObj.searchParams.get('messageId')
        const attachmentId = urlObj.searchParams.get('attachmentId')
        const mimeParam = urlObj.searchParams.get('mimeType') || 'image/png'
        const filenameParam = urlObj.searchParams.get('filename') || hintName || `image_${imgIndex}.png`

        targetMimeType = mimeParam
        targetFilename = filenameParam
        targetCid = allocateCid(imgIndex)

        // Check if file is already in remainingAttachments
        const matched = findAndRemoveAttachment((att) => {
          return att.filename.toLowerCase() === filenameParam.toLowerCase()
        })

        if (matched) {
          targetBase64 = matched.contentBase64.replace(/^data:[^;]+;base64,/, '')
        } else if (messageId && attachmentId && gmail) {
          const attRes = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId,
            id: attachmentId,
          })
          const rawData = attRes.data?.data
          if (rawData) {
            targetBase64 = rawData.replace(/-/g, '+').replace(/_/g, '/')
          }
        }
      } catch (err) {
        console.error('Error resolving attachment for inline MIME:', err)
      }
    }
    // Case 4: src is a filename, relative path, or matches an attachment by name or alt
    else {
      const decodedBasename = decodeURIComponent(decodedSrc.split(/[/\\]/).pop()?.split('?')[0] || '')
      const matchCandidate = decodedBasename || hintName

      if (matchCandidate) {
        const matched = findAndRemoveAttachment((att) => {
          const fname = att.filename.toLowerCase()
          const cand = matchCandidate.toLowerCase()
          if (fname === cand) return true
          if (fname.replace(/\.[^.]+$/, '') === cand.replace(/\.[^.]+$/, '')) return true
          if (hintName && fname.replace(/\.[^.]+$/, '') === hintName.toLowerCase().replace(/\.[^.]+$/, ''))
            return true
          if (att.mimeType?.startsWith('image/')) return true
          return false
        })

        if (matched) {
          targetFilename = matched.filename
          targetMimeType = matched.mimeType || 'image/png'
          targetBase64 = matched.contentBase64.replace(/^data:[^;]+;base64,/, '')
          targetCid = allocateCid(imgIndex, matched.contentId)
        }
      }

      // If still not matched, but there is an image attachment remaining in remainingAttachments:
      if (
        !targetBase64 &&
        remainingAttachments.length > 0 &&
        remainingAttachments.some((a) => a.mimeType?.startsWith('image/'))
      ) {
        const singleAtt = findAndRemoveAttachment((a) => Boolean(a.mimeType?.startsWith('image/')))!
        targetFilename = singleAtt.filename
        targetMimeType = singleAtt.mimeType || 'image/png'
        targetBase64 = singleAtt.contentBase64.replace(/^data:[^;]+;base64,/, '')
        targetCid = allocateCid(imgIndex, singleAtt.contentId)
      }
    }

    // If we have resolved/extracted an inline attachment, link it via CID
    if (targetCid && targetBase64) {
      const finalCid = allocateCid(imgIndex, targetCid)
      inlineAttachments.push({
        contentId: finalCid,
        filename: targetFilename || `Uplatnica.png`,
        mimeType: targetMimeType || 'image/png',
        contentBase64: targetBase64,
      })

      // Update <img> tag attributes: in HTML, src must be cid:<cid> WITHOUT angle brackets!
      attrs['src'] = `cid:${finalCid}`
      if (!attrs['alt'] && targetFilename) {
        attrs['alt'] = targetFilename.replace(/\.[^.]+$/, '')
      }
      attrs['style'] = ensureResponsiveImgStyle(attrs['style'])

      const attrStrings: string[] = []
      for (const [k, v] of Object.entries(attrs)) {
        attrStrings.push(`${k}="${v.replace(/"/g, '&quot;')}"`)
      }
      const newImgTag = `<img ${attrStrings.join(' ')} />`
      processedHtml = processedHtml.replace(item.fullTag, newImgTag)
    } else if (targetCid) {
      // Just ensure responsive style and cid prefix without angle brackets
      const cleanCid = targetCid.replace(/^<|>$/g, '').replace(/^cid:/i, '').trim()
      attrs['src'] = `cid:${cleanCid}`
      attrs['style'] = ensureResponsiveImgStyle(attrs['style'])
      const attrStrings: string[] = []
      for (const [k, v] of Object.entries(attrs)) {
        attrStrings.push(`${k}="${v.replace(/"/g, '&quot;')}"`)
      }
      const newImgTag = `<img ${attrStrings.join(' ')} />`
      processedHtml = processedHtml.replace(item.fullTag, newImgTag)
    }
  }

  // After processing <img> tags, check any remaining attachments marked inline or having contentId
  for (let i = remainingAttachments.length - 1; i >= 0; i--) {
    const att = remainingAttachments[i]
    if (att.isInline || att.contentId) {
      remainingAttachments.splice(i, 1)
      const cid = allocateCid(inlineAttachments.length + 1, att.contentId)
      inlineAttachments.push({
        contentId: cid,
        filename: att.filename,
        mimeType: att.mimeType || 'image/png',
        contentBase64: att.contentBase64.replace(/^data:[^;]+;base64,/, ''),
      })
    }
  }

  return { processedHtml, inlineAttachments, remainingAttachments }
}

function buildRawMimeMessage(params: {
  from: string
  fromDisplayName?: string
  to?: string
  cc?: string
  bcc?: string
  subject: string
  htmlBody?: string
  textBody?: string
  inReplyTo?: string
  references?: string
  attachments?: OutgoingAttachment[]
  inlineAttachments?: InlineMimeAttachment[]
}): string {
  const {
    from,
    fromDisplayName,
    to,
    cc,
    bcc,
    subject,
    htmlBody,
    textBody,
    inReplyTo,
    references,
    attachments = [],
    inlineAttachments = [],
  } = params

  const formattedFrom = fromDisplayName
    ? `${encodeMimeHeader(fromDisplayName)} <${from}>`
    : from

  const headers: string[] = [`From: ${formattedFrom}`]
  if (to && to.trim()) headers.push(`To: ${to.trim()}`)
  if (cc && cc.trim()) headers.push(`Cc: ${cc.trim()}`)
  if (bcc && bcc.trim()) headers.push(`Bcc: ${bcc.trim()}`)
  headers.push(`Subject: ${encodeMimeHeader(subject || '(bez naslova)')}`)
  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`)
  if (references) headers.push(`References: ${references}`)
  headers.push('MIME-Version: 1.0')

  const finalHtml =
    htmlBody ??
    `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1e293b;">${(textBody || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>')}</div>`

  const hasInline = inlineAttachments.length > 0
  const hasMixed = attachments.length > 0

  const htmlPartLines = [
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    formatBase64(Buffer.from(finalHtml, 'utf8').toString('base64')),
  ]

  // Sastavi multipart/related dio ako postoje ugrađene slike
  const relBoundary = `rel_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const relatedLines: string[] = []

  if (hasInline) {
    relatedLines.push(
      `Content-Type: multipart/related; boundary="${relBoundary}"`,
      '',
      `--${relBoundary}`,
      ...htmlPartLines
    )

    for (const inlineAtt of inlineAttachments) {
      const cleanCid = inlineAtt.contentId.replace(/^<|>$/g, '').replace(/^cid:/i, '').trim()
      const encodedName = encodeMimeHeader(inlineAtt.filename)
      const mimeType = inlineAtt.mimeType || 'image/png'
      const formattedImageBase64 = formatBase64(inlineAtt.contentBase64)

      relatedLines.push(
        `--${relBoundary}`,
        `Content-Type: ${mimeType}; name="${encodedName}"`,
        'Content-Transfer-Encoding: base64',
        `Content-ID: <${cleanCid}>`,
        `Content-Disposition: inline; filename="${encodedName}"`,
        '',
        formattedImageBase64
      )
    }

    relatedLines.push(`--${relBoundary}--`)
  }

  // Slučaj 1: Postoje standardni privitci za skidanje -> Krovni tip je multipart/mixed
  if (hasMixed) {
    const mixedBoundary = `mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const mixedLines: string[] = [
      ...headers,
      `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
      '',
      `--${mixedBoundary}`,
    ]

    if (hasInline) {
      mixedLines.push(...relatedLines)
    } else {
      mixedLines.push(...htmlPartLines)
    }

    for (const att of attachments) {
      const encodedName = encodeMimeHeader(att.filename)
      const mimeType = att.mimeType || 'application/octet-stream'
      const formattedAttBase64 = formatBase64(att.contentBase64)

      mixedLines.push(
        `--${mixedBoundary}`,
        `Content-Type: ${mimeType}; name="${encodedName}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${encodedName}"`,
        '',
        formattedAttBase64
      )
    }

    mixedLines.push(`--${mixedBoundary}--`)
    const fullMessage = mixedLines.join('\r\n')
    return Buffer.from(fullMessage, 'utf8').toString('base64url')
  }

  // Slučaj 2: Nema standardnih privitaka, ali postoje ugrađene slike -> Krovni tip je multipart/related
  if (hasInline) {
    const relatedMessageLines: string[] = [
      ...headers,
      ...relatedLines,
    ]
    const fullMessage = relatedMessageLines.join('\r\n')
    return Buffer.from(fullMessage, 'utf8').toString('base64url')
  }

  // Slučaj 3: Obična HTML poruka bez ikakvih privitaka
  const simpleLines: string[] = [
    ...headers,
    ...htmlPartLines,
  ]
  const fullMessage = simpleLines.join('\r\n')
  return Buffer.from(fullMessage, 'utf8').toString('base64url')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      action,
      mailbox,
      googleServiceAccountJson,
      gmailMailbox,
      to,
      cc,
      bcc,
      subject,
      htmlBody,
      textBody,
      inReplyTo,
      references,
      threadId,
      attachments,
      messageId,
    } = body

    // 1. Test and/or save Service Account + Impersonated User configuration from Admin Settings
    if (action === 'test-config' || action === 'save-config') {
      const settings = DatabaseService.getSettings()
      const rawJson = googleServiceAccountJson ?? settings?.googleServiceAccountJson
      const targetEmail = (gmailMailbox ?? mailbox ?? settings?.gmailMailbox ?? '').trim()

      const validation = validateServiceAccountJson(rawJson)
      if (!validation.valid || !validation.credentials) {
        return NextResponse.json(
          {
            success: false,
            connected: false,
            error: validation.error || 'Neispravan Service Account JSON ključ.',
          },
          { status: 400 }
        )
      }

      if (!targetEmail || !targetEmail.includes('@')) {
        return NextResponse.json(
          {
            success: false,
            connected: false,
            error: 'Unesite ispravnu e-mail adresu sandučića (npr. tajnistvo@rodoslovlje.hr).',
          },
          { status: 400 }
        )
      }

      if (action === 'save-config') {
        DatabaseService.updateSettings({
          googleServiceAccountJson: rawJson.trim(),
          gmailMailbox: targetEmail,
        })
      }

      try {
        const { gmail, serviceAccount } = getGmailClientFromConfig(rawJson.trim(), targetEmail)
        const [profile, sigInfo] = await Promise.all([
          gmail.users.getProfile({ userId: 'me' }),
          fetchGmailSignatureAndAlias(gmail, targetEmail, settings),
        ])

        return NextResponse.json({
          success: true,
          connected: true,
          targetEmail,
          emailAddress: profile.data.emailAddress || targetEmail,
          messagesTotal: profile.data.messagesTotal ?? 0,
          threadsTotal: profile.data.threadsTotal ?? 0,
          signature: sigInfo.signature,
          displayName: sigInfo.displayName,
          clientEmail: serviceAccount.client_email,
          projectId: serviceAccount.project_id,
          message: `Povezano s ${profile.data.emailAddress || targetEmail}`,
        })
      } catch (err: any) {
        return NextResponse.json(
          {
            success: action === 'save-config',
            connected: false,
            targetEmail,
            clientEmail: validation.credentials.client_email,
            projectId: validation.credentials.project_id,
            error: formatGmailError(err),
          },
          { status: 200 }
        )
      }
    }

    // 2. Standard Gmail actions (send, trash, untrash, delete, markRead, markUnread, star, unstar)
    const { gmail, targetEmail, settings } = getGmailClientFromConfig(undefined, mailbox)

    if (action === 'send') {
      if (!to || !to.trim()) {
        return NextResponse.json({ error: 'Polje primatelja (Za) je obavezno.' }, { status: 400 })
      }

      const sigInfo = await fetchGmailSignatureAndAlias(gmail, targetEmail, settings)

      const { processedHtml, inlineAttachments, remainingAttachments } =
        await processHtmlImagesAndExtractInlineAttachments(
          htmlBody || '',
          attachments || [],
          gmail,
          targetEmail
        )

      const raw = buildRawMimeMessage({
        from: targetEmail,
        fromDisplayName: sigInfo.displayName || undefined,
        to: to.trim(),
        cc,
        bcc,
        subject: subject || '(bez naslova)',
        htmlBody: processedHtml,
        textBody,
        inReplyTo,
        references,
        attachments: remainingAttachments,
        inlineAttachments,
      })

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw,
          threadId: threadId || undefined,
        },
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'save-template') {
      const templateName = (subject || '').trim()
      if (!templateName) {
        return NextResponse.json(
          { error: 'Unesite naziv predloška (naslov).' },
          { status: 400 }
        )
      }

      const sigInfo = await fetchGmailSignatureAndAlias(gmail, targetEmail, settings)

      const { processedHtml, inlineAttachments, remainingAttachments } =
        await processHtmlImagesAndExtractInlineAttachments(
          htmlBody || '',
          attachments || [],
          gmail,
          targetEmail
        )

      const raw = buildRawMimeMessage({
        from: targetEmail,
        fromDisplayName: sigInfo.displayName || undefined,
        subject: templateName,
        htmlBody: processedHtml,
        textBody,
        attachments: remainingAttachments,
        inlineAttachments,
      })

      if (body.replaceDraftId) {
        await gmail.users.drafts.update({
          userId: 'me',
          id: body.replaceDraftId,
          requestBody: {
            message: { raw },
          },
        })
      } else {
        await gmail.users.drafts.create({
          userId: 'me',
          requestBody: {
            message: { raw },
          },
        })
      }

      return NextResponse.json({ success: true })
    }

    if (action === 'delete-template') {
      if (body.draftId) {
        await gmail.users.drafts.delete({ userId: 'me', id: body.draftId })
      } else if (messageId) {
        await gmail.users.messages.trash({ userId: 'me', id: messageId })
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'trash' && messageId) {
      await gmail.users.messages.trash({ userId: 'me', id: messageId })
      return NextResponse.json({ success: true })
    }

    if (action === 'untrash' && messageId) {
      await gmail.users.messages.untrash({ userId: 'me', id: messageId })
      return NextResponse.json({ success: true })
    }

    if (action === 'delete' && messageId) {
      await gmail.users.messages.delete({ userId: 'me', id: messageId })
      return NextResponse.json({ success: true })
    }

    if (action === 'markRead' && messageId) {
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: { removeLabelIds: ['UNREAD'] },
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'markUnread' && messageId) {
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: { addLabelIds: ['UNREAD'] },
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'star' && messageId) {
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: { addLabelIds: ['STARRED'] },
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'unstar' && messageId) {
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: { removeLabelIds: ['STARRED'] },
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Nepoznata akcija.' }, { status: 400 })
  } catch (error: any) {
    console.error('Gmail POST error:', error)
    return NextResponse.json({ error: formatGmailError(error) }, { status: 500 })
  }
}
