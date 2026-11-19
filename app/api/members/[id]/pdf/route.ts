import { NextRequest, NextResponse } from "next/server"
import { MemberService } from "@/src/services/member-service"
import { generateMemberPdfBuffer, sanitizePdfFileNamePart } from "@/lib/member-pdf"

export const dynamic = "force-dynamic"

const memberService = new MemberService()

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(context.params)
    const id = Number(resolvedParams.id)

    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: "Neispravan ID člana." }, { status: 400 })
    }

    const member = await memberService.getMember(id)
    if (!member) {
      return NextResponse.json({ error: "Član nije pronađen." }, { status: 404 })
    }

    const pdfBuffer = generateMemberPdfBuffer(member)
    const cleanName = sanitizePdfFileNamePart(member.name, `clan_${id}`)
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
    console.error("Member PDF error:", error)
    return NextResponse.json(
      { error: error.message || "Greška pri generiranju PDF izvještaja za člana." },
      { status: 500 }
    )
  }
}
