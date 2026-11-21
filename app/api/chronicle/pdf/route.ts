import { NextRequest, NextResponse } from "next/server"
import { getAppDb } from "@/lib/database"
import { extractActor } from "@/lib/trash"
import { parseAccessRights } from "@/lib/inquiry-permissions"
import { generateVerifiedChronicleReport } from "@/lib/chronicle-server"
import { generateChroniclePdfBuffer } from "@/lib/chronicle-pdf"
import { sanitizePdfFileNamePart } from "@/lib/member-pdf"
import type { ChronicleCategory } from "@/lib/chronology"

export const dynamic = "force-dynamic"

function canAccessChronicle(request: NextRequest, body?: any): boolean {
  const actor = extractActor(request, body)
  const roleLower = (actor.role || "").trim().toLowerCase()
  if (roleLower === "admin" || roleLower === "moderator") return true

  const db = getAppDb()
  const numericId = Number(actor.id)
  const emailLower = (actor.email || "").trim().toLowerCase()

  let memberRow: any = null
  if (Number.isFinite(numericId) && numericId > 0) {
    memberRow = db
      .prepare("SELECT access_rights FROM members WHERE id = ? LIMIT 1")
      .get(numericId)
  }
  if (!memberRow && emailLower) {
    memberRow = db
      .prepare("SELECT access_rights FROM members WHERE LOWER(TRIM(email)) = ? LIMIT 1")
      .get(emailLower)
  }

  if (!memberRow) return false
  const rights = parseAccessRights(memberRow.access_rights)
  return Boolean(rights?.chronicle?.view === true || rights?.chronicle?.edit === true)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    if (!canAccessChronicle(request, body)) {
      return NextResponse.json(
        { error: "Nemate ovlast za izvoz Ljetopisa društva." },
        { status: 403 }
      )
    }

    const mode = body.mode === "all" ? "all" : "range"
    const startDate = typeof body.startDate === "string" ? body.startDate : undefined
    const endDate = typeof body.endDate === "string" ? body.endDate : undefined
    const categories = Array.isArray(body.categories)
      ? (body.categories as ChronicleCategory[])
      : undefined

    const report = generateVerifiedChronicleReport({
      mode,
      startDate,
      endDate,
      categories,
    })

    const pdfBuffer = generateChroniclePdfBuffer(report)
    const rawPeriodSlug =
      mode === "all"
        ? "cjelokupna_povijest"
        : `${report.period.startDate}_do_${report.period.endDate}`
    const safeSlug = sanitizePdfFileNamePart(rawPeriodSlug, "razdoblje")
    const fileName = `Ljetopis_HRD_${safeSlug}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "no-store, private",
      },
    })
  } catch (error: any) {
    console.error("Chronicle PDF POST error:", error)
    return NextResponse.json(
      { error: error.message || "Greška pri izradi PDF ljetopisa." },
      { status: 500 }
    )
  }
}
