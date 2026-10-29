import { NextRequest, NextResponse } from 'next/server'
import { processHtmlImagesAndExtractInlineAttachments, buildRawMimeMessage } from '@/lib/mime-builder'
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
    const safeDecode = (v: string) => {
      try {
        return decodeURIComponent(v)
      } catch {
        return v
      }
    }
    html = html.replace(/src=(["'])(?:cid:)?([^"']+)\1/gi, (fullMatch, quote, rawVal) => {
      const cleanVal = rawVal.replace(/^<|>$/g, '').trim()
      const resolved =
        cidMap.get(cleanVal) ||
        cidMap.get(cleanVal.toLowerCase()) ||
        cidMap.get(cleanVal.split('@')[0]) ||
        cidMap.get(safeDecode(cleanVal)) ||
        cidMap.get(cleanVal.split(/[/\\]/).pop() || '')
      if (resolved) {
        return `src=${quote}${resolved}${quote}`
      }
      return fullMatch
    })
  }

  // Gmail templates/drafts often reference their images via Gmail-hosted URLs
  // (https://mail.google.com/mail/u/0?ui=2&ik=...&attid=0.1&...&view=fimg) which only
  // render for the logged-in sender. Replace them with the real image bytes so the
  // outgoing message can embed them as inline CID parts.
  if (html) {
    const imageAtts = attachments.filter((a) => a.mimeType?.toLowerCase().startsWith('image/') && a.inlineDataUrl)
    if (imageAtts.length > 0) {
      const normalize = (s: string) =>
        (s || '')
          .toLowerCase()
          .replace(/\.[a-z0-9]{2,5}$/, '')
          .replace(/\s*\(\d+\)\s*$/, '')
          .trim()
      html = html.replace(/<img\b[^>]*>/gi, (tag) => {
        const srcMatch = tag.match(/\bsrc=(["'])(.*?)\1/i)
        if (!srcMatch) return tag
        const src = srcMatch[2].replace(/&amp;/g, '&')
        if (!/^https?:\/\//i.test(src)) return tag
        let u: URL
        try {
          u = new URL(src)
        } catch {
          return tag
        }
        const gmailHosted =
          /(^|\.)mail\.google\.com$/i.test(u.hostname) ||
          (/googleusercontent\.com$/i.test(u.hostname) && (u.searchParams.has('attid') || u.pathname.includes('/mail-')))
        if (!gmailHosted) return tag
        const attid = u.searchParams.get('realattid') || u.searchParams.get('attid') || ''
        const alt = (tag.match(/\balt=(["'])(.*?)\1/i)?.[2] || '').trim()
        const idx = /^0\.\d+$/.test(attid) ? Number(attid.split('.')[1]) - 1 : -1
        const pick =
          imageAtts.find((a) => a.contentId && (a.contentId === attid || a.contentId.split('@')[0] === attid)) ||
          (alt ? imageAtts.find((a) => normalize(a.filename) === normalize(alt)) : undefined) ||
          (idx >= 0 ? imageAtts[idx] : undefined) ||
          imageAtts[0]
        if (!pick?.inlineDataUrl) return tag
        return tag.replace(srcMatch[0], `src="${pick.inlineDataUrl}" data-filename="${pick.filename.replace(/"/g, '')}"`)
      })
    }
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
          gmail
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
          gmail
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
