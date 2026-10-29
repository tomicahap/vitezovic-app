import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { DatabaseService } from '@/lib/database'

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
  publicPath?: string
}

export interface GmailLike {
  users: {
    messages: {
      get: (params: any) => Promise<any>
      list?: (params: any) => Promise<any>
      attachments: { get: (params: any) => Promise<any> }
    }
    drafts?: {
      list?: (params: any) => Promise<any>
    }
  }
}

/**
 * Generates a clean Content-ID token (no angle brackets, no @ symbol) so
 * Nodemailer and Gmail API never alter or split it against X-Attachment-Id.
 */
export function generateCid(index = 1): string {
  const rand = Math.random().toString(36).substring(2, 8)
  return index === 1 ? `uplatnica_logo_${rand}` : `uplatnica_logo_${index}_${rand}`
}

export function cleanBase64(data: string): string {
  return (data || '')
    .replace(/^data:[^;,]+;base64,/i, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/[\r\n\s]+/g, '')
}

function extFromMime(mime: string): string {
  const sub = ((mime || 'image/png').split('/')[1] || 'png').split('+')[0].split(';')[0].trim().toLowerCase()
  if (sub === 'jpeg') return 'jpg'
  return sub || 'png'
}

function inferImageMimeFromFilename(filename: string, fallback = 'image/png'): string {
  const lower = (filename || '').toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.bmp')) return 'image/bmp'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  return fallback
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export function normalizeImageName(s: string): string {
  return decodeSafe(s || '')
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/\s*\(\d+\)\s*$/, '')
    .replace(/[^a-z0-9čćžšđ]+/gi, '')
    .trim()
}

/**
 * Produces a clean RFC-safe inline filename without parentheses `(1)` or spaces
 * (e.g. "Uplatnica (1).png" -> "uplatnica.png").
 */
function sanitizeInlineFilename(rawName: string, mimeType: string, index: number): string {
  const ext = extFromMime(mimeType)
  const stripped = decodeSafe(rawName || '')
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/\s*\(\d+\)\s*$/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
  const base = stripped || (index === 1 ? 'uplatnica' : `slika_${index}`)
  return `${base}.${ext}`
}

/**
 * Persists an inline image to the public uploads directory (`data/uploads` or `UPLOAD_FOLDER`)
 * so it can also be served directly via `/uploads/<file>` and `/api/uploads/<file>`.
 */
export function saveInlineImageToPublicUploads(base64Data: string, mimeType: string, rawFilename?: string): string | null {
  try {
    const clean = cleanBase64(base64Data)
    if (!clean) return null
    const buf = Buffer.from(clean, 'base64')
    if (buf.length === 0) return null

    const uploadDir = process.env.UPLOAD_FOLDER || path.join(process.cwd(), 'data', 'uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    const ext = extFromMime(mimeType)
    const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12)
    const cleanBase =
      decodeSafe(rawFilename || 'uplatnica')
        .replace(/\.[a-z0-9]{2,5}$/i, '')
        .replace(/\s*\(\d+\)\s*$/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'uplatnica'

    const fileName = `${cleanBase}-${hash}.${ext}`
    const filePath = path.join(uploadDir, fileName)
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, buf)
    }
    return `/uploads/${fileName}`
  } catch (err) {
    console.warn('[MIME] Nije moguće spremiti inline sliku u uploads direktorij:', err)
    return null
  }
}

function ensureResponsiveImgStyle(existingStyle?: string): string {
  let s = (existingStyle || '').trim()
  if (s && !s.endsWith(';')) s += ';'
  if (!/max-width\s*:/i.test(s)) s += ' max-width: 100%;'
  if (!/height\s*:/i.test(s)) s += ' height: auto;'
  return s.trim()
}

function escapeAttr(v: string): string {
  return v.replace(/&(?!amp;|quot;|lt;|gt;|#\d+;)/g, '&amp;').replace(/"/g, '&quot;')
}

function parseAttributes(attrsStr: string): Array<[string, string | null]> {
  const out: Array<[string, string | null]> = []
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(attrsStr)) !== null) {
    const val = m[2] ?? m[3] ?? m[4]
    out.push([m[1].toLowerCase(), val === undefined ? null : val])
  }
  return out
}

