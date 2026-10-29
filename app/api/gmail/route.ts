import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'
import { google } from 'googleapis'

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
]

export interface ServiceAccountCredentials {
  project_id: string
  client_email: string
  private_key: string
  [key: string]: any
}

export function validateServiceAccountJson(rawJson?: string | null): {
  valid: boolean
  credentials?: ServiceAccountCredentials
  error?: string
} {
  if (!rawJson || !rawJson.trim()) {
    return { valid: false, error: 'Service Account JSON ključ nije unesen.' }
  }

  try {
    const parsed = JSON.parse(rawJson.trim())
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'Neispravan JSON format.' }
    }
    if (!parsed.project_id || typeof parsed.project_id !== 'string') {
      return { valid: false, error: 'U JSON ključu nedostaje polje "project_id".' }
    }
    if (!parsed.client_email || typeof parsed.client_email !== 'string') {
      return { valid: false, error: 'U JSON ključu nedostaje polje "client_email".' }
    }
    if (!parsed.private_key || typeof parsed.private_key !== 'string') {
      return { valid: false, error: 'U JSON ključu nedostaje polje "private_key".' }
    }
    return { valid: true, credentials: parsed as ServiceAccountCredentials }
  } catch (err: any) {
    return { valid: false, error: 'Neispravan JSON format: ' + (err.message || 'greška pri parsiranju') }
  }
}

function getGmailClientFromConfig(rawJson?: string | null, overrideMailbox?: string | null) {
  const settings = DatabaseService.getSettings()
  const jsonToUse = rawJson ?? settings?.googleServiceAccountJson
  const targetEmail = (overrideMailbox || settings?.gmailMailbox || '').trim()

  const validation = validateServiceAccountJson(jsonToUse)
  if (!validation.valid || !validation.credentials) {
    throw new Error(validation.error || 'Google Service Account nije konfiguriran u Postavkama.')
  }

  if (!targetEmail) {
    throw new Error('Adresa sandučića (Impersonated User) nije definirana u Postavkama.')
  }

  const serviceAccount = validation.credentials
  const normalizedKey = serviceAccount.private_key.replace(/\\n/g, '\n')

  const auth = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: normalizedKey,
    scopes: GMAIL_SCOPES,
    subject: targetEmail,
  })

  const gmail = google.gmail({ version: 'v1', auth })

  return {
    gmail,
    targetEmail,
    serviceAccount,
  }
}

function decodeBase64UrlToBuffer(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function decodeBase64Url(s: string): string {
  return decodeBase64UrlToBuffer(s).toString('utf8')
}

function encodeMimeHeader(text: string): string {
  if (!text) return ''
  // Encode if non-ASCII characters exist
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
}

function extractBodyAndAttachments(payload: any): {
  body: { text: string; html: string }
  attachments: ParsedAttachment[]
} {
  if (!payload) return { body: { text: '', html: '' }, attachments: [] }

  let text = ''
  let html = ''
  const attachments: ParsedAttachment[] = []

  function walk(part: any) {
    if (!part) return

    const partHeaders = part.headers || []
    const contentDisposition =
      partHeaders.find((h: any) => h.name?.toLowerCase() === 'content-disposition')?.value || ''
    const contentIdRaw =
      partHeaders.find((h: any) => h.name?.toLowerCase() === 'content-id')?.value || ''
    const contentId = contentIdRaw.replace(/^<|>$/g, '')

    const hasFilename = Boolean(part.filename && part.filename.trim().length > 0)
    const isAttachment =
      hasFilename ||
      contentDisposition.toLowerCase().includes('attachment') ||
      Boolean(part.body?.attachmentId && part.mimeType !== 'text/plain' && part.mimeType !== 'text/html')

    if (part.mimeType === 'text/plain' && part.body?.data && !hasFilename) {
      text += decodeBase64Url(part.body.data)
    } else if (part.mimeType === 'text/html' && part.body?.data && !hasFilename) {
      html += decodeBase64Url(part.body.data)
    } else if (isAttachment && part.body?.attachmentId) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename || 'privitak',
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body.size || 0,
        contentId: contentId || undefined,
        isInline: contentDisposition.toLowerCase().includes('inline') || Boolean(contentId),
      })
    }

    if (Array.isArray(part.parts)) {
      part.parts.forEach(walk)
    }
  }

  walk(payload)
  return { body: { text, html }, attachments }
}

