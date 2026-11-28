import { formatDateDMY, formatDateTimeDMY, generateId } from "./utils"

export interface InquiryAttachment {
  id: string
  name: string
  url: string
  fileType: string
  size?: number
  mimeType?: string
  sha256?: string | null
  source_message_id?: string | null
  source_gmail_message_id?: string | null
  source_date?: string | null
  source_subject?: string | null
}

export interface InquirySourceMessage {
  id: string
  gmail_message_id?: string | null
  gmail_thread_id?: string | null
  received_at: string
  received_date: string
  from_name: string
  from_email: string
  subject: string
  body_text: string
  attachments_names?: string[]
  attachment_ids?: string[]
  added_at: string
  added_by?: string
  merged_from_inquiry_id?: number | null
  is_initial?: boolean
}

/** 20 MB warning threshold before Gmail's ~25 MB encoded MIME limit */
export const MAX_GMAIL_TOTAL_ATTACHMENTS_BYTES = 20 * 1024 * 1024
/** Hard server limit (22 MB raw -> ~29 MB base64 MIME) */
export const HARD_GMAIL_TOTAL_ATTACHMENTS_BYTES = 22 * 1024 * 1024

/**
 * Normalizes any date string into YYYY-MM-DD when possible, otherwise returns "".
 */
export function normalizeIsoDateOnly(raw?: string | null): string {
  if (!raw) return ""
  const s = String(raw).trim()
  if (!s) return ""

  const isoPrefix = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoPrefix) {
    return `${isoPrefix[1]}-${isoPrefix[2].padStart(2, "0")}-${isoPrefix[3].padStart(2, "0")}`
  }

  const dmySlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (dmySlash) {
    return `${dmySlash[3]}-${dmySlash[2].padStart(2, "0")}-${dmySlash[1].padStart(2, "0")}`
  }

  const dmyDot = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?/)
  if (dmyDot) {
    return `${dmyDot[3]}-${dmyDot[2].padStart(2, "0")}-${dmyDot[1].padStart(2, "0")}`
  }

  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }
  return ""
}

/**
 * Returns the earliest valid YYYY-MM-DD date among inputs so FIFO order is always preserved.
 */
export function pickEarliestInquiryDate(...dates: Array<string | null | undefined>): string {
  const valid = dates
    .map((d) => normalizeIsoDateOnly(d))
    .filter((d) => Boolean(d))
    .sort((a, b) => a.localeCompare(b))
  return valid[0] || new Date().toISOString().slice(0, 10)
}

/**
 * Strict FIFO comparator: earliest inquiry_date first, then earliest created_at, then lowest id.
 */
export function compareInquiriesFifo(
  a: { id?: number | string; inquiry_date?: string | null; created_at?: string | null },
  b: { id?: number | string; inquiry_date?: string | null; created_at?: string | null }
): number {
  const dateA = normalizeIsoDateOnly(a.inquiry_date) || "9999-12-31"
  const dateB = normalizeIsoDateOnly(b.inquiry_date) || "9999-12-31"
  if (dateA !== dateB) {
    return dateA.localeCompare(dateB)
  }

  const createdA = String(a.created_at || "")
  const createdB = String(b.created_at || "")
  if (createdA && createdB && createdA !== createdB) {
    return createdA.localeCompare(createdB)
  }

  return Number(a.id || 0) - Number(b.id || 0)
}

/**
 * Calculates whole days elapsed since inquiry_date (>= 0). Returns null if date is invalid.
 */
