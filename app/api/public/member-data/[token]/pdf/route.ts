import { NextRequest, NextResponse } from "next/server"
import { MemberService } from "@/src/services/member-service"
import { generateMemberPdfBuffer } from "@/lib/member-pdf"

export const dynamic = "force-dynamic"

const memberService = new MemberService()

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> | { token: string } }
) {
  try {
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
    const cleanName = String(member.name || `clan_${member.id}`)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
    const fileName = `Evidencijski_list_${cleanName || member.id}.pdf`

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
