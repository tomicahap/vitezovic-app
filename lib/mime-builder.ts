/**
 * RFC 2045 / 2046 / 2387 compliant MIME builder for outgoing e-mails.
 *
 * Guarantees:
 *  - Every image displayed in the HTML body is sent as an inline part inside
 *    `multipart/related` and referenced from HTML as `src="cid:<id>"` (WITHOUT
 *    angle brackets), while the MIME header is `Content-ID: <id>` (WITH brackets).
 *  - Regular downloadable files go to an outer `multipart/mixed` as
 *    `Content-Disposition: attachment`.
 *  - All base64 payloads are wrapped at 76 characters with CRLF.
 *  - CRLF line endings are used everywhere.
 */

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

const CRLF = '\r\n'
const CID_DOMAIN = 'rodoslovlje.hr'

/** Unique Content-ID (no angle brackets). */
export function generateCid(): string {
  return `inline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}@${CID_DOMAIN}`
}

/** Strips data-URL prefix/whitespace and wraps base64 at 76 chars per line (RFC 2045). */
export function formatBase64(data: string): string {
  const clean = (data || '')
    .replace(/^data:[^;,]+;base64,/i, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/[\r\n\s]+/g, '')
  if (!clean) return ''
  return clean.replace(/(.{76})/g, `$1${CRLF}`).replace(/\r\n$/, '')
}

function cleanBase64(data: string): string {
  return (data || '')
    .replace(/^data:[^;,]+;base64,/i, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/[\r\n\s]+/g, '')
}

function encodeHeaderWord(text: string): string {
  if (!text) return ''
  if (/[^\x20-\x7E]/.test(text)) {
    return `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`
  }
  return text
}

function safeFilename(name: string, fallback: string): string {
  const n = (name || '').replace(/["\\\r\n]/g, '').trim()
  return n || fallback
}

/** `name="..."` / `filename="..."` parameter value (ASCII or RFC 2047 encoded word). */
function fileParam(name: string): string {
  return encodeHeaderWord(name)
}

function extFromMime(mime: string): string {
  const sub = (mime.split('/')[1] || 'png').split('+')[0].toLowerCase()
  return sub === 'jpeg' ? 'jpg' : sub
}

function normalizeName(s: string): string {
  return decodeSafe(s)
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/, '')
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim()
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
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

export interface GmailLike {
  users: {
    messages: {
      get: (params: any) => Promise<any>
      attachments: { get: (params: any) => Promise<any> }
    }
  }
}

/** Fetches a public remote image server-side (only if it really is an image). */
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
    if (buf.length === 0 || buf.length > 15 * 1024 * 1024) return null
    return { base64: buf.toString('base64'), mimeType: ct }
  } catch {
    return null
  }
}

/**
 * Resolves a Gmail-hosted image URL (mail.google.com ...&attid=0.1&th=...&view=fimg)
 * — which only renders for the logged-in sender — into actual bytes via the Gmail API.
 */
