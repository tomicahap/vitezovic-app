import { NextRequest, NextResponse } from "next/server"
import { MemberService } from "@/src/services/member-service"
import { SettingsService } from "@/src/services/settings-service"
import { generateMemberPdfBuffer, sanitizePdfFileNamePart } from "@/lib/member-pdf"

export const dynamic = "force-dynamic"

const memberService = new MemberService()
const settingsService = new SettingsService()

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

    const allMembers = await memberService.getAllMembers()
    const member = allMembers.find((m: any) => m.dataFormToken === token)
    if (!member) {
      return NextResponse.json({ error: "Obrazac nije pronađen." }, { status: 404 })
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
      },
    })
  } catch (error: any) {
    console.error("Public member PDF error:", error)
    return NextResponse.json({ error: error.message || "Greška pri izradi PDF-a." }, { status: 500 })
  }
}
