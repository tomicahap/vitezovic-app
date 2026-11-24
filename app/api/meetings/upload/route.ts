import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.tif',
  '.tiff',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.odt',
  '.ods',
  '.odp',
  '.rtf',
  '.txt',
  '.csv',
  '.ged',
  '.zip',
])

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/rtf',
  'text/rtf',
  'text/plain',
  'text/csv',
  'application/csv',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
])

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Datoteka nije priložena.' }, { status: 400 })
    }

    const ext = path.extname(file.name || '').toLowerCase()
    const mime = (file.type || '').toLowerCase().trim()
    const isExtAllowed = Boolean(ext && ALLOWED_EXTENSIONS.has(ext))
    const isMimeAllowed = Boolean(mime && ALLOWED_MIME_TYPES.has(mime))

    // Validacija kombinacijom ekstenzije i sigurnog MIME tipa (Windows preglednici za .ged/.odt/.csv znaju poslati prazan tip)
    if (!isExtAllowed && (!mime || mime === 'application/octet-stream' || !isMimeAllowed)) {
      return NextResponse.json(
        {
          error:
            'Nepodržana vrsta datoteke. Dozvoljeni su: slike, PDF, Word, Excel, PowerPoint, ODT/ODS, TXT, CSV, RTF, GEDCOM (.ged) i ZIP.',
        },
        { status: 400 }
      )
    }

    if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          error:
            `Nepodržana ekstenzija datoteke (${ext}). Dozvoljeni su: slike, PDF, Word, Excel, PowerPoint, ODT/ODS, TXT, CSV, RTF, GEDCOM (.ged) i ZIP.`,
        },
        { status: 400 }
      )
    }

    // Max 20 MB
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Datoteka je prevelika. Maksimalna veličina je 20 MB.' },
        { status: 400 }
      )
    }

    const uploadDir = process.env.UPLOAD_FOLDER || path.join(process.cwd(), 'data', 'uploads')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Sigurno čišćenje imena datoteke bez path traversala uz očuvanje dijakritika
    const safeOrigName = path.basename(file.name || 'datoteka')
    const origExt = path.extname(safeOrigName)
    const baseName = path
      .basename(safeOrigName, origExt)
      .replace(/[^a-zA-Z0-9čćžšđČĆŽŠĐ._-]/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'datoteka'
    const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${baseName}${origExt}`
    const filePath = path.join(uploadDir, uniqueName)

    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    const url = `/api/uploads/${uniqueName}`

    let fileType: 'image' | 'pdf' | 'word' | 'excel' | 'archive' | 'document' = 'document'
    if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|tif|tiff)$/i.test(safeOrigName)) {
      fileType = 'image'
    } else if (mime === 'application/pdf' || ext === '.pdf') {
      fileType = 'pdf'
    } else if (/\.(doc|docx|odt|rtf)$/i.test(safeOrigName) || mime.includes('word') || mime.includes('opendocument.text')) {
      fileType = 'word'
    } else if (/\.(xls|xlsx|ods|csv)$/i.test(safeOrigName) || mime.includes('excel') || mime.includes('spreadsheet')) {
      fileType = 'excel'
    } else if (ext === '.zip' || mime.includes('zip')) {
      fileType = 'archive'
    }

    return NextResponse.json({
      url,
      name: safeOrigName,
      fileType,
      size: file.size,
      mimeType: mime || 'application/octet-stream',
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Greška pri uploadu datoteke.' }, { status: 500 })
  }
}
