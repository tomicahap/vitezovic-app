export interface BoardAnnouncementAttachment {
  name: string
  url: string
  size: number
  mimeType: string
}

export const BOARD_ATTACHMENT_MAX_FILES = 10
export const BOARD_ATTACHMENT_MAX_FILE_BYTES = 15 * 1024 * 1024
export const BOARD_ATTACHMENT_MAX_TOTAL_BYTES = 20 * 1024 * 1024

export const BOARD_ATTACHMENT_ALLOWED_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.odt',
  '.rtf',
  '.xls',
  '.xlsx',
  '.ods',
  '.csv',
  '.ppt',
  '.pptx',
  '.odp',
  '.txt',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.zip',
] as const

export const BOARD_ATTACHMENT_ACCEPT_ATTR = BOARD_ATTACHMENT_ALLOWED_EXTENSIONS.join(',')

export function getBoardAttachmentExtension(filename: string): string {
  const clean = String(filename || '').trim()
  const lastDot = clean.lastIndexOf('.')
  if (lastDot <= 0 || lastDot === clean.length - 1) return ''
  return clean.slice(lastDot).toLowerCase()
}

export function isAllowedBoardAttachmentName(filename: string): boolean {
  const ext = getBoardAttachmentExtension(filename)
  if (!ext) return false
  return (BOARD_ATTACHMENT_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)
}

export function formatAttachmentSize(bytes: number): string {
  const n = Number(bytes || 0)
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  if (n < 1024) return `${Math.round(n)} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  const mb = n / (1024 * 1024)
  return `${mb.toFixed(1).replace('.', ',')} MB`
}

export function formatAttachmentsCountLabel(count: number): string {
  const n = Math.abs(Math.trunc(Number(count) || 0))
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod10 === 1 && mod100 !== 11) {
    return `${n} prilog`
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} priloga`
  }
  return `${n} priloga`
}

export function buildAttachmentDownloadUrl(url: string, name?: string): string {
  const cleanUrl = String(url || '').trim()
  if (!cleanUrl) return '#'
  if (!cleanUrl.startsWith('/api/uploads/')) return cleanUrl
  const sep = cleanUrl.includes('?') ? '&' : '?'
  const nameParam = name ? `&name=${encodeURIComponent(name)}` : ''
  return `${cleanUrl}${sep}download=1${nameParam}`
}