async function resolveGmailHostedImage(
  urlObj: URL,
  gmail: GmailLike | undefined,
  hint: string
): Promise<{ base64: string; mimeType: string; filename: string } | null> {
  if (!gmail) return null
  const attid = urlObj.searchParams.get('realattid') || urlObj.searchParams.get('attid') || ''
  const candidates: string[] = []
  const th = urlObj.searchParams.get('th')
  if (th && /^[0-9a-f]+$/i.test(th)) candidates.push(th)
  const perm = urlObj.searchParams.get('permmsgid') || ''
  const permF = perm.match(/msg-f:(\d+)/)
  if (permF) {
    try {
      candidates.push(BigInt(permF[1]).toString(16))
    } catch {}
  }

  for (const id of candidates) {
    try {
      const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' })
      const parts: any[] = []
      const walk = [msg?.data?.payload]
      while (walk.length) {
        const p = walk.shift()
        if (!p) continue
        parts.push(p)
        if (Array.isArray(p.parts)) walk.push(...p.parts)
      }
      const images = parts.filter(
        (p) => (p.mimeType || '').toLowerCase().startsWith('image/') && (p.body?.attachmentId || p.body?.data)
      )
      if (!images.length) continue

      const header = (p: any, n: string) =>
        (p.headers || []).find((h: any) => h.name?.toLowerCase() === n)?.value || ''
      const idx = attid.match(/^0\.(\d+)$/) ? Number(attid.split('.')[1]) - 1 : -1
      const pick =
        images.find((p) => header(p, 'x-attachment-id') === attid) ||
        images.find((p) => header(p, 'content-id').replace(/[<>]/g, '') === attid) ||
        images.find((p) => p.partId === attid) ||
        (hint ? images.find((p) => normalizeName(p.filename || '') === normalizeName(hint)) : undefined) ||
        (idx >= 0 ? images[idx] : undefined) ||
        images[0]

      let b64: string | undefined = pick.body?.data
      if (!b64 && pick.body?.attachmentId) {
        const att = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId: id,
          id: pick.body.attachmentId,
        })
        b64 = att?.data?.data
      }
      if (b64) {
        return {
          base64: cleanBase64(b64),
          mimeType: pick.mimeType || 'image/png',
          filename: pick.filename || hint || `slika.${extFromMime(pick.mimeType || 'image/png')}`,
        }
      }
    } catch {
      // try next candidate
    }
  }
  return null
}

