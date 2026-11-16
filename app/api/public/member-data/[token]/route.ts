import { NextRequest, NextResponse } from "next/server"
import { MemberService } from "@/src/services/member-service"
import { DatabaseService } from "@/lib/database"
import { getMissingMemberFields } from "@/lib/member-missing-fields"

export const dynamic = "force-dynamic"

const memberService = new MemberService()

const FIELD_LABELS: Record<string, string> = {
  name: "Ime i prezime",
  maidenName: "Djevojačko prezime",
  oib: "OIB",
  birthDate: "Datum rođenja",
  birthPlace: "Mjesto rođenja",
  birthCountry: "Zemlja rođenja",
  email: "Email adresa",
  phone: "Mobitel",
  landlinePhone: "Telefon (fiksni)",
  address: "Adresa prebivališta",
  occupation: "Zvanje i zanimanje",
  workExperience: "Radno iskustvo",
  hobbiesSkills: "Hobi / vještine i znanja",
  foreignLanguages: "Strani jezici",
  researchAreas: "Lokacije i prezimena koja istražuje",
  joinDate: "Datum upisa u društvo",
}

function buildPublicProfile(member: any) {
  const parts = String(member.name || "").trim().split(/\s+/)
  const firstName = parts[0] || ""
  const lastName = parts.slice(1).join(" ") || ""
  return {
    id: member.id,
    firstName,
    lastName,
    name: member.name || "",
    maidenName: member.maidenName || "",
    oib: member.oib || "",
    birthDate: member.birthDate || "",
    birthPlace: member.birthPlace || "",
    birthCountry: member.birthCountry || "",
    email: member.email || "",
    phone: member.phone || "",
    landlinePhone: member.landlinePhone || "",
    address: member.address || "",
    occupation: member.occupation || "",
    workExperience: member.workExperience || "",
    hobbiesSkills: member.hobbiesSkills || "",
    foreignLanguages: member.foreignLanguages || "",
    researchAreas: Array.isArray(member.researchAreas) ? member.researchAreas : [],
    joinDate: member.joinDate || "",
    lastMissingDataEmailAt: member.lastMissingDataEmailAt || null,
    dataFormViewedAt: member.dataFormViewedAt || null,
    dataFormSubmittedAt: member.dataFormSubmittedAt || null,
    dataFormUpdatedFields: Array.isArray(member.dataFormUpdatedFields)
      ? member.dataFormUpdatedFields
      : [],
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> | { token: string } }
) {
  try {
    const resolved = await Promise.resolve(context.params)
    const token = String(resolved.token || "").trim()
    if (!token || token.length < 16) {
      return NextResponse.json({ error: "Neispravna ili istekla poveznica." }, { status: 400 })
    }

    const allMembers = await memberService.getAllMembers()
    const member = allMembers.find((m: any) => m.dataFormToken === token)

    if (!member) {
      return NextResponse.json(
        { error: "Obrazac nije pronađen. Poveznica je neispravna ili je u međuvremenu zamijenjena novom." },
        { status: 404 }
      )
    }

    const now = new Date().toISOString()
    const firstViewInCycle = !member.dataFormViewedAt

    try {
      await memberService.updateMember(member.id, {
        dataFormViewedAt: now,
      })
      member.dataFormViewedAt = now

      if (firstViewInCycle) {
        DatabaseService.insertLog({
          userId: String(member.id),
          userName: member.name,
          userRole: member.role || "member",
          action: "Pregled online forme za dopunu podataka",
          details: `Član ${member.name} (${member.email}) je otvorio/pogledao personaliziranu online formu za dopunu podataka.`,
          timestamp: now,
        })
      }
    } catch (err) {
      console.error("Failed to record form view:", err)
    }

    const missingFields = getMissingMemberFields(member)

    return NextResponse.json({
      member: buildPublicProfile(member),
      missingFields,
    })
  } catch (error: any) {
    console.error("Public member data GET error:", error)
    return NextResponse.json(
      { error: error.message || "Interna greška poslužitelja." },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
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

    const payload = await request.json()
    const firstName = String(payload.firstName ?? "").trim()
    const lastName = String(payload.lastName ?? "").trim()
    const combinedName = [firstName, lastName].filter(Boolean).join(" ").trim() || member.name

    const parsedResearchAreas: string[] = Array.isArray(payload.researchAreas)
      ? payload.researchAreas.map((s: any) => String(s).trim()).filter(Boolean)
      : String(payload.researchAreas ?? "")
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean)

    // Dopuštamo upis ISKLJUČIVO polja iz traženih kategorija + datum upisa u društvo
    const nextValues: Record<string, any> = {
      name: combinedName,
      maidenName: String(payload.maidenName ?? "").trim(),
      oib: String(payload.oib ?? "").trim(),
      birthDate: String(payload.birthDate ?? "").trim(),
      birthPlace: String(payload.birthPlace ?? "").trim(),
      birthCountry: String(payload.birthCountry ?? "").trim(),
      email: String(payload.email ?? member.email ?? "").trim() || member.email,
      phone: String(payload.phone ?? "").trim(),
      landlinePhone: String(payload.landlinePhone ?? "").trim(),
      address: String(payload.address ?? "").trim(),
      occupation: String(payload.occupation ?? "").trim(),
      workExperience: String(payload.workExperience ?? "").trim(),
      hobbiesSkills: String(payload.hobbiesSkills ?? "").trim(),
      foreignLanguages: String(payload.foreignLanguages ?? "").trim(),
      researchAreas: parsedResearchAreas,
      joinDate: String(payload.joinDate ?? member.joinDate ?? "").trim(),
    }

    const updatedLabels: string[] = []
    for (const [key, label] of Object.entries(FIELD_LABELS)) {
      if (key === "researchAreas") {
        const prevStr = (Array.isArray(member.researchAreas) ? member.researchAreas : []).join(", ")
        const nextStr = parsedResearchAreas.join(", ")
        if (nextStr && prevStr !== nextStr) updatedLabels.push(label)
      } else {
        const prevVal = String((member as any)[key] ?? "").trim()
        const nextVal = String(nextValues[key] ?? "").trim()
        if (nextVal && prevVal !== nextVal) updatedLabels.push(label)
      }
    }

    const initials = combinedName
      .split(/\s+/)
      .filter(Boolean)
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 3)

    const now = new Date().toISOString()

    await memberService.updateMember(member.id, {
      ...nextValues,
      initials: initials || member.initials,
      dataFormViewedAt: member.dataFormViewedAt || now,
      dataFormSubmittedAt: now,
      dataFormUpdatedFields: updatedLabels,
    })

    try {
      DatabaseService.insertLog({
        userId: String(member.id),
        userName: combinedName,
        userRole: member.role || "member",
        action: "Predana dopuna osobnih podataka",
        details: `Član ${combinedName} (${nextValues.email}) je popunio i predao online formu za dopunu podataka. Ažurirana polja: ${
          updatedLabels.length > 0 ? updatedLabels.join(", ") : "potvrđeni postojeći podaci"
        }.`,
        timestamp: now,
      })
    } catch (logErr) {
      console.error("Failed to insert log on public member submit:", logErr)
    }

    const refreshed = await memberService.getMember(member.id)
    const missingFields = getMissingMemberFields(refreshed || { ...member, ...nextValues })

    return NextResponse.json({
      success: true,
      submittedAt: now,
      updatedFields: updatedLabels,
      member: buildPublicProfile(refreshed || { ...member, ...nextValues }),
      missingFields,
    })
  } catch (error: any) {
    console.error("Public member data POST error:", error)
    return NextResponse.json(
      { error: error.message || "Greška prilikom spremanja podataka." },
      { status: 500 }
    )
  }
}
