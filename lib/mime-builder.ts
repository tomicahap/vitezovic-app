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
export function generateCid(index = 1, prefix = 'inline_img'): string {
  const rand = Math.random().toString(36).substring(2, 8)
  return `${prefix}_${index}_${rand}`
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
 * Reads PNG or JPEG width/height from base64 data if valid headers are present.
 */
export function getImageDimensionsFromBase64(b64: string): { width: number; height: number } | null {
  try {
    const clean = cleanBase64(b64)
    if (clean.length < 36) return null
    // Read up to first 8KB to find PNG or JPEG dimensions
    const buf = Buffer.from(clean.slice(0, 8192), 'base64')
    if (buf.length < 24) return null

    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      const width = buf.readUInt32BE(16)
      const height = buf.readUInt32BE(20)
      if (width > 0 && height > 0) return { width, height }
    }

    // JPEG magic bytes: FF D8
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let offset = 2
      while (offset < buf.length - 8) {
        if (buf[offset] !== 0xff) {
          offset++
          continue
        }
        const marker = buf[offset + 1]
        // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          const height = buf.readUInt16BE(offset + 5)
          const width = buf.readUInt16BE(offset + 7)
          if (width > 0 && height > 0) return { width, height }
          break
        }
        if (offset + 4 > buf.length) break
        const len = buf.readUInt16BE(offset + 2)
        if (len <= 0) break
        offset += 2 + len
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Backwards compatible alias for getPngDimensionsFromBase64
 */
function getPngDimensionsFromBase64(b64: string): { width: number; height: number } | null {
  return getImageDimensionsFromBase64(b64)
}

/**
 * Checks if an image looks like a wide HUB-3A barcode or payment slip rather than the square society logo.
 * Accepts base64 data and/or a filename / tag / attribute hint.
 */
export function looksLikeBarcodeOrSlipInsteadOfLogo(b64: string, filenameOrTagHint = ''): boolean {
  const lower = (filenameOrTagHint || '').toLowerCase()
  if (
    lower.includes('barkod') ||
    lower.includes('barcode') ||
    lower.includes('uplatnic') ||
    lower.includes('uplat') ||
    lower.includes('slip') ||
    lower.includes('hub') ||
    lower.includes('hub3') ||
    lower.includes('hub-3') ||
    lower.includes('2d') ||
    lower.includes('qr') ||
    lower.includes('iban') ||
    lower.includes('platni') ||
    lower.includes('racun') ||
    lower.includes('nalog') ||
    lower.includes('poziv')
  ) {
    return true
  }

  // Check HTML width / height attributes (e.g. width="350" height="184" or width="1749" height="996")
  const wMatch = lower.match(/\bwidth=["']?(\d+)/)
  const hMatch = lower.match(/\bheight=["']?(\d+)/)
  if (wMatch && hMatch) {
    const w = parseInt(wMatch[1], 10)
    const h = parseInt(hMatch[1], 10)
    if (w > 0 && h > 0 && w > h * 1.25) {
      return true
    }
  }

  // Check style width/height (e.g. style="width: 350px; height: 184px")
  const styleWMatch = lower.match(/\bwidth\s*:\s*(\d+)px/)
  const styleHMatch = lower.match(/\bheight\s*:\s*(\d+)px/)
  if (styleWMatch && styleHMatch) {
    const w = parseInt(styleWMatch[1], 10)
    const h = parseInt(styleHMatch[1], 10)
    if (w > 0 && h > 0 && w > h * 1.25) {
      return true
    }
  }

  // Check actual image dimensions if base64 data is present
  if (b64) {
    const dims = getImageDimensionsFromBase64(b64)
    if (dims && dims.width > dims.height * 1.25) {
      return true
    }
  }

  return false
}

/**
 * Returns the official society logo (`settings.logoUrl`) from the database if configured.
 */
export function getSocietyLogoFromSettings(): { base64: string; mimeType: string; dataUrl: string } | null {
  try {
    const settings = DatabaseService.getSettings()
    const raw = (settings?.logoUrl || '').trim()
    if (!raw) return null
    const dm = raw.match(/^data:([^;,]+);base64,([\s\S]+)$/i)
    if (dm) {
      const mimeType = dm[1].toLowerCase()
      const base64 = cleanBase64(dm[2])
      return { base64, mimeType, dataUrl: `data:${mimeType};base64,${base64}` }
    }
  } catch {}
  return null
}

/**
 * Detects whether an `<img>` tag at `tagOffset` inside `html` is genuinely located in the
 * email signature (e.g. inside an unclosed `.gmail_signature` or right below the trailing
 * "S poštovanjem, Hrvatsko rodoslovno društvo...").
 */
export function isImgInSignatureContext(html: string, tagOffset: number, imgTag?: string): boolean {
  // If the image itself is recognized as a payment slip or barcode, it can NEVER be a signature logo!
  if (imgTag && looksLikeBarcodeOrSlipInsteadOfLogo('', imgTag)) {
    return false
  }

  const before = html.slice(0, tagOffset)

  // 1. Check if inside an unclosed .gmail_signature container
  const sigMatches = Array.from(
    before.matchAll(/<(?:div|span|p|section)\b[^>]*(?:class=["'][^"']*gmail_signature|data-smartmail=["']gmail_signature)[^>]*>/gi)
  )
  if (sigMatches.length > 0) {
    const lastSig = sigMatches[sigMatches.length - 1]
    const lastSigIndex = lastSig.index ?? 0
    const textInside = before.slice(lastSigIndex)
    const tagNameMatch = lastSig[0].match(/^<([a-z0-9]+)/i)
    const tagName = tagNameMatch ? tagNameMatch[1].toLowerCase() : 'div'
    const openTags = (textInside.match(new RegExp(`<${tagName}\\b`, 'gi')) || []).length
    const closeTags = (textInside.match(new RegExp(`</${tagName}>`, 'gi')) || []).length
    if (openTags > closeTags) {
      // The <img> is genuinely enclosed inside the active signature block
      return true
    }
  }

  // 2. Strict closing sign-off check:
  // Must be immediately preceded by a formal closing sign-off (e.g. "S poštovanjem," or "Srdačan pozdrav,")
  // and society or officer name, with NO intervening text paragraphs.
  const plainBefore = before
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const tail = plainBefore.slice(-140)
  const isClosingSignOff =
    /(?:S\s+poštovanjem|Srdačan\s+pozdrav|Lijep\s+pozdrav|S\s+stovanjem|Srdacan\s+pozdrav)[^.!?]{0,90}(?:Pavao\s+Ritter|Hrvatsko\s+rodoslovno|Rodoslovlje|Upravni\s+odbor|Predsjednik|Tajnik|Blagajnik)/i.test(
      tail
    )

  if (isClosingSignOff) {
    // In an email signature, the logo is placed at the very end of the message.
    // If there is significant body text after the image (more than 200 chars), it's in the body, not signature.
    const after = html.slice(tagOffset)
    const plainAfter = after
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (plainAfter.length > 250) {
      return false
    }
    return true
  }

  return false
}

/**
 * Produces a clean RFC-safe inline filename without parentheses `(1)` or spaces.
 */
function sanitizeInlineFilename(rawName: string, mimeType: string, index: number): string {
  const ext = extFromMime(mimeType)
  const stripped = decodeSafe(rawName || '')
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/\s*\(\d+\)\s*$/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
  const base = stripped || `slika_${index}`
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
      decodeSafe(rawFilename || 'slika')
        .replace(/\.[a-z0-9]{2,5}$/i, '')
        .replace(/\s*\(\d+\)\s*$/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'slika'

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

/**
 * Checks whether a URL is a private Gmail message/draft attachment URL
 * (e.g. `mail.google.com/...?view=fimg&attid=0.1...`).
 * Never matches public Gmail signature images (`/mail-sig/...` or `lh3.googleusercontent.com`).
 */
export function isGmailOrGoogleHostedImageUrl(rawUrl: string): boolean {
  try {
    const outer = new URL(rawUrl)
    if (outer.pathname.includes('/mail-sig/')) return false
  } catch {
    return false
  }

  const u = unwrapGmailImageUrl(rawUrl)
  if (!u) return false
  if (u.pathname.includes('/mail-sig/')) return false

  const hasAttParams =
    u.searchParams.has('attid') ||
    u.searchParams.has('realattid') ||
    u.searchParams.get('view') === 'fimg' ||
    u.searchParams.get('disp') === 'emb'

  if (/(^|\.)mail\.google\.com$/i.test(u.hostname)) {
    return hasAttParams
  }
  if (/googleusercontent\.com$/i.test(u.hostname)) {
    return hasAttParams || u.pathname.includes('/mail-img-att/') || u.pathname.includes('/mail-attachment/')
  }
  return false
}

async function extractImageFromGmailMessage(
  gmail: GmailLike,
  msgId: string,
  attid: string,
  hint: string,
  allowPositionalIdx: boolean
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

    const isPositional = /^0\.\d+$/.test(attid)
    const idx = allowPositionalIdx && isPositional ? Number(attid.split('.')[1]) - 1 : -1
    const cleanAttId = isPositional ? '' : attid.replace(/^<|>$/g, '').trim()

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
      (idx >= 0 ? images[idx] : undefined)

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
      : inferImageMimeFromFilename(pick.filename || hint || 'slika.png')

    return {
      base64: cleanBase64(b64),
      mimeType: resolvedMime,
      filename: pick.filename || hint || `slika.${extFromMime(resolvedMime)}`,
    }
  } catch {
    return null
  }
}

/**
 * Resolves a Gmail-hosted attachment image URL (from a template or draft) into raw base64 bytes.
 * Checks the URL's own `th` / `permmsgid` message ID FIRST before `contextMessageId`.
 * Never uses positional `attid=0.1` across unrelated drafts!
 */
export async function resolveGmailHostedImage(
  rawUrl: string,
  gmail: GmailLike | undefined,
  hint: string,
  contextMessageId?: string
): Promise<{ base64: string; mimeType: string; filename: string } | null> {
  if (!isGmailOrGoogleHostedImageUrl(rawUrl)) return null
  const u = unwrapGmailImageUrl(rawUrl)
  const realAttId = u?.searchParams.get('realattid') || ''
  const attid = realAttId || u?.searchParams.get('attid') || ''

  if (gmail) {
    // 1. Check the exact message IDs embedded in the image URL itself (`th` / `permmsgid`) FIRST!
    const urlMessageIds: string[] = []
    const th = u?.searchParams.get('th')
    if (th && /^[0-9a-f]+$/i.test(th)) urlMessageIds.push(th)
    const perm = u?.searchParams.get('permmsgid') || ''
    const permF = perm.match(/msg-f:(\d+)/)
    if (permF) {
      try {
        const hexId = BigInt(permF[1]).toString(16)
        if (!urlMessageIds.includes(hexId)) urlMessageIds.push(hexId)
      } catch {}
    }

    for (const id of urlMessageIds) {
      const found = await extractImageFromGmailMessage(gmail, id, attid, hint, true)
      if (found) return found
    }

    // 2. If the URL had no `th` of its own, check `contextMessageId`
    if (contextMessageId && !urlMessageIds.includes(contextMessageId)) {
      const found = await extractImageFromGmailMessage(gmail, contextMessageId, attid, hint, urlMessageIds.length === 0)
      if (found) return found
    }

    // 3. Only search other drafts if we have a globally unique `realattid` (like `ii_...`) or explicit filename `hint`
    // NEVER match by positional `0.1` across other drafts!
    if ((realAttId && !/^0\.\d+$/.test(realAttId)) || hint) {
      if (gmail.users.drafts?.list) {
        try {
          const seen = new Set<string>([...urlMessageIds, ...(contextMessageId ? [contextMessageId] : [])])
          const draftsRes = await gmail.users.drafts.list({ userId: 'me', maxResults: 20 })
          for (const d of draftsRes?.data?.drafts || []) {
            const mId = d?.message?.id
            if (!mId || seen.has(mId)) continue
            seen.add(mId)
            const found = await extractImageFromGmailMessage(gmail, mId, realAttId, hint, false)
            if (found) return found
          }
        } catch {}
      }
    }
  }

  return null
}

/**
 * Extracts inline images from HTML, saves them to `/uploads/`, replaces `<img src="...">`
 * with `src="cid:..."` (without angle brackets), and removes those images from regular `attachments`
 * so they never appear as duplicate paperclip files.
 * Ensures the image in the signature below "S poštovanjem, Hrvatsko rodoslovno društvo..."
 * is always the genuine society logo (`settings.logoUrl`) and never a barcode.
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
  const societyLogo = getSocietyLogoFromSettings()

  const takeAttachment = (pred: (a: OutgoingAttachment) => boolean): OutgoingAttachment | null => {
    const i = remainingAttachments.findIndex(pred)
    return i >= 0 ? remainingAttachments.splice(i, 1)[0] : null
  }

  const addInline = (
    base64: string,
    mimeType: string,
    rawFilename: string,
    preferredCid?: string,
    cidPrefix = 'inline_img'
  ): string => {
    const cleanB64 = cleanBase64(base64)
    const existingByContent = inlineAttachments.find((a) => a.contentBase64 === cleanB64)
    if (existingByContent) return existingByContent.contentId

    const idx = inlineAttachments.length + 1
    const cleanedPref = (preferredCid || '')
      .replace(/^cid:/i, '')
      .replace(/[<>]/g, '')
      .split('@')[0]
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .trim()

    const cid = cleanedPref || generateCid(idx, cidPrefix)
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

    for (let i = remainingAttachments.length - 1; i >= 0; i--) {
      const rem = remainingAttachments[i]
      if (
        cleanBase64(rem.contentBase64) === cleanB64 ||
        (rawFilename && rem.filename && normalizeImageName(rem.filename) === normalizeImageName(rawFilename))
      ) {
        remainingAttachments.splice(i, 1)
      }
    }

    return cid
  }

  let processedHtml = html || ''

  if (processedHtml.trim()) {
    const tagRe = /<img\b([^>]*?)\/?>/gi
    const tags: Array<{ full: string; attrs: string; index: number }> = []
    let m: RegExpExecArray | null
    while ((m = tagRe.exec(processedHtml)) !== null) {
      tags.push({ full: m[0], attrs: m[1], index: m.index })
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
      const hint = (get('data-filename') || get('alt') || get('title') || '').trim()

      const isDataUrl = /^data:image\//i.test(src)
      const b64Data = isDataUrl ? cleanBase64(src.split(',')[1] || '') : ''

      const isBarcodeOrSlip = looksLikeBarcodeOrSlipInsteadOfLogo(
        b64Data,
        `${hint} ${get('alt')} ${get('data-filename')} ${tag.full} ${src}`
      )

      const inSignature = !isBarcodeOrSlip && isImgInSignatureContext(processedHtml, tag.index, tag.full)

      let cid: string | null = null

      // If this <img> is genuinely in the signature (below "S poštovanjem, Hrvatsko rodoslovno društvo...")
      // and NOT a barcode or payment slip, ensure it uses the official society logo
      if (inSignature && societyLogo && !isBarcodeOrSlip) {
        if (/^data:/i.test(src)) {
          const dm = src.match(/^data:([^;,]+);base64,([\s\S]+)$/i)
          if (dm) {
            cid = addInline(societyLogo.base64, societyLogo.mimeType, 'logo_drustva.png', undefined, 'logo_drustva')
            set('alt', 'Logo društva')
          }
        } else if (isGmailOrGoogleHostedImageUrl(src) || /^cid:/i.test(src)) {
          // Gmail internal signature image URL -> use official society logo so it never pulls a barcode from drafts
          cid = addInline(societyLogo.base64, societyLogo.mimeType, 'logo_drustva.png', undefined, 'logo_drustva')
          if (!get('alt')) set('alt', 'Logo društva')
        }
      }

      if (!cid) {
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
            const chosenFilename =
              dup?.filename ||
              (isBarcodeOrSlip
                ? hint && !hint.toLowerCase().includes('logo')
                  ? hint
                  : 'uplatnica.png'
                : hint) ||
              `slika_${inlineAttachments.length + 1}.png`
            cid = addInline(b64, mime, chosenFilename)
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
              (hint ? takeAttachment((a) => normalizeImageName(a.filename) === normalizeImageName(hint)) : null)
            if (att) {
              cid = addInline(att.contentBase64, att.mimeType, att.filename || hint, refShort)
            }
          }
        } else if (/\/api\/gmail\b/i.test(src) && /action=attachment/i.test(src)) {
          try {
            const u = new URL(src, 'http://localhost')
            const messageId = u.searchParams.get('messageId')
            const attachmentId = u.searchParams.get('attachmentId')
            const mime = u.searchParams.get('mimeType') || 'image/png'
            const fname = u.searchParams.get('filename') || hint || 'slika.png'
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
              const att = takeAttachment((a) => normalizeImageName(a.filename) === normalizeImageName(hint))
              if (att) {
                resolved = { base64: att.contentBase64, mimeType: att.mimeType, filename: att.filename }
              }
            }
            if (resolved) {
              cid = addInline(resolved.base64, resolved.mimeType, resolved.filename || hint || 'slika.png')
            }
          }
        } else {
          const base = decodeSafe(src.split(/[?#]/)[0].split(/[\\/]/).pop() || '')
          const att =
            (base ? takeAttachment((a) => normalizeImageName(a.filename) === normalizeImageName(base)) : null) ||
            (hint ? takeAttachment((a) => normalizeImageName(a.filename) === normalizeImageName(hint)) : null)
          if (att) {
            cid = addInline(att.contentBase64, att.mimeType, att.filename, att.contentId)
          }
        }
      }

      if (cid) {
        if (!inSignature) {
          byOriginalSrc.set(src, cid)
        }
        set('src', `cid:${cid}`)
        if (get('alt')) {
          set('alt', get('alt').replace(/\s*\(\d+\)\s*/g, '').replace(/\.[a-z0-9]{2,5}$/i, ''))
        }
        set('style', ensureResponsiveImgStyle(get('style')))
        for (const k of ['data-filename', 'data-name', 'data-surl']) {
          const i = attrs.findIndex(([n]) => n === k)
          if (i >= 0) attrs.splice(i, 1)
        }
        replacements.push({ full: tag.full, replacement: buildImgTag(attrs) })
      }
    }

    for (const r of replacements) {
      processedHtml = processedHtml.replace(r.full, r.replacement)
    }
  }

  // Any remaining attachments explicitly flagged as inline or carrying contentId:
  for (let i = remainingAttachments.length - 1; i >= 0; i--) {
    const a = remainingAttachments[i]
    if (a.isInline || a.contentId) {
      remainingAttachments.splice(i, 1)
      addInline(a.contentBase64, a.mimeType, a.filename, a.contentId)
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