/**
 * Converts every image in the HTML body into an inline CID resource and removes
 * matched images from the regular attachment list.
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
  const byOriginalSrc = new Map<string, string>() // dedupe identical images

  const takeAttachment = (pred: (a: OutgoingAttachment) => boolean): OutgoingAttachment | null => {
    const i = remainingAttachments.findIndex(pred)
    return i >= 0 ? remainingAttachments.splice(i, 1)[0] : null
  }

  const addInline = (base64: string, mimeType: string, filename: string, preferredCid?: string): string => {
    const cid = (preferredCid || '').replace(/^cid:/i, '').replace(/[<>]/g, '').trim() || generateCid()
    if (!inlineAttachments.some((a) => a.contentId === cid)) {
      inlineAttachments.push({
        contentId: cid,
        filename: safeFilename(filename, `slika.${extFromMime(mimeType)}`),
        mimeType: mimeType || 'image/png',
        contentBase64: cleanBase64(base64),
      })
    }
    return cid
  }

  let processedHtml = html || ''

  if (processedHtml.trim()) {
    const tagRe = /<img\b([^>]*?)\/?>/gi
    const tags: Array<{ full: string; attrs: string }> = []
    let m: RegExpExecArray | null
    while ((m = tagRe.exec(processedHtml)) !== null) tags.push({ full: m[0], attrs: m[1] })

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
      const hint = (get('data-filename') || get('alt') || get('title')).trim()

      let cid: string | null = null

      if (byOriginalSrc.has(src)) {
        cid = byOriginalSrc.get(src)!
      } else if (/^cid:/i.test(src)) {
        // Already a CID reference — make sure a matching inline part exists.
        const ref = src.replace(/^cid:/i, '').replace(/[<>]/g, '').trim()
        const existing = inlineAttachments.find((a) => a.contentId === ref)
        if (existing) {
          cid = ref
        } else {
          const att =
            takeAttachment((a) => (a.contentId || '').replace(/[<>]/g, '') === ref) ||
            takeAttachment((a) => normalizeName(a.filename) === normalizeName(ref.split('@')[0])) ||
            (hint ? takeAttachment((a) => normalizeName(a.filename) === normalizeName(hint)) : null)
          if (att) cid = addInline(att.contentBase64, att.mimeType, att.filename, ref)
        }
      } else if (/^data:image\//i.test(src)) {
        const dm = src.match(/^data:([^;,]+);base64,([\s\S]+)$/i)
        if (dm) {
          const mime = dm[1].toLowerCase()
          const b64 = cleanBase64(dm[2])
          // Same file also attached manually? Drop the duplicate download copy.
          const dup =
            takeAttachment((a) => cleanBase64(a.contentBase64) === b64) ||
            (hint ? takeAttachment((a) => a.mimeType?.startsWith('image/') && normalizeName(a.filename) === normalizeName(hint)) : null)
          const filename = dup?.filename || (hint && /\.[a-z0-9]{2,5}$/i.test(hint) ? hint : `${hint || 'Uplatnica'}.${extFromMime(mime)}`)
          cid = addInline(b64, mime, filename)
        }
      } else if (/\/api\/gmail\b/.test(src) && /action=attachment/.test(src)) {
        try {
          const u = new URL(src, 'http://localhost')
          const messageId = u.searchParams.get('messageId')
          const attachmentId = u.searchParams.get('attachmentId')
          const mime = u.searchParams.get('mimeType') || 'image/png'
          const fname = u.searchParams.get('filename') || hint || `slika.${extFromMime(mime)}`
          const dup = takeAttachment((a) => a.filename.toLowerCase() === fname.toLowerCase())
          let b64 = dup?.contentBase64 || ''
          if (!b64 && gmail && messageId && attachmentId) {
            const r = await gmail.users.messages.attachments.get({ userId: 'me', messageId, id: attachmentId })
            b64 = r?.data?.data || ''
          }
          if (b64) cid = addInline(b64, mime, fname)
        } catch (err) {
          console.error('[MIME] Greška pri dohvaćanju privitka za inline sliku:', err)
        }
      } else if (/^https?:\/\//i.test(src)) {
        let u: URL | null = null
        try {
          u = new URL(src)
        } catch {}
        if (u) {
          const isGmailHosted =
            /(^|\.)mail\.google\.com$/i.test(u.hostname) ||
            (/googleusercontent\.com$/i.test(u.hostname) && (u.searchParams.has('attid') || u.pathname.includes('/mail-')))
          let resolved: { base64: string; mimeType: string; filename?: string } | null = null
          if (isGmailHosted) resolved = await resolveGmailHostedImage(u, gmail, hint)
          if (!resolved && isGmailHosted && hint) {
            const att = takeAttachment((a) => a.mimeType?.startsWith('image/') && normalizeName(a.filename) === normalizeName(hint))
            if (att) resolved = { base64: att.contentBase64, mimeType: att.mimeType, filename: att.filename }
          }
          if (!resolved && isGmailHosted) {
            // Last resort: a public fetch (works for public googleusercontent links).
            resolved = await fetchRemoteImage(src)
          }
          if (resolved) {
            const fname =
              resolved.filename || (hint && /\.[a-z0-9]{2,5}$/i.test(hint) ? hint : `${hint || 'slika'}.${extFromMime(resolved.mimeType)}`)
            cid = addInline(resolved.base64, resolved.mimeType, fname)
          }
          // Other public http(s) images (logos etc.) are left as remote links.
        }
      } else {
        // Relative path / bare filename (e.g. "Uplatnica.png", "/api/uploads/x.png")
        const base = decodeSafe(src.split(/[?#]/)[0].split(/[\\/]/).pop() || '')
        const att =
          (base ? takeAttachment((a) => normalizeName(a.filename) === normalizeName(base)) : null) ||
          (hint ? takeAttachment((a) => a.mimeType?.startsWith('image/') && normalizeName(a.filename) === normalizeName(hint)) : null)
        if (att) cid = addInline(att.contentBase64, att.mimeType, att.filename, att.contentId)
      }

      if (cid) {
        byOriginalSrc.set(src, cid)
        set('src', `cid:${cid}`) // NO angle brackets in HTML
        if (!get('alt')) {
          const inl = inlineAttachments.find((a) => a.contentId === cid)
          set('alt', (inl?.filename || 'slika').replace(/\.[a-z0-9]{2,5}$/i, ''))
        }
        set('style', ensureResponsiveImgStyle(get('style')))
        // Editor-only attributes are not needed by the recipient
        for (const k of ['data-filename', 'data-name']) {
          const i = attrs.findIndex(([n]) => n === k)
          if (i >= 0) attrs.splice(i, 1)
        }
        replacements.push({ full: tag.full, replacement: buildImgTag(attrs) })
      }
    }

    for (const r of replacements) {
      processedHtml = processedHtml.split(r.full).join(r.replacement)
    }
  }

  // Attachments explicitly flagged inline (or carrying a CID) become inline parts too.
  for (let i = remainingAttachments.length - 1; i >= 0; i--) {
    const a = remainingAttachments[i]
    if (a.isInline || a.contentId) {
      remainingAttachments.splice(i, 1)
      addInline(a.contentBase64, a.mimeType, a.filename, a.contentId)
    }
  }

  return { processedHtml, inlineAttachments, remainingAttachments }
}

function boundary(prefix: string): string {
  return `----=_${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
}

/**
 * Builds the raw RFC 822 message (base64url encoded for the Gmail API).
 *
 *  - no files, no inline images  -> text/html
 *  - inline images only          -> multipart/related { text/html, image/* ... }
 *  - files (+ optional images)   -> multipart/mixed { multipart/related{...} | text/html, attachment ... }
 */
