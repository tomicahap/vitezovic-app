import { NextRequest, NextResponse } from "next/server"
import { MeetingService } from "@/src/services/meeting-service"
import { MemberService } from "@/src/services/member-service"
import { DatabaseService } from "@/lib/database"
import { inferCityFromLocationOrTitle } from "@/lib/croatia-cities"
import { generateEventPdfBuffer } from "@/lib/event-pdf"

export const dynamic = "force-dynamic"

const meetingService = new MeetingService()
const memberService = new MemberService()
const db = DatabaseService as any

function parseLecture(row: any) {
  if (!row) return row
  let attendee_ids = []
  let attachments = []
  let hosts = []
  try {
    attendee_ids = typeof row.attendee_ids === "string" ? JSON.parse(row.attendee_ids || "[]") : row.attendee_ids || []
  } catch {}
  try {
    attachments = typeof row.attachments === "string" ? JSON.parse(row.attachments || "[]") : row.attachments || []
  } catch {}
  try {
    hosts = typeof row.hosts === "string" ? JSON.parse(row.hosts || "[]") : row.hosts || []
  } catch {}

  const resolvedCity =
    row.city && row.city.trim() ? row.city.trim() : inferCityFromLocationOrTitle(row.location, row.title) || null

  return {
    ...row,
    city: resolvedCity,
    attendee_ids,
    attachments,
    hosts,
    notification_sent_at: row.notification_sent_at || null,
    notification_recipients: row.notification_recipients || null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = (searchParams.get("type") === "lecture" ? "lecture" : "meeting") as "meeting" | "lecture"
    const id = Number(searchParams.get("id"))
    const download = searchParams.get("download") === "1" || searchParams.get("download") === "true"

    if (!id || isNaN(id)) {
      return NextResponse.json({ error: "Nedostaje ID događanja." }, { status: 400 })
    }

    const members = await memberService.getAllMembers()
    let item: any = null
    let polls: any[] = []
    const pollVotes: Record<number, any[]> = {}

    if (type === "meeting") {
      item = await meetingService.getMeeting(id)
      if (!item) {
        return NextResponse.json({ error: "Sjednica nije pronađena." }, { status: 404 })
      }
      try {
        const allPolls = DatabaseService.getPolls()
        polls = (allPolls || [])
          .filter((p: any) => Number(p.meeting_id) === id)
          .map((p: any) => ({
            ...p,
            options: typeof p.options === "string" ? JSON.parse(p.options || "[]") : p.options || [],
          }))
        for (const p of polls) {
          pollVotes[p.id] = DatabaseService.getVotesForPoll(Number(p.id)) || []
        }
      } catch {}
    } else {
      const rawLecture = db.getLecture(id)
      if (!rawLecture) {
        return NextResponse.json({ error: "Predavanje nije pronađeno." }, { status: 404 })
      }
      item = parseLecture(rawLecture)
    }

    let logs: any[] = []
    try {
      const allLogs = DatabaseService.getLogs() || []
      const marker = `[ID:${type}:${id}]`
      logs = allLogs.filter((l: any) => l.details && String(l.details).includes(marker))
    } catch {}

    const pdfBuffer = generateEventPdfBuffer({
      type,
      item,
      members,
      polls,
      pollVotes,
      logs,
    })

    const safeTitle = String(item.title || `${type}_${id}`)
      .replace(/[čć]/gi, "c")
      .replace(/[ž]/gi, "z")
      .replace(/[š]/gi, "s")
      .replace(/[đ]/gi, "d")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60)

    const prefix = type === "meeting" ? "Izvjestaj_Sjednica" : "Izvjestaj_Predavanje"
    const fileName = `${prefix}_${id}_${safeTitle || "HRD"}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    })
  } catch (err: any) {
    console.error("[Events PDF API] Error generating event PDF:", err)
    return NextResponse.json({ error: err.message || "Greška pri generiranju PDF izvještaja." }, { status: 500 })
  }
}