function buildImgTag(attrs: Array<[string, string | null]>): string {
  const parts = attrs.map(([k, v]) => (v === null ? k : `${k}="${escapeAttr(v)}"`))
  return `<img ${parts.join(' ')} />`
}

/**
 * Unwraps Gmail's image proxy URLs such as:
 * `https://ci3.googleusercontent.com/meips/ADKq_...#https://mail.google.com/mail/u/0?ui=2&...`
 */
export function unwrapGmailImageUrl(rawUrl: string): URL | null {
  try {
    const u = new URL(rawUrl)
    if (u.hash && /^#https?:\/\//i.test(u.hash)) {
      try {
        return new URL(u.hash.slice(1))
      } catch {}
    }
    return u
  } catch {
    return null
  }
}

export function isGmailOrGoogleHostedImageUrl(rawUrl: string): boolean {
  const u = unwrapGmailImageUrl(rawUrl)
  if (!u) return false
  if (/(^|\.)mail\.google\.com$/i.test(u.hostname)) return true
  if (/googleusercontent\.com$/i.test(u.hostname)) return true
  if (/ggpht\.com$/i.test(u.hostname)) return true
  return false
}

async function fetchRemoteImage(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    clearTimeout(timer)
    if (!res.ok) return null
    const ct = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (!ct.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0 || buf.length > 18 * 1024 * 1024) return null
    return { base64: buf.toString('base64'), mimeType: ct }
  } catch {
    return null
  }
}

async function extractImageFromGmailMessage(
  gmail: GmailLike,
  msgId: string,
  attid: string,
  hint: string
): Promise<{ base64: string; mimeType: string; filename: string } | null> {
  try {
    const msg = await gmail.users.messages.get({ userId: 'me', id: msgId, format: 'full' })
    const parts: any[] = []
    const walk = [msg?.data?.payload]
    while (walk.length) {
      const p = walk.shift()
      if (!p) continue
      parts.push(p)
      if (Array.isArray(p.parts)) walk.push(...p.parts)
    }

    const images = parts.filter((p) => {
      const mt = (p.mimeType || '').toLowerCase()
      const fn = (p.filename || '').toLowerCase()
      const looksLikeImg = mt.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(fn)
      return looksLikeImg && (p.body?.attachmentId || p.body?.data)
    })
    if (!images.length) return null

    const header = (p: any, n: string) =>
      ((p.headers || []).find((h: any) => h.name?.toLowerCase() === n)?.value || '').replace(/^<|>$/g, '').trim()

    const idx = /^0\.\d+$/.test(attid) ? Number(attid.split('.')[1]) - 1 : -1
    const cleanAttId = attid.replace(/^<|>$/g, '').trim()

    const pick =
      (cleanAttId
        ? images.find(
            (p) =>
              header(p, 'x-attachment-id') === cleanAttId ||
              header(p, 'content-id') === cleanAttId ||
              header(p, 'content-id').split('@')[0] === cleanAttId ||
              p.partId === cleanAttId
          )
        : undefined) ||
      (hint ? images.find((p) => normalizeImageName(p.filename || '') === normalizeImageName(hint)) : undefined) ||
      (idx >= 0 ? images[idx] : undefined) ||
      images[0]

    if (!pick) return null

    let b64: string | undefined = pick.body?.data
    if (!b64 && pick.body?.attachmentId) {
      const att = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId: msgId,
        id: pick.body.attachmentId,
      })
      b64 = att?.data?.data
    }
    if (!b64) return null

    const resolvedMime = (pick.mimeType || '').toLowerCase().startsWith('image/')
      ? pick.mimeType
      : inferImageMimeFromFilename(pick.filename || hint || 'uplatnica.png')

    return {
      base64: cleanBase64(b64),
      mimeType: resolvedMime,
      filename: pick.filename || hint || `uplatnica.${extFromMime(resolvedMime)}`,
    }
  } catch {
    return null
  }
}

