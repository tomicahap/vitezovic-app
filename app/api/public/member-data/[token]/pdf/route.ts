import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { MemberService } from "@/src/services/member-service"
import { SettingsService } from "@/src/services/settings-service"
import { getAppDb } from "@/lib/database"
import { generateMemberPdfBuffer, sanitizePdfFileNamePart } from "@/lib/member-pdf"

export const dynamic = "force-dynamic"

const memberService = new MemberService()
const settingsService = new SettingsService()

function safeEqualSecret(a: string, b: string): boolean {
  if (!a || !b) return false
  const bufA = Buffer.from(a, "utf8")
  const bufB = Buffer.from(b, "utf8")
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> | { token: string } }
) {
  try {
    const settings = (await settingsService.getSettings()) as any
    const isMaintenance = settings?.maintenanceMode === 1 || settings?.maintenanceMode === true
    const cookieRole = (request.cookies.get("hrd_urole")?.value || "").trim().toLowerCase()
    if (isMaintenance && cookieRole !== "admin") {
      return NextResponse.json(
        { error: "Sustav se trenutno ažurira i nije mu moguće pristupiti. Kontaktirajte administratora.", maintenanceMode: true },
        { status: 503 }
      )
    }
    const resolved = await Promise.resolve(context.params)
    const token = String(resolved.token || "").trim()
    if (!token || token.length < 16) {
      return NextResponse.json({ error: "Neispravna poveznica." }, { status: 400 })
    }

    const db = getAppDb()
    const tokenRow = db
      .prepare(
        `SELECT id, data_form_submitted_at, COALESCE(data_form_single_use, 0) AS data_form_single_use, data_form_session_nonce
         FROM members
         WHERE data_form_token = ?
         LIMIT 1`
      )
      .get(token) as
      | {
          id: number
          data_form_submitted_at: string | null
          data_form_single_use: number
          data_form_session_nonce: string | null
        }
      | undefined

    const member = tokenRow ? await memberService.getMember(tokenRow.id) : null
    if (!tokenRow || !member) {
      return NextResponse.json(
        { error: "Poveznica nije važeća ili je već iskorištena." },
        { status: 410 }
      )
    }

    if (tokenRow.data_form_submitted_at && String(tokenRow.data_form_submitted_at).trim() !== "") {
      try {
        db.prepare(
          `UPDATE members
           SET data_form_token = NULL, data_form_session_nonce = NULL, data_form_single_use = 0
           WHERE id = ?`
        ).run(tokenRow.id)
      } catch {}
      return NextResponse.json(
        { error: "Podaci su već predani te ova poveznica više ne vrijedi." },
        { status: 410 }
      )
    }

    if (Number(tokenRow.data_form_single_use || 0) === 1) {
      const nonceParam = String(request.nextUrl.searchParams.get("nonce") || "").trim()
      const expectedNonce = String(tokenRow.data_form_session_nonce || "").trim()
      if (!safeEqualSecret(nonceParam, expectedNonce)) {
        return NextResponse.json(
          { error: "Pristup PDF dokumentu putem ove jednokratne poveznice nije dopušten." },
          { status: 403 }
        )
      }
    }

    const pdfBuffer = generateMemberPdfBuffer(member)
    const cleanName = sanitizePdfFileNamePart(member.name, `clan_${member.id}`)
    const fileName = `Evidencijski_list_${cleanName}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
      },
    })
  } catch (error: any) {
    console.error("Public member PDF error:", error)
    return NextResponse.json({ error: error.message || "Greška pri izradi PDF-a." }, { status: 500 })
  }
}