export function getInquiryWaitingDays(inquiryDate?: string | null): number | null {
  const iso = normalizeIsoDateOnly(inquiryDate)
  if (!iso) return null
  const start = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(start.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return diff >= 0 ? diff : 0
}

/**
 * Builds the initial InquirySourceMessage from an existing inquiry row when source_messages is empty.
 */
export function seedInitialSourceMessage(inquiry: {
  id?: number
  requester_name?: string | null
  requester_email?: string | null
  requester_contact?: string | null
  inquiry_date?: string | null
  subject?: string | null
  inquiry_text?: string | null
  gmail_message_id?: string | null
  gmail_thread_id?: string | null
  attachments?: InquiryAttachment[] | null
  created_at?: string | null
  created_by?: string | null
}): InquirySourceMessage {
  const isoDate = normalizeIsoDateOnly(inquiry.inquiry_date) || new Date().toISOString().slice(0, 10)
  const receivedAt =
    inquiry.created_at && normalizeIsoDateOnly(inquiry.created_at) === isoDate
      ? String(inquiry.created_at)
      : `${isoDate}T09:00:00.000Z`
  const attachments = Array.isArray(inquiry.attachments) ? inquiry.attachments : []

  let fromEmail = String(inquiry.requester_email || "").trim()
  if (!fromEmail && inquiry.requester_contact) {
    const m = String(inquiry.requester_contact).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    if (m) fromEmail = m[0].trim().toLowerCase()
  }

  return {
    id: inquiry.gmail_message_id ? `init-${inquiry.gmail_message_id}` : `init-${inquiry.id || generateId()}`,
    gmail_message_id: inquiry.gmail_message_id || null,
    gmail_thread_id: inquiry.gmail_thread_id || null,
    received_at: receivedAt,
    received_date: isoDate,
    from_name: String(inquiry.requester_name || "Podnositelj upita").trim(),
    from_email: fromEmail,
    subject: String(inquiry.subject || "Rodoslovni upit").trim(),
    body_text: String(inquiry.inquiry_text || "").trim(),
    attachments_names: attachments.map((a) => a.name).filter(Boolean),
    attachment_ids: attachments.map((a) => a.id).filter(Boolean),
    added_at: String(inquiry.created_at || receivedAt),
    added_by: inquiry.created_by ? String(inquiry.created_by) : undefined,
    is_initial: true,
  }
}

/**
 * Formats a clean Croatian chronological divider block when appending a follow-up email or merged case.
 */
export function formatSupplementDividerBlock(params: {
  index: number
  receivedAt: string
  fromName: string
  fromEmail: string
  subject: string
  bodyText: string
  mergedFromInquiryId?: number | null
}): string {
  const dateLabel = params.receivedAt
    ? formatDateTimeDMY(params.receivedAt, formatDateDMY(params.receivedAt, "—"))
    : "—"
  const senderLabel = [params.fromName, params.fromEmail ? `<${params.fromEmail}>` : ""]
    .filter(Boolean)
    .join(" ")
  const heading = params.mergedFromInquiryId
    ? `SPOJENI PREDMET #${params.mergedFromInquiryId} (DOPUNA #${params.index})`
    : `DOPUNA UPITA #${params.index}`

  return [
    "",
    `────────── ${heading} (${dateLabel}) ──────────`,
    senderLabel ? `Pošiljatelj: ${senderLabel}` : "",
    params.subject ? `Naslov e-maila: ${params.subject}` : "",
    "",
    String(params.bodyText || "").trim() || "(Bez teksta)",
  ]
    .filter((line, i, arr) => {
      if (line !== "") return true
      // Keep deliberate blank lines around divider/body, drop blanks caused by empty metadata lines
      return i === 0 || (i > 0 && arr[i - 1] !== "")
    })
    .join("\n")
}

/**
 * Ensures an attachment display filename does not collide with existing names in the same case.
 */
export function buildUniqueAttachmentName(
  originalName: string,
  existingNamesLower: Set<string>,
  supplementIndex: number
): string {
  const cleanOriginal = String(originalName || "privitak").trim() || "privitak"
  if (!existingNamesLower.has(cleanOriginal.toLowerCase())) {
    return cleanOriginal
  }

  const lastDot = cleanOriginal.lastIndexOf(".")
  const hasExt = lastDot > 0 && lastDot < cleanOriginal.length - 1
  const base = hasExt ? cleanOriginal.slice(0, lastDot) : cleanOriginal
  const ext = hasExt ? cleanOriginal.slice(lastDot) : ""

  let candidate = `${base} (dopuna ${supplementIndex})${ext}`
  let counter = 2
  while (existingNamesLower.has(candidate.toLowerCase())) {
    candidate = `${base} (dopuna ${supplementIndex}-${counter})${ext}`
    counter++
  }
  return candidate
}

/**
 * Appends unique secondary emails or phone numbers to requester_contact without duplicates.
 */
export function buildCombinedContactString(
  existingContact?: string | null,
  primaryEmail?: string | null,
  extraContacts?: Array<string | null | undefined>
): string {
  const parts: string[] = []
  const seen = new Set<string>()

  const pushToken = (raw?: string | null) => {
    const trimmed = String(raw || "").trim()
    if (!trimmed) return
    const key = trimmed.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    parts.push(trimmed)
  }

  if (existingContact) {
    for (const seg of String(existingContact).split(/[,;\n]+/)) {
      pushToken(seg)
    }
  }
  if (primaryEmail) {
    pushToken(primaryEmail)
  }
  for (const extra of extraContacts || []) {
    if (!extra) continue
    for (const seg of String(extra).split(/[,;\n]+/)) {
      pushToken(seg)
    }
  }

  return parts.join(", ")
}

export function sumAttachmentsSize(attachments?: Array<{ size?: number }> | null): number {
  if (!Array.isArray(attachments)) return 0
  return attachments.reduce((sum, att) => sum + (Number(att?.size) || 0), 0)
}

export function formatBytesCompact(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