/**
 * Resolves a Gmail-hosted image URL (from a template or draft) into raw base64 bytes.
 * Searches candidate message IDs, drafts, mailbox messages by filename, and system settings fallback.
 */
export async function resolveGmailHostedImage(
  rawUrl: string,
  gmail: GmailLike | undefined,
  hint: string,
  contextMessageId?: string
): Promise<{ base64: string; mimeType: string; filename: string } | null> {
  const u = unwrapGmailImageUrl(rawUrl)
  const attid = u ? u.searchParams.get('realattid') || u.searchParams.get('attid') || '' : ''

  if (gmail) {
    const candidates = new Set<string>()
    if (contextMessageId) candidates.add(contextMessageId)
    const th = u?.searchParams.get('th')
    if (th && /^[0-9a-f]+$/i.test(th)) candidates.add(th)
    const perm = u?.searchParams.get('permmsgid') || ''
    const permF = perm.match(/msg-f:(\d+)/)
    if (permF) {
      try {
        candidates.add(BigInt(permF[1]).toString(16))
      } catch {}
    }

    for (const id of candidates) {
      const found = await extractImageFromGmailMessage(gmail, id, attid, hint)
      if (found) return found
    }

    // Search drafts in mailbox (templates are stored as drafts)
    if (gmail.users.drafts?.list) {
      try {
        const draftsRes = await gmail.users.drafts.list({ userId: 'me', maxResults: 25 })
        for (const d of draftsRes?.data?.drafts || []) {
          const mId = d?.message?.id
          if (!mId || candidates.has(mId)) continue
          candidates.add(mId)
          const found = await extractImageFromGmailMessage(gmail, mId, attid, hint)
          if (found) return found
        }
      } catch {}
    }

    // Search mailbox messages with attachment matching hint
    if (gmail.users.messages.list && hint) {
      try {
        const baseHint = decodeSafe(hint)
          .replace(/\.[a-z0-9]{2,5}$/i, '')
          .replace(/\s*\(\d+\)\s*$/g, '')
          .trim()
        const q = baseHint ? `has:attachment "${baseHint}"` : 'has:attachment'
        const listRes = await gmail.users.messages.list({ userId: 'me', q, maxResults: 5 })
        for (const m of listRes?.data?.messages || []) {
          if (!m?.id || candidates.has(m.id)) continue
          candidates.add(m.id)
          const found = await extractImageFromGmailMessage(gmail, m.id, attid, hint)
          if (found) return found
        }
      } catch {}
    }
  }

  // Try direct fetch if it's a public googleusercontent URL
  const remote = await fetchRemoteImage(rawUrl)
  if (remote) {
    return {
      base64: remote.base64,
      mimeType: remote.mimeType,
      filename: hint || `uplatnica.${extFromMime(remote.mimeType)}`,
    }
  }

  // Fallback to settings.paymentSlipUrl if the image represents Uplatnica
  try {
    const normHint = normalizeImageName(hint || 'uplatnica')
    if (!hint || normHint.includes('uplatnic') || normHint.includes('slip') || normHint.includes('slika')) {
      const settings = DatabaseService.getSettings()
      if (settings?.paymentSlipUrl && settings.paymentSlipUrl.includes(',')) {
        const dm = settings.paymentSlipUrl.match(/^data:([^;,]+);base64,([\s\S]+)$/i)
        if (dm) {
          return {
            base64: cleanBase64(dm[2]),
            mimeType: dm[1].toLowerCase(),
            filename: 'uplatnica.png',
          }
        }
      }
    }
  } catch {}

  return null
}

/**
 * Extracts all inline images from HTML, saves them to `/uploads/`, replaces `<img src="...">`
 * with `src="cid:..."` (without angle brackets), and removes those images from regular `attachments`
 * so they never appear as duplicate paperclip files.
 */