function formatGmailError(error: any): string {
  const msg = error?.message || String(error)
  if (
    msg.includes('invalid_grant') ||
    msg.includes('unauthorized_client') ||
    msg.includes('Client is unauthorized')
  ) {
    return 'Autorizacija odbijena (invalid_grant / unauthorized_client). Provjerite je li u Google Workspace Admin konzoli odobren Domain-Wide Delegation za ovaj Client ID sa sva 4 Gmail scopea te postoji li navedena e-mail adresa u vašoj domeni.'
  }
  if (msg.includes('Precondition check failed') || msg.includes('Mail service not enabled')) {
    return 'Gmail usluga nije aktivirana za odabranog korisnika ili korisnik nema aktivan Google Workspace sandučić.'
  }
  if (msg.includes('accessNotConfigured') || msg.includes('Gmail API has not been used')) {
    return 'Gmail API nije omogućen u vašem Google Cloud projektu. Uključite Gmail API u Google Cloud Console.'
  }
  return msg
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') ?? 'list'
  const mailboxParam = searchParams.get('mailbox') ?? undefined
  const messageId = searchParams.get('messageId')
  const attachmentId = searchParams.get('attachmentId')
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
      const [profileRes, inboxLabelRes] = await Promise.all([
        gmail.users.getProfile({ userId: 'me' }),
        gmail.users.labels.get({ userId: 'me', id: 'INBOX' }).catch(() => null),
      ])

      return NextResponse.json({
        connected: true,
        configured: true,
        targetEmail,
        emailAddress: profileRes.data.emailAddress || targetEmail,
        messagesTotal: profileRes.data.messagesTotal ?? 0,
        threadsTotal: profileRes.data.threadsTotal ?? 0,
        unreadInboxCount: inboxLabelRes?.data?.messagesUnread ?? 0,
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
    const { gmail, targetEmail } = getGmailClientFromConfig(undefined, mailboxParam)

    // 2. Download attachment endpoint
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

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(buffer.length),
          'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"; filename*=UTF-8''${encodedFilename}`,
        },
      })
    }

    // 3. Single message detail endpoint
    if (action === 'message' && messageId) {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      })

      const payload = msg.data.payload
      const headers = parseMessageHeaders(payload?.headers ?? [])
      const { body, attachments } = extractBodyAndAttachments(payload)
      const labelIds = msg.data.labelIds ?? []

      // Automatically mark as read if it was unread
      if (labelIds.includes('UNREAD')) {
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
        labelIds: labelIds.filter((l) => l !== 'UNREAD'),
        starred: labelIds.includes('STARRED'),
        snippet: msg.data.snippet,
        ...headers,
        body,
        attachments,
        mailbox: targetEmail,
      })
    }

    // 4. List messages endpoint
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

    const [list, inboxLabel] = await Promise.all([
      gmail.users.messages.list({
        userId: 'me',
        maxResults: 25,
        pageToken,
        labelIds: labelIds.length > 0 ? labelIds : undefined,
        includeSpamTrash,
        q: q.trim() || undefined,
      }),
      gmail.users.labels.get({ userId: 'me', id: 'INBOX' }).catch(() => null),
    ])

    const messages = await Promise.all(
      (list.data.messages ?? []).map(async (m) => {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: m.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Date', 'Content-Type'],
        })
        const headers = parseMessageHeaders(msg.data.payload?.headers ?? [])
        const msgLabels = msg.data.labelIds ?? []
        const hasAttachments = headers.contentType.toLowerCase().includes('multipart/mixed')
        return {
          id: msg.data.id,
          threadId: msg.data.threadId,
          snippet: msg.data.snippet,
          labelIds: msgLabels,
          unread: msgLabels.includes('UNREAD'),
          starred: msgLabels.includes('STARRED'),
          hasAttachments,
          ...headers,
        }
      })
    )

    return NextResponse.json({
      messages,
      nextPageToken: list.data.nextPageToken,
      resultSizeEstimate: list.data.resultSizeEstimate,
      unreadInboxCount: inboxLabel?.data?.messagesUnread ?? 0,
      mailbox: targetEmail,
    })
  } catch (error: any) {
    console.error('Gmail API GET error:', error)
    return NextResponse.json({ error: formatGmailError(error) }, { status: 400 })
  }
}

interface OutgoingAttachment {
  filename: string
  mimeType: string
  contentBase64: string
}

function buildRawMimeMessage(params: {
  from: string
  to: string
  cc?: string
  bcc?: string
  subject: string
  htmlBody?: string
  textBody?: string
  inReplyTo?: string
  references?: string
  attachments?: OutgoingAttachment[]
}): string {
  const {
    from,
    to,
    cc,
    bcc,
    subject,
    htmlBody,
    textBody,
    inReplyTo,
    references,
    attachments = [],
  } = params

  const headers: string[] = [
    `From: ${from}`,
    `To: ${to}`,
  ]
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
  const finalText = textBody ?? finalHtml.replace(/<[^>]+>/g, '')

  const altBoundary = `alt_${Date.now()}_${Math.random().toString(36).slice(2)}`

  const alternativePart = [
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(finalText, 'utf8').toString('base64'),
    '',
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(finalHtml, 'utf8').toString('base64'),
    '',
    `--${altBoundary}--`,
  ].join('\r\n')

  if (!attachments || attachments.length === 0) {
    const fullMessage = [...headers, alternativePart].join('\r\n')
    return Buffer.from(fullMessage, 'utf8').toString('base64url')
  }

  const mixedBoundary = `mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const mixedLines: string[] = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    '',
    `--${mixedBoundary}`,
    alternativePart,
  ]

  for (const att of attachments) {
    const cleanBase64 = att.contentBase64.replace(/^data:[^;]+;base64,/, '')
    const encodedName = encodeMimeHeader(att.filename)
    mixedLines.push(
      `--${mixedBoundary}`,
      `Content-Type: ${att.mimeType || 'application/octet-stream'}; name="${encodedName}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${encodedName}"`,
      '',
      cleanBase64
    )
  }

  mixedLines.push(`--${mixedBoundary}--`)
  return Buffer.from(mixedLines.join('\r\n'), 'utf8').toString('base64url')
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
        const profile = await gmail.users.getProfile({ userId: 'me' })

        return NextResponse.json({
          success: true,
          connected: true,
          targetEmail,
          emailAddress: profile.data.emailAddress || targetEmail,
          messagesTotal: profile.data.messagesTotal ?? 0,
          threadsTotal: profile.data.threadsTotal ?? 0,
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
    const { gmail, targetEmail } = getGmailClientFromConfig(undefined, mailbox)

    if (action === 'send') {
      if (!to || !to.trim()) {
        return NextResponse.json({ error: 'Polje primatelja (Za) je obavezno.' }, { status: 400 })
      }

      const raw = buildRawMimeMessage({
        from: targetEmail,
        to: to.trim(),
        cc,
        bcc,
        subject: subject || '(bez naslova)',
        htmlBody,
        textBody,
        inReplyTo,
        references,
        attachments,
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
