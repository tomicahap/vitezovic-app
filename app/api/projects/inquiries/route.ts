import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { ResearchInquiriesDB, DatabaseService, MailSendersDB } from '@/lib/database'
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

export async function GET(request: NextRequest) {
  try {
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

    if (gmailMessageId) {
      const item = ResearchInquiriesDB.getByGmailMessageId(gmailMessageId)
      return NextResponse.json({
        inquiry: item ? parseInquiry(item) : null,
      })
    }

    if (id) {
      const item = ResearchInquiriesDB.get(parseInt(id, 10))
      if (!item) {
        return NextResponse.json({ error: 'Upit nije pronađen.' }, { status: 404 })
      }
      return NextResponse.json(parseInquiry(item))
    }

    const items = ResearchInquiriesDB.getAll(status, projectId).map(parseInquiry)
    return NextResponse.json({ inquiries: items })
  } catch (e: any) {
    console.error('Error in GET /api/projects/inquiries:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, id, ...data } = body

    const serialize = (d: any) => {
      const copy = { ...d }
      if (copy.attachments && typeof copy.attachments !== 'string') {
        copy.attachments = JSON.stringify(copy.attachments)
      }
      if (copy.email_logs && typeof copy.email_logs !== 'string') {
        copy.email_logs = JSON.stringify(copy.email_logs)
      }
      if (copy.requester_email === undefined && copy.requester_contact) {
        const extracted = extractEmailAddress(copy.requester_contact)
        if (extracted) copy.requester_email = extracted
      }
      return copy
    }

    // 1. Create inquiry directly from a Gmail message ("U istraživanje" button in Inbox)
    if (action === 'from-gmail') {
      const {
        gmailMessageId,
        mailbox,
        assigned_to_id,
        assigned_to_name,
        created_by,
        project_id,
        project_name,
        forceNew,
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

      const { gmail, targetEmail } = getGoogleWorkspaceClients({
        targetEmailOverride: mailbox,
        requireTargetEmail: true,
      })

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

      // Determine sender name and email (prefer Reply-To if it has a different external address, e.g. web contact form)
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

      // Parse received date
      let inquiryDate = new Date().toISOString().slice(0, 10)
      if (dateHeader) {
        const parsedDate = new Date(dateHeader)
        if (!isNaN(parsedDate.getTime())) {
          inquiryDate = parsedDate.toISOString().slice(0, 10)
        }
      } else if (msg.data.internalDate) {
        const parsedDate = new Date(Number(msg.data.internalDate))
        if (!isNaN(parsedDate.getTime())) {
          inquiryDate = parsedDate.toISOString().slice(0, 10)
        }
      }

      // Walk MIME parts to extract body text and save attachments to disk
      let plainText = ''
      let htmlText = ''
      const savedAttachments: Array<{
        id: string
        name: string
        url: string
        fileType: string
        size: number
        mimeType?: string
      }> = []

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

      const uploadDir = process.env.UPLOAD_FOLDER || path.join(process.cwd(), 'data', 'uploads')
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
      }

      for (const part of allParts) {
        const rawMime = (part.mimeType || 'application/octet-stream').toLowerCase()
        const filename = (part.filename || '').trim()
        const hasFilename = Boolean(filename.length > 0)

        if (rawMime === 'text/plain' && part.body?.data && !hasFilename) {
          plainText += decodeBase64Url(part.body.data) + '\n'
        } else if (rawMime === 'text/html' && part.body?.data && !hasFilename) {
          htmlText += decodeBase64Url(part.body.data) + '\n'
        } else if (hasFilename && (part.body?.attachmentId || part.body?.data)) {
          // Skip tiny signature icons or society logo
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
              // Skip tiny inline tracking pixels (< 1.5 KB images marked inline)
              const partHeaders = part.headers || []
              const contentDisposition =
                partHeaders.find((h: any) => h.name?.toLowerCase() === 'content-disposition')?.value || ''
              const isInline = contentDisposition.toLowerCase().includes('inline')
              if (isInline && rawMime.startsWith('image/') && buffer.length < 2048) {
                continue
              }

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
      const contactCombined = [effectiveEmail, phoneFound].filter(Boolean).join(', ')

      const hasAssignee = Boolean(assigned_to_id || (assigned_to_name && String(assigned_to_name).trim()))
      const newInquiryData = {
        requester_name: requesterName,
        requester_email: effectiveEmail,
        requester_contact: contactCombined || effectiveEmail,
        inquiry_date: inquiryDate,
        subject: subjectHeader,
        inquiry_text: cleanBodyText,
        assigned_to_id: assigned_to_id ? Number(assigned_to_id) : null,
        assigned_to_name: assigned_to_name || null,
        assigned_date: hasAssignee ? new Date().toISOString().slice(0, 10) : null,
        status: hasAssignee ? 'active' : 'unassigned',
        priority: 'normal',
        project_id: project_id || null,
        project_name: project_name || null,
        attachments: JSON.stringify(savedAttachments),
        email_logs: JSON.stringify([]),
        gmail_message_id: msg.data.id || gmailMessageId,
        gmail_thread_id: msg.data.threadId || null,
        created_by: created_by || 'Administrator',
      }

      const newId = ResearchInquiriesDB.insert(newInquiryData)
      const created = ResearchInquiriesDB.get(newId)

      try {
        DatabaseService.insertLog({
          userId: 'admin',
          userName: created_by || 'Administrator',
          userRole: 'admin',
          action: 'Upit iz e-maila u istraživanje',
          details: `E-mail "${subjectHeader}" od ${requesterName} (${effectiveEmail}) prebačen u Upiti i istraživanja (#${newId})`,
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

      const {
        emailType, // 'to_researcher' | 'to_requester_wait'
        to,
        cc,
        subject,
        messageHtml,
        includeDonationBlock = true,
        includeAttachments = true,
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

      const { gmail, targetEmail, settings } = getGoogleWorkspaceClients({
        requireTargetEmail: true,
      })

      const campaignSettings = getCampaignSettings()
      const sigInfo = await fetchGmailSignatureAndAlias(gmail, targetEmail, settings)
      const { html: donationBlockHtml, signatureBlockHtml } = await buildSupportAndDonationBlockHtml()

      // Donacijski blok već na dnu sadrži unificirani potpis iz "Donacije & kampanje".
      // Ako bi donacijski blok bio isključen, svejedno dodajemo unificirani potpis.
      const footerBlock = includeDonationBlock ? donationBlockHtml : signatureBlockHtml

      const formattedBodyHtml = `
<div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#1e293b;">
  <div>${messageHtml || ''}</div>
  ${footerBlock ? `<br/>${footerBlock}` : ''}
</div>`.trim()

      // Load inquiry attachments from disk if requested (default true when sending to researcher)
      const outgoingAttachments: OutgoingAttachment[] = []
      if (includeAttachments && Array.isArray(inquiry.attachments) && inquiry.attachments.length > 0) {
        const uploadDir = process.env.UPLOAD_FOLDER || path.join(process.cwd(), 'data', 'uploads')
        for (const att of inquiry.attachments) {
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
          actionType: emailType === 'to_researcher' ? 'inquiry_assign' : 'reply',
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
      const payload = serialize(data)
      if (payload.status === 'pending') {
        payload.status = 'unassigned'
      }
      ResearchInquiriesDB.update(id, payload)
      const updated = ResearchInquiriesDB.get(Number(id))
      return NextResponse.json({ success: true, inquiry: parseInquiry(updated) })
    }

    if (action === 'delete') {
      if (!id) {
        return NextResponse.json({ error: 'Nedostaje ID upita.' }, { status: 400 })
      }
      ResearchInquiriesDB.delete(id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Nepoznata akcija.' }, { status: 400 })
  } catch (e: any) {
    console.error('Error in POST /api/projects/inquiries:', e)
    return NextResponse.json({ error: formatGmailError(e) || e.message }, { status: 500 })
  }
}
