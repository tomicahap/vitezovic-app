import { NextRequest, NextResponse } from "next/server"
import { getAppDb } from "@/lib/database"
import { extractActor } from "@/lib/trash"
import { parseAccessRights } from "@/lib/inquiry-permissions"
import { generateVerifiedChronicleReport } from "@/lib/chronicle-server"
import type { ChronicleCategory } from "@/lib/chronology"

export const dynamic = "force-dynamic"

function canAccessChronicle(request: NextRequest): boolean {
  const actor = extractActor(request)
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

export async function GET(request: NextRequest) {
  try {
    if (!canAccessChronicle(request)) {
      return NextResponse.json(
        { error: "Nemate ovlast za pregled modula Ljetopis društva." },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get("mode") === "all" ? "all" : "range"
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined
    const catsParam = searchParams.get("categories") || ""
    const categories = catsParam
      ? (catsParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean) as ChronicleCategory[])
      : undefined

    const report = generateVerifiedChronicleReport({
      mode,
      startDate,
      endDate,
      categories,
    })

    return NextResponse.json(report, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
      },
    })
  } catch (error: any) {
    console.error("Chronicle GET error:", error)
    return NextResponse.json(
      { error: error.message || "Greška prilikom generiranja Ljetopisa društva." },
      { status: 500 }
    )
  }
}
