import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { extractActor } from '@/lib/trash'
import { MemberService } from '@/src/services/member-service'
import { getMemberActionPermissions } from '@/lib/inquiry-permissions'
import { getAppDb } from '@/lib/database'
import {
  BOARD_ATTACHMENT_MAX_FILES,
  BOARD_ATTACHMENT_MAX_FILE_BYTES,
  BOARD_ATTACHMENT_MAX_TOTAL_BYTES,
  BoardAnnouncementAttachment,
  formatAttachmentSize,
  getBoardAttachmentExtension,
  isAllowedBoardAttachmentName,
} from '@/lib/board-attachment-utils'

export const dynamic = 'force-dynamic'

const EXT_TO_MIME: Record<string, string> = {
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
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.zip': 'application/zip',
}

function getUploadDir(): string {
  return process.env.UPLOAD_FOLDER || path.join(process.cwd(), 'data', 'uploads')
}

async function assertCanSendBoardAnnouncement(request: NextRequest): Promise<NextResponse | null> {
  const actor = extractActor(request)
  const roleLower = (actor.role || '').trim().toLowerCase()
  if (roleLower === 'admin') return null

  const memberService = new MemberService()
  const allMembers = await memberService.getAllMembers()
  const numericActorId = Number(actor.id)
  const emailLower = (actor.email || '').trim().toLowerCase()
  const actorMember = allMembers.find(
    (m) =>
      (Number.isFinite(numericActorId) && numericActorId > 0 && Number(m.id) === numericActorId) ||
      (emailLower && m.email && m.email.trim().toLowerCase() === emailLower)
  )

  const allowed = Boolean(actorMember && getMemberActionPermissions(actorMember).obavijest_tijelima)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Nemate ovlast za prilaganje datoteka obavijestima članovima tijela društva.' },
      { status: 403 }
    )
  }
  return null
}

function sanitizeStorageBaseName(rawName: string, ext: string): string {
  const rawBase = path.basename(rawName, ext)
  const ascii = rawBase
    .replace(/[čć]/gi, 'c')
    .replace(/ž/gi, 'z')
    .replace(/š/gi, 's')
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  return (ascii || 'prilog').slice(0, 60)
}

export async function POST(request: NextRequest) {
  try {
    const authError = await assertCanSendBoardAnnouncement(request)
    if (authError) return authError

    const formData = await request.formData()
    const rawEntries = [...formData.getAll('files'), ...formData.getAll('file')]
    const files = rawEntries.filter((entry): entry is File => entry instanceof File)

    if (files.length === 0) {
      return NextResponse.json({ error: 'Nije odabrana niti jedna datoteka.' }, { status: 400 })
    }

    if (files.length > BOARD_ATTACHMENT_MAX_FILES) {
      return NextResponse.json(
        { error: `Najviše možete priložiti ${BOARD_ATTACHMENT_MAX_FILES} datoteka odjednom.` },
        { status: 400 }
      )
    }

    let totalBytes = 0
    for (const file of files) {
      const cleanOriginalName = path.basename(String(file.name || '').trim())
      if (!cleanOriginalName || !isAllowedBoardAttachmentName(cleanOriginalName)) {
        return NextResponse.json(
          {
            error: `Datoteka "${cleanOriginalName || 'nepoznato'}" nije podržane vrste. Dozvoljeni su dokumenti (PDF, Word, Excel, PowerPoint, ODT, TXT, CSV), slike i ZIP arhive.`,
          },
          { status: 400 }
        )
      }
      if (!file.size || file.size <= 0) {
        return NextResponse.json(
          { error: `Datoteka "${cleanOriginalName}" je prazna i ne može se priložiti.` },
          { status: 400 }
        )
      }
      if (file.size > BOARD_ATTACHMENT_MAX_FILE_BYTES) {
        return NextResponse.json(
          {
            error: `Datoteka "${cleanOriginalName}" (${formatAttachmentSize(file.size)}) premašuje ograničenje od ${formatAttachmentSize(BOARD_ATTACHMENT_MAX_FILE_BYTES)} po datoteci.`,
          },
          { status: 400 }
        )
      }
      totalBytes += file.size
    }

    if (totalBytes > BOARD_ATTACHMENT_MAX_TOTAL_BYTES) {
      return NextResponse.json(
        {
          error: `Ukupna veličina odabranih datoteka (${formatAttachmentSize(totalBytes)}) premašuje ograničenje od ${formatAttachmentSize(BOARD_ATTACHMENT_MAX_TOTAL_BYTES)}.`,
        },
        { status: 400 }
      )
    }

    const uploadDir = getUploadDir()
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }
    const resolvedUploadDir = path.resolve(uploadDir)

    const uploaded: BoardAnnouncementAttachment[] = []

    for (const file of files) {
      const cleanOriginalName = path.basename(String(file.name || '').trim())
      const ext = getBoardAttachmentExtension(cleanOriginalName)
      const safeBase = sanitizeStorageBaseName(cleanOriginalName, ext)
      const uniqueName = `board_ann_${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${safeBase}${ext}`
      const targetPath = path.resolve(resolvedUploadDir, uniqueName)

      if (!targetPath.startsWith(resolvedUploadDir + path.sep)) {
        return NextResponse.json({ error: 'Neispravna putanja za pohranu datoteke.' }, { status: 400 })
      }

      const bytes = await file.arrayBuffer()
      await writeFile(targetPath, Buffer.from(bytes))

      const mimeType = (file.type && file.type.trim()) || EXT_TO_MIME[ext] || 'application/octet-stream'

      uploaded.push({
        name: cleanOriginalName,
        url: `/api/uploads/${uniqueName}`,
        size: file.size,
        mimeType,
      })
    }

    return NextResponse.json({
      success: true,
      attachments: uploaded,
    })
  } catch (error: any) {
    console.error('[Board Announcement Upload POST Error]:', error)
    return NextResponse.json(
      { error: error?.message || 'Greška pri učitavanju priloženih datoteka.' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authError = await assertCanSendBoardAnnouncement(request)
    if (authError) return authError

    const rawFilename = String(request.nextUrl.searchParams.get('filename') || '').trim()
    if (
      !rawFilename ||
      rawFilename.includes('..') ||
      rawFilename.includes('/') ||
      rawFilename.includes('\\') ||
      path.basename(rawFilename) !== rawFilename ||
      !rawFilename.startsWith('board_ann_')
    ) {
      return NextResponse.json({ error: 'Neispravan naziv datoteke za uklanjanje.' }, { status: 400 })
    }

    // Nikada ne briši privitak s diska ako je već trajno povezan s poslanom obavijesti u bazi
    try {
      const db = getAppDb()
      const referenced = db
        .prepare('SELECT 1 FROM board_announcements WHERE attachments LIKE ? LIMIT 1')
        .get(`%${rawFilename}%`)
      if (referenced) {
        return NextResponse.json(
          { error: 'Privitak je dio poslane arhive obavijesti i ne može se obrisati s diska.' },
          { status: 409 }
        )
      }
    } catch {}

    const uploadDir = path.resolve(getUploadDir())
    const filePath = path.resolve(uploadDir, rawFilename)
    if (!filePath.startsWith(uploadDir + path.sep)) {
      return NextResponse.json({ error: 'Neispravna putanja datoteke.' }, { status: 400 })
    }

    if (existsSync(filePath)) {
      await unlink(filePath)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Board Announcement Upload DELETE Error]:', error)
    return NextResponse.json(
      { error: error?.message || 'Greška pri uklanjanju datoteke.' },
      { status: 500 }
    )
  }
}
