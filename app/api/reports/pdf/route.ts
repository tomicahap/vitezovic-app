import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { generateReportPdfBuffer } from "@/lib/report-pdf"
import { MeetingService } from "@/src/services/meeting-service"
import { DatabaseService } from "@/lib/database"
import { generateId } from "@/lib/utils"

export const dynamic = "force-dynamic"

const meetingService = new MeetingService()
const db = DatabaseService as any

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      action = "download",
      startDate,
      endDate,
      generatedBy = "Administrator",
      generatedByRole = "admin",
      reportData,
      targetType,
      targetId,
      documentName,
    } = body

    if (!reportData || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Nedostaju podaci izvješća ili raspon datuma." },
        { status: 400 }
      )
    }

    const pdfBuffer = generateReportPdfBuffer({
      startDate,
      endDate,
      generatedBy,
      generatedByRole,
      reportData,
    })

    const safeFileName = `Izvjesce_HRD_${startDate}_do_${endDate}.pdf`.replace(/[^a-zA-Z0-9._-]/g, "_")

    if (action === "download") {
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeFileName}"`,
          "Content-Length": String(pdfBuffer.length),
        },
      })
    }

    if (action === "attach") {
      if (!targetType || !targetId) {
        return NextResponse.json(
          { error: "Odaberite sjednicu ili predavanje kojem želite prikvačiti PDF izvješće." },
          { status: 400 }
        )
      }

      const uploadDir = process.env.UPLOAD_FOLDER || path.join(process.cwd(), "data", "uploads")
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true })
      }

      const uniqueName = `${Date.now()}_${safeFileName}`
      const filePath = path.join(uploadDir, uniqueName)
      await writeFile(filePath, pdfBuffer)

      const url = `/api/uploads/${uniqueName}`
      const displayTitle =
        (documentName && String(documentName).trim()) ||
        `Izvješće o radu (${startDate.split("-").reverse().join("/")} - ${endDate.split("-").reverse().join("/")}).pdf`
      const finalName = displayTitle.toLowerCase().endsWith(".pdf") ? displayTitle : `${displayTitle}.pdf`

      const newAttachment = {
        id: generateId(),
        name: finalName,
        url,
        fileType: "pdf" as const,
        size: pdfBuffer.length,
      }

      if (targetType === "meeting") {
        const meeting = await meetingService.getMeeting(Number(targetId))
        if (!meeting) {
          return NextResponse.json({ error: "Odabrana sjednica nije pronađena." }, { status: 404 })
        }
        const existingAttachments = Array.isArray(meeting.attachments) ? meeting.attachments : []
        const updatedAttachments = [...existingAttachments, newAttachment]
        await meetingService.updateMeeting(Number(targetId), {
          ...meeting,
          attachments: updatedAttachments,
        })

        return NextResponse.json({
          success: true,
          attachment: newAttachment,
          targetType: "meeting",
          targetId: Number(targetId),
          targetTitle: meeting.title,
        })
      } else if (targetType === "lecture") {
        const lecture = db.getLecture(Number(targetId))
        if (!lecture) {
          return NextResponse.json({ error: "Odabrano predavanje nije pronađeno." }, { status: 404 })
        }
        let existingAttachments: any[] = []
        try {
          existingAttachments =
            typeof lecture.attachments === "string"
              ? JSON.parse(lecture.attachments || "[]")
              : lecture.attachments || []
        } catch {
          existingAttachments = []
        }
        let existingAttendees: any[] = []
        try {
          existingAttendees =
            typeof lecture.attendee_ids === "string"
              ? JSON.parse(lecture.attendee_ids || "[]")
              : lecture.attendee_ids || []
        } catch {
          existingAttendees = []
        }
        let existingHosts: any[] = []
        try {
          existingHosts =
            typeof lecture.hosts === "string"
              ? JSON.parse(lecture.hosts || "[]")
              : lecture.hosts || []
        } catch {
          existingHosts = []
        }

        const updatedAttachments = [...existingAttachments, newAttachment]
        db.updateLecture(Number(targetId), {
          title: lecture.title,
          type: lecture.type,
          date: lecture.date,
          start_time: lecture.start_time ?? null,
          end_time: lecture.end_time ?? null,
          city: lecture.city ?? null,
          location: lecture.location ?? null,
          description: lecture.description ?? null,
          host: lecture.host ?? null,
          hosts: existingHosts,
          attendee_ids: JSON.stringify(existingAttendees),
          attachments: JSON.stringify(updatedAttachments),
          status: lecture.status,
          youtube_url: lecture.youtube_url ?? null,
        })

        return NextResponse.json({
          success: true,
          attachment: newAttachment,
          targetType: "lecture",
          targetId: Number(targetId),
          targetTitle: lecture.title,
        })
      } else {
        return NextResponse.json({ error: "Nepoznata vrsta cilja (sjednica ili predavanje)." }, { status: 400 })
      }
    }

    return NextResponse.json({ error: "Nepoznata akcija." }, { status: 400 })
  } catch (error: any) {
    console.error("Greška pri generiranju ili prikvačivanju PDF izvješća:", error)
    return NextResponse.json(
      { error: error?.message || "Greška pri generiranju PDF izvješća." },
      { status: 500 }
    )
  }
}
