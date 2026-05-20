import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Nepodržana vrsta datoteke. Dozvoljeni su: slike, PDF i Word dokumenti.' },
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

    // Sanitize filename
    const ext = path.extname(file.name)
    const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9-_]/g, '_')
    const uniqueName = `${Date.now()}_${baseName}${ext}`
    const filePath = path.join(uploadDir, uniqueName)

    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    const url = `/api/uploads/${uniqueName}`

    let fileType: 'image' | 'pdf' | 'word' = 'pdf'
    if (file.type.startsWith('image/')) fileType = 'image'
    else if (file.type === 'application/pdf') fileType = 'pdf'
    else fileType = 'word'

    return NextResponse.json({
      url,
      name: file.name,
      fileType,
      size: file.size,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Greška pri uploadu datoteke.' }, { status: 500 })
  }
}