export async function processHtmlImagesAndExtractInlineAttachments(
  html: string,
  rawAttachments: OutgoingAttachment[] = [],
  gmail?: GmailLike
): Promise<{
  processedHtml: string
  inlineAttachments: InlineMimeAttachment[]
  remainingAttachments: OutgoingAttachment[]
}> {
  const remainingAttachments: OutgoingAttachment[] = [...(rawAttachments || [])]
  const inlineAttachments: InlineMimeAttachment[] = []
  const byOriginalSrc = new Map<string, string>()

  const takeAttachment = (pred: (a: OutgoingAttachment) => boolean): OutgoingAttachment | null => {
    const i = remainingAttachments.findIndex(pred)
    return i >= 0 ? remainingAttachments.splice(i, 1)[0] : null
  }

  const addInline = (base64: string, mimeType: string, rawFilename: string, preferredCid?: string): string => {
    const cleanB64 = cleanBase64(base64)
    // Deduplicate identical image payload
    const existingByContent = inlineAttachments.find((a) => a.contentBase64 === cleanB64)
    if (existingByContent) return existingByContent.contentId

    const idx = inlineAttachments.length + 1
    // Clean CID: strip cid:, angle brackets, and @domain so Gmail API never mismatches X-Attachment-Id
    const cleanedPref = (preferredCid || '')
      .replace(/^cid:/i, '')
      .replace(/[<>]/g, '')
      .split('@')[0]
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .trim()

    const cid = cleanedPref || generateCid(idx)
    const resolvedMime = (mimeType || '').toLowerCase().startsWith('image/')
      ? mimeType
      : inferImageMimeFromFilename(rawFilename, 'image/png')
    const cleanName = sanitizeInlineFilename(rawFilename, resolvedMime, idx)
    const publicPath = saveInlineImageToPublicUploads(cleanB64, resolvedMime, cleanName) || undefined

    inlineAttachments.push({
      contentId: cid,
      filename: cleanName,
      mimeType: resolvedMime,
      contentBase64: cleanB64,
      publicPath,
    })

    // Also remove any duplicate from remainingAttachments that has the same content or normalized name
    for (let i = remainingAttachments.length - 1; i >= 0; i--) {
      const rem = remainingAttachments[i]
      if (
        cleanBase64(rem.contentBase64) === cleanB64 ||
        (rem.filename && normalizeImageName(rem.filename) === normalizeImageName(rawFilename))
      ) {
        remainingAttachments.splice(i, 1)
      }
    }

    return cid
  }

  let processedHtml = html || ''

  if (processedHtml.trim()) {
    const tagRe = /<img\b([^>]*?)\/?>/gi
    const tags: Array<{ full: string; attrs: string }> = []
    let m: RegExpExecArray | null
    while ((m = tagRe.exec(processedHtml)) !== null) {
      tags.push({ full: m[0], attrs: m[1] })
    }

    const replacements: Array<{ full: string; replacement: string }> = []

    for (const tag of tags) {
      const attrs = parseAttributes(tag.attrs)
      const get = (k: string) => attrs.find(([n]) => n === k)?.[1] ?? ''
      const set = (k: string, v: string) => {
        const i = attrs.findIndex(([n]) => n === k)
        if (i >= 0) attrs[i] = [k, v]
        else attrs.push([k, v])
      }

      const src = get('src').trim().replace(/&amp;/g, '&')
      if (!src) continue
      const hint = (get('data-filename') || get('alt') || get('title') || 'uplatnica.png').trim()

      let cid: string | null = null

      if (byOriginalSrc.has(src)) {
        cid = byOriginalSrc.get(src)!
      } else if (/^data:/i.test(src)) {
        const dm = src.match(/^data:([^;,]+);base64,([\s\S]+)$/i)
        if (dm) {
          const mime = dm[1].toLowerCase().startsWith('image/')
            ? dm[1].toLowerCase()
            : inferImageMimeFromFilename(hint, 'image/png')
          const b64 = cleanBase64(dm[2])
          const dup =
            takeAttachment((a) => cleanBase64(a.contentBase64) === b64) ||
            (hint ? takeAttachment((a) => normalizeImageName(a.filename) === normalizeImageName(hint)) : null)
          cid = addInline(b64, mime, dup?.filename || hint)
        }
      } else if (/^cid:/i.test(src)) {
        const ref = src.replace(/^cid:/i, '').replace(/[<>]/g, '').trim()
        const refShort = ref.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '_')
        const existing = inlineAttachments.find((a) => a.contentId === ref || a.contentId === refShort)
        if (existing) {
          cid = existing.contentId
        } else {
          const att =
            takeAttachment((a) => {
              const ac = (a.contentId || '').replace(/[<>]/g, '').trim()
              return ac === ref || ac.split('@')[0] === ref.split('@')[0]
            }) ||
            takeAttachment((a) => normalizeImageName(a.filename) === normalizeImageName(ref.split('@')[0])) ||
            (hint ? takeAttachment((a) => normalizeImageName(a.filename) === normalizeImageName(hint)) : null) ||
            takeAttachment((a) => (a.mimeType || '').toLowerCase().startsWith('image/'))
          if (att) {
            cid = addInline(att.contentBase64, att.mimeType, att.filename || hint, refShort)
          } else {
            const resolved = await resolveGmailHostedImage(src, gmail, hint)
            if (resolved) {
              cid = addInline(resolved.base64, resolved.mimeType, resolved.filename, refShort)
            }
          }
        }
      } else if (/\/api\/gmail\b/i.test(src) && /action=attachment/i.test(src)) {
        try {
          const u = new URL(src, 'http://localhost')
          const messageId = u.searchParams.get('messageId')
          const attachmentId = u.searchParams.get('attachmentId')
          const mime = u.searchParams.get('mimeType') || 'image/png'
          const fname = u.searchParams.get('filename') || hint
          const dup = takeAttachment((a) => normalizeImageName(a.filename) === normalizeImageName(fname))
          let b64 = dup?.contentBase64 || ''
          if (!b64 && gmail && messageId && attachmentId) {
            const r = await gmail.users.messages.attachments.get({ userId: 'me', messageId, id: attachmentId })
            b64 = r?.data?.data || ''
          }
          if (b64) cid = addInline(b64, mime, fname)
        } catch (err) {
          console.error('[MIME] Greška pri dohvaćanju privitka za inline sliku:', err)
        }
      } else if (/\/(?:api\/)?uploads\/([^?#]+)/i.test(src)) {
        const mUp = src.match(/\/(?:api\/)?uploads\/([^?#]+)/i)
        const fname = decodeSafe(mUp?.[1] || '')
        const uploadDir = process.env.UPLOAD_FOLDER || path.join(process.cwd(), 'data', 'uploads')
        const filePath = path.join(uploadDir, path.basename(fname))
        if (fname && fs.existsSync(filePath)) {
          const buf = fs.readFileSync(filePath)
          const mime = inferImageMimeFromFilename(fname, 'image/png')
          cid = addInline(buf.toString('base64'), mime, fname)
        }
      } else if (/^https?:\/\//i.test(src)) {
        if (isGmailOrGoogleHostedImageUrl(src)) {
          let resolved = await resolveGmailHostedImage(src, gmail, hint)
          if (!resolved && hint) {
            const att =
              takeAttachment((a) => normalizeImageName(a.filename) === normalizeImageName(hint)) ||
              takeAttachment((a) => (a.mimeType || '').toLowerCase().startsWith('image/'))
            if (att) {
              resolved = { base64: att.contentBase64, mimeType: att.mimeType, filename: att.filename }
            }
          }
          if (resolved) {
            cid = addInline(resolved.base64, resolved.mimeType, resolved.filename || hint)
          }
        } else {
          // Check if user attached an image matching this tag's filename/alt
          const base = decodeSafe(src.split(/[?#]/)[0].split(/[\\/]/).pop() || '')
          const att =
            (base ? takeAttachment((a) => normalizeImageName(a.filename) === normalizeImageName(base)) : null) ||
            (hint ? takeAttachment((a) => normalizeImageName(a.filename) === normalizeImageName(hint)) : null)
          if (att) {
            cid = addInline(att.contentBase64, att.mimeType, att.filename)
          }
        }
      } else {
        // Relative path or filename reference
        const base = decodeSafe(src.split(/[?#]/)[0].split(/[\\/]/).pop() || '')
        const att =
          (base ? takeAttachment((a) => normalizeImageName(a.filename) === normalizeImageName(base)) : null) ||
          (hint ? takeAttachment((a) => normalizeImageName(a.filename) === normalizeImageName(hint)) : null) ||
          takeAttachment((a) => (a.mimeType || '').toLowerCase().startsWith('image/'))
        if (att) {
          cid = addInline(att.contentBase64, att.mimeType, att.filename, att.contentId)
        }
      }

      if (cid) {
        byOriginalSrc.set(src, cid)
        set('src', `cid:${cid}`)
        set('alt', get('alt') ? get('alt').replace(/\s*\(\d+\)\s*/g, '').replace(/\.[a-z0-9]{2,5}$/i, '') : 'Uplatnica')
        set('style', ensureResponsiveImgStyle(get('style')))
        for (const k of ['data-filename', 'data-name', ' data-surl']) {
          const i = attrs.findIndex(([n]) => n === k.trim())
          if (i >= 0) attrs.splice(i, 1)
        }
        replacements.push({ full: tag.full, replacement: buildImgTag(attrs) })
      }
    }

    for (const r of replacements) {
      processedHtml = processedHtml.split(r.full).join(r.replacement)
    }
  }

  // Any remaining attachments explicitly flagged as inline or carrying contentId:
  for (let i = remainingAttachments.length - 1; i >= 0; i--) {
    const a = remainingAttachments[i]
    if (a.isInline || a.contentId) {
      remainingAttachments.splice(i, 1)
      const cid = addInline(a.contentBase64, a.mimeType, a.filename, a.contentId)
      if (!processedHtml.includes(`cid:${cid}`)) {
        processedHtml += `<div style="margin-top:16px;"><img src="cid:${cid}" alt="Uplatnica" style="max-width: 100%; height: auto;" /></div>`
      }
    }
  }

  return { processedHtml, inlineAttachments, remainingAttachments }
}

async function streamToBuffer(stream: NodeJS.ReadableStream | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(stream)) return stream
  const chunks: Buffer[] = []
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', (err) => reject(err))
  })
}

/**
 * Compiles a raw RFC 2822 message using Nodemailer's `streamTransport` (with `newline: 'windows'`)
 * and encodes it as URL-safe base64 for `gmail.users.messages.send`.
 */
export async function buildRawMimeMessage(params: {
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
}): Promise<string> {
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

  const mailComposer = nodemailer.createTransport({
    streamTransport: true,
    newline: 'windows', // osigurava ispravne CRLF separatore
  })

  const finalHtml =
    htmlBody ??
    `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1e293b;">${(textBody || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>')}</div>`

  const nodemailerAttachments: nodemailer.SendMailOptions['attachments'] = [
    ...inlineAttachments.map((img, idx) => ({
      filename: sanitizeInlineFilename(img.filename, img.mimeType, idx + 1),
      content: Buffer.from(cleanBase64(img.contentBase64), 'base64'),
      contentType: img.mimeType || 'image/png',
      cid: img.contentId.replace(/^cid:/i, '').replace(/[<>]/g, '').trim(),
      contentDisposition: 'inline' as const,
    })),
    ...attachments.map((att) => ({
      filename: att.filename || 'dokument',
      content: Buffer.from(cleanBase64(att.contentBase64), 'base64'),
      contentType: att.mimeType || 'application/octet-stream',
      contentDisposition: 'attachment' as const,
    })),
  ]

  const formattedFrom = fromDisplayName
    ? `"${fromDisplayName.replace(/"/g, '')}" <${from}>`
    : from

  const mailOptions: nodemailer.SendMailOptions = {
    from: formattedFrom,
    to: to?.trim() || undefined,
    cc: cc?.trim() || undefined,
    bcc: bcc?.trim() || undefined,
    subject: subject || '(bez naslova)',
    text: textBody || undefined,
    html: finalHtml,
    inReplyTo: inReplyTo || undefined,
    references: references || undefined,
    attachments: nodemailerAttachments.length > 0 ? nodemailerAttachments : undefined,
  }

  const info = await mailComposer.sendMail(mailOptions)
  const rawMessage = await streamToBuffer(info.message)

  // Kodiraj u URL-safe base64 za Gmail API
  const encodedMessage = rawMessage
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return encodedMessage
}