export function buildRawMimeMessage(params: {
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
  const raw = buildRawMimeString(params)
  return Buffer.from(raw, 'utf8').toString('base64url')
}

export function buildRawMimeString(params: Parameters<typeof buildRawMimeMessage>[0]): string {
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

  const headers: string[] = [
    `From: ${fromDisplayName ? `${encodeHeaderWord(fromDisplayName)} <${from}>` : from}`,
  ]
  if (to?.trim()) headers.push(`To: ${to.trim()}`)
  if (cc?.trim()) headers.push(`Cc: ${cc.trim()}`)
  if (bcc?.trim()) headers.push(`Bcc: ${bcc.trim()}`)
  headers.push(`Subject: ${encodeHeaderWord(subject || '(bez naslova)')}`)
  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`)
  if (references) headers.push(`References: ${references}`)
  headers.push(`Date: ${new Date().toUTCString().replace('GMT', '+0000')}`)
  headers.push('MIME-Version: 1.0')

  const finalHtml =
    htmlBody ??
    `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1e293b;">${(textBody || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>')}</div>`

  // text/html entity (header lines + blank line + body)
  const htmlEntity = [
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    formatBase64(Buffer.from(finalHtml, 'utf8').toString('base64')),
  ].join(CRLF)

  const inlineEntity = (img: InlineMimeAttachment): string => {
    const name = fileParam(safeFilename(img.filename, `slika.${extFromMime(img.mimeType)}`))
    const cid = img.contentId.replace(/^cid:/i, '').replace(/[<>]/g, '').trim()
    return [
      `Content-Type: ${img.mimeType || 'image/png'}; name="${name}"`,
      'Content-Transfer-Encoding: base64',
      `Content-ID: <${cid}>`, // WITH angle brackets in the MIME header
      `X-Attachment-Id: ${cid.split('@')[0]}`,
      `Content-Disposition: inline; filename="${name}"`,
      '',
      formatBase64(img.contentBase64),
    ].join(CRLF)
  }

  const attachmentEntity = (att: OutgoingAttachment): string => {
    const name = fileParam(safeFilename(att.filename, 'privitak'))
    return [
      `Content-Type: ${att.mimeType || 'application/octet-stream'}; name="${name}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${name}"`,
      '',
      formatBase64(att.contentBase64),
    ].join(CRLF)
  }

  const multipart = (subtype: string, parts: string[], extra = ''): string => {
    const b = boundary(subtype)
    const lines: string[] = [`Content-Type: multipart/${subtype}; boundary="${b}"${extra}`, '']
    for (const p of parts) {
      lines.push(`--${b}`, p, '')
    }
    lines.push(`--${b}--`, '')
    return lines.join(CRLF)
  }

  let bodyEntity: string
  if (inlineAttachments.length > 0) {
    bodyEntity = multipart('related', [htmlEntity, ...inlineAttachments.map(inlineEntity)], '; type="text/html"')
  } else {
    bodyEntity = htmlEntity
  }

  if (attachments.length > 0) {
    bodyEntity = multipart('mixed', [bodyEntity, ...attachments.map(attachmentEntity)])
  }

  // Top-level headers are followed directly by the entity's own Content-Type header lines.
  return [...headers, bodyEntity].join(CRLF)
}
