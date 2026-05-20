import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params
    
    // Sigurnosna provjera: Ne dopuštamo pristup bazi podataka kroz ovaj endpoint
    if (filename.toLowerCase().endsWith('.db') || filename.toLowerCase().includes('app.db')) {
      return new Response("Unauthorized", { status: 403 })
    }

    const filePath = process.env.UPLOAD_FOLDER ? path.join(process.env.UPLOAD_FOLDER, filename) : path.join(process.cwd(), 'data', 'uploads', filename)

    console.log(`[API Uploads] Serving: ${filename} from ${filePath}`)

    if (!fs.existsSync(filePath)) {
      console.error(`[API Uploads] File NOT FOUND: ${filePath}`)
      return new NextResponse('File not found', { status: 404 })
    }

    const fileBuffer = fs.readFileSync(filePath)
    const ext = path.extname(filename).toLowerCase()
    
    let contentType = 'application/octet-stream'
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'
    else if (ext === '.png') contentType = 'image/png'
    else if (ext === '.gif') contentType = 'image/gif'
    else if (ext === '.webp') contentType = 'image/webp'
    else if (ext === '.pdf') contentType = 'application/pdf'
    else if (ext === '.doc') contentType = 'application/msword'
    else if (ext === '.docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving file:', error)
    return new NextResponse('Error serving file', { status: 500 })
  }
}
