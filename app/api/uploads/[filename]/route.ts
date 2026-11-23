import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.rtf': 'application/rtf',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.csv': 'text/csv; charset=utf-8',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.txt': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
}

function buildAsciiFallbackName(name: string): string {
  return (
    name
      .replace(/[čć]/gi, 'c')
      .replace(/ž/gi, 'z')
      .replace(/š/gi, 's')
      .replace(/đ/gi, 'd')
      .replace(/["\\\r\n]/g, '')
      .replace(/[^\x20-\x7E]/g, '_') || 'prilog'
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params
    const lower = filename.toLowerCase()

    // Sigurnosna provjera: zabrana traversal putanja i pristupa bazama podataka
    if (
      !filename ||
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\') ||
      path.basename(filename) !== filename ||
      lower.endsWith('.db') ||
      lower.endsWith('.sqlite') ||
      lower.endsWith('.sqlite3') ||
      lower.endsWith('.wal') ||
      lower.endsWith('.shm') ||
      lower.includes('app.db')
    ) {
      return new Response('Unauthorized', { status: 403 })
    }

    const uploadDir = path.resolve(
      process.env.UPLOAD_FOLDER || path.join(process.cwd(), 'data', 'uploads')
    )
    const filePath = path.resolve(uploadDir, filename)

    if (!filePath.startsWith(uploadDir + path.sep)) {
      return new Response('Unauthorized', { status: 403 })
    }

    if (!fs.existsSync(filePath)) {
      console.error(`[API Uploads] File NOT FOUND: ${filePath}`)
      return new NextResponse('File not found', { status: 404 })
    }

    const fileBuffer = fs.readFileSync(filePath)
    const ext = path.extname(filename).toLowerCase()
    const contentType = MIME_MAP[ext] || 'application/octet-stream'

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    }

    const downloadFlag = request.nextUrl.searchParams.get('download')
    if (downloadFlag === '1' || downloadFlag === 'true') {
      const requestedName = String(request.nextUrl.searchParams.get('name') || '').trim()
      const safeName = path.basename(requestedName || filename).replace(/[\r\n]/g, '') || filename
      const asciiFallback = buildAsciiFallbackName(safeName)
      headers['Content-Disposition'] =
        `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`
    }

    return new NextResponse(fileBuffer, { headers })
  } catch (error) {
    console.error('Error serving file:', error)
    return new NextResponse('Error serving file', { status: 500 })
  }
}
