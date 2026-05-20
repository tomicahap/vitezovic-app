import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'
import { google } from 'googleapis'

// Helper: get Gmail client using service account + domain-wide delegation
async function getGmailClient(userEmail: string) {
  const settings = DatabaseService.getSettings()
  
  if (!settings.googleServiceAccountJson) {
    throw new Error('Google Service Account nije konfiguriran u Postavkama.')
  }
  
  const serviceAccount = JSON.parse(settings.googleServiceAccountJson)
  
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
  })

  // Impersonate the shared mailbox user (domain-wide delegation required)
  const impersonatedAuth = new google.auth.GoogleAuth({
    credentials: {
      ...serviceAccount,
      subject: userEmail, // impersonate this user
    },
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
  })

  const client = await impersonatedAuth.getClient()
  return google.gmail({ version: 'v1', auth: client as any })
}

function decodeBase64Url(s: string): string {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function parseMessageHeaders(headers: any[]) {
  const get = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
  return {
    from: get('From'),
    to: get('To'),
    subject: get('Subject'),
    date: get('Date'),
    messageId: get('Message-ID'),
  }
}

function extractBody(payload: any): { text: string; html: string } {
  if (!payload) return { text: '', html: '' }
  
  let text = ''
  let html = ''
  
  function walk(part: any) {
    if (!part) return
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text += decodeBase64Url(part.body.data)
    }
    if (part.mimeType === 'text/html' && part.body?.data) {
      html += decodeBase64Url(part.body.data)
    }
    if (part.parts) {
      part.parts.forEach(walk)
    }
  }
  
  walk(payload)
  return { text, html }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') ?? 'list'
  const mailbox = searchParams.get('mailbox') ?? '' // shared mailbox email
  const messageId = searchParams.get('messageId')
  const folder = searchParams.get('folder') ?? 'INBOX'
  const pageToken = searchParams.get('pageToken') ?? undefined
  const q = searchParams.get('q') ?? ''

  if (!mailbox) {
    return NextResponse.json({ error: 'Mailbox email nije naveden.' }, { status: 400 })
  }

  try {
    const gmail = await getGmailClient(mailbox)

    if (action === 'message' && messageId) {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      })
      const payload = msg.data.payload
      const headers = parseMessageHeaders(payload?.headers ?? [])
      const body = extractBody(payload)
      
      // Mark as read
      try {
        await gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: { removeLabelIds: ['UNREAD'] },
        })
      } catch {}

      return NextResponse.json({
        id: msg.data.id,
        threadId: msg.data.threadId,
        labelIds: msg.data.labelIds,
        snippet: msg.data.snippet,
        ...headers,
        body,
      })
    }

    // List messages
    const query = [folder !== 'ALL' ? `label:${folder.toLowerCase()}` : '', q].filter(Boolean).join(' ')
    
    const list = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 25,
      pageToken,
      q: query || undefined,
    })

    const messages = await Promise.all(
      (list.data.messages ?? []).map(async (m) => {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: m.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date'],
        })
        const headers = parseMessageHeaders(msg.data.payload?.headers ?? [])
        return {
          id: msg.data.id,
          threadId: msg.data.threadId,
          snippet: msg.data.snippet,
          labelIds: msg.data.labelIds ?? [],
          unread: (msg.data.labelIds ?? []).includes('UNREAD'),
          ...headers,
        }
      })
    )

    return NextResponse.json({
      messages,
      nextPageToken: list.data.nextPageToken,
      resultSizeEstimate: list.data.resultSizeEstimate,
    })
  } catch (error: any) {
    console.error('Gmail API error:', error)
    if (error.message?.includes('Service Account nije konfiguriran')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error.message?.includes('invalid_grant') || error.message?.includes('unauthorized_client')) {
      return NextResponse.json({ 
        error: 'Gmail nije autoriziran. Provjerite Domain-Wide Delegation na Service Accountu i Gmail API pristup.' 
      }, { status: 403 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 })

  const body = await request.json()
  const { action, mailbox, to, subject, htmlBody, textBody, messageId } = body

  if (!mailbox) return NextResponse.json({ error: 'Mailbox nije naveden.' }, { status: 400 })

  try {
    const gmail = await getGmailClient(mailbox)

    if (action === 'send') {
      const messageParts = [
        `From: ${mailbox}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        htmlBody ?? textBody ?? '',
      ]
      const raw = Buffer.from(messageParts.join('\r\n')).toString('base64url')
      
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'trash' && messageId) {
      await gmail.users.messages.trash({ userId: 'me', id: messageId })
      return NextResponse.json({ success: true })
    }

    if (action === 'markRead' && messageId) {
      await gmail.users.messages.modify({
        userId: 'me', id: messageId,
        requestBody: { removeLabelIds: ['UNREAD'] },
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'markUnread' && messageId) {
      await gmail.users.messages.modify({
        userId: 'me', id: messageId,
        requestBody: { addLabelIds: ['UNREAD'] },
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Nepoznata akcija.' }, { status: 400 })
  } catch (error: any) {
    console.error('Gmail POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
