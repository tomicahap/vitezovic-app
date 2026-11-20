import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { MemberService } from "@/src/services/member-service"
import { SettingsService } from "@/src/services/settings-service"
import { DatabaseService, getAppDb } from "@/lib/database"
import { getMissingMemberFields } from "@/lib/member-missing-fields"
import { generateMemberPdfBuffer, sanitizePdfFileNamePart } from "@/lib/member-pdf"

export const dynamic = "force-dynamic"

const memberService = new MemberService()
const settingsService = new SettingsService()

function noStoreJson(body: any, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
    },
  })
}

function safeEqualSecret(a: string, b: string): boolean {
  if (!a || !b) return false
  const bufA = Buffer.from(a, "utf8")
  const bufB = Buffer.from(b, "utf8")
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

interface TokenDbRow {
  id: number
  data_form_token: string | null
  data_form_viewed_at: string | null
  data_form_submitted_at: string | null
  data_form_single_use: number | null
  data_form_session_nonce: string | null
}

function findMemberRowByToken(token: string): TokenDbRow | undefined {
  const db = getAppDb()
  return db
    .prepare(
      `SELECT id, data_form_token, data_form_viewed_at, data_form_submitted_at,
              COALESCE(data_form_single_use, 0) AS data_form_single_use,
              data_form_session_nonce
       FROM members
       WHERE data_form_token = ?
       LIMIT 1`
    )
    .get(token) as TokenDbRow | undefined
}

function clearMemberToken(memberId: number) {
  try {
    getAppDb()
      .prepare(
        `UPDATE members
         SET data_form_token = NULL,
             data_form_session_nonce = NULL,
             data_form_single_use = 0
         WHERE id = ?`
      )
      .run(memberId)
  } catch (err) {
    console.error("Failed to clear member form token:", err)
  }
}

async function checkMaintenanceBlocked(request: NextRequest): Promise<boolean> {
  const settings = (await settingsService.getSettings()) as any
  const isMaintenance = settings?.maintenanceMode === 1 || settings?.maintenanceMode === true
  if (!isMaintenance) return false
  const cookieRole = (request.cookies.get("hrd_urole")?.value || "").trim().toLowerCase()
  return cookieRole !== "admin"
}

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

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> | { token: string } }
) {
  try {
    if (await checkMaintenanceBlocked(request)) {
      return noStoreJson(
        { error: "Sustav se trenutno ažurira i nije mu moguće pristupiti. Kontaktirajte administratora.", maintenanceMode: true },
        503
      )
    }
    const resolved = await Promise.resolve(context.params)
    const token = String(resolved.token || "").trim()
    if (!token || token.length < 16) {
      return noStoreJson({ error: "Neispravna ili istekla poveznica.", code: "INVALID_TOKEN" }, 400)
    }

    const tokenRow = findMemberRowByToken(token)
    const member = tokenRow ? await memberService.getMember(tokenRow.id) : null

    if (!tokenRow || !member) {
      return noStoreJson(
        {
          error:
            "Ova poveznica nije važeća ili je već iskorištena. Pristup obrascu za dopunu podataka ograničen je na jedan ulaz te svaki sljedeći pristup nije dopušten. Ako trebate novu dopunu podataka, obratite se tajništvu Društva.",
          code: "TOKEN_INVALID_OR_USED",
        },
        410
      )
    }

    if (tokenRow.data_form_submitted_at && String(tokenRow.data_form_submitted_at).trim() !== "") {
      clearMemberToken(tokenRow.id)
      return noStoreJson(
        {
          error:
            "Vaši podaci su već predani. Ova poveznica je trajno poništena te ponovni pristup i izmjena podataka više nisu dopušteni.",
          code: "ALREADY_SUBMITTED",
        },
        410
      )
    }

    const now = new Date().toISOString()
    const isSingleUse = Number(tokenRow.data_form_single_use || 0) === 1

    if (isSingleUse) {
      if (tokenRow.data_form_viewed_at && String(tokenRow.data_form_viewed_at).trim() !== "") {
        try {
          DatabaseService.insertLog({
            userId: String(member.id),
            userName: member.name,
            userRole: member.role || "member",
            action: "Blokiran ponovljeni pristup obrascu za dopunu podataka",
            details: `Odbijen ponovljeni pristup jednokratnoj poveznici za člana ${member.name} (${member.email}).`,
            timestamp: now,
          })
        } catch {}
        return noStoreJson(
          {
            error:
              "Ova jednokratna poveznica je već iskorištena. Pristup je bio ograničen na samo jedan ulaz te svaki sljedeći pristup nije legalan niti dopušten. Ako trebate novu poveznicu za dopunu podataka, obratite se tajništvu Društva.",
            code: "SINGLE_USE_EXHAUSTED",
          },
          410
        )
      }

      const sessionNonce = crypto.randomBytes(24).toString("hex")
      const claim = getAppDb()
        .prepare(
          `UPDATE members
           SET data_form_viewed_at = ?,
               data_form_session_nonce = ?
           WHERE id = ?
             AND data_form_token = ?
             AND COALESCE(data_form_single_use, 0) = 1
             AND (data_form_viewed_at IS NULL OR TRIM(data_form_viewed_at) = '')
             AND (data_form_submitted_at IS NULL OR TRIM(data_form_submitted_at) = '')`
        )
        .run(now, sessionNonce, member.id, token)

      if (claim.changes === 0) {
        return noStoreJson(
          {
            error:
              "Ova jednokratna poveznica je već iskorištena. Pristup je ograničen na samo jedan ulaz te svaki sljedeći pristup nije legalan niti dopušten.",
            code: "SINGLE_USE_EXHAUSTED",
          },
          410
        )
      }

      member.dataFormViewedAt = now

      try {
        DatabaseService.insertLog({
          userId: String(member.id),
          userName: member.name,
          userRole: member.role || "member",
          action: "Pregled online forme za dopunu podataka",
          details: `Član ${member.name} (${member.email}) otvorio je jednokratnu online formu za dopunu podataka (1. i jedini dopušteni pristup).`,
          timestamp: now,
        })
      } catch (err) {
        console.error("Failed to record form view:", err)
      }

      const missingFields = getMissingMemberFields(member)
      return noStoreJson({
        member: buildPublicProfile(member),
        missingFields,
        singleUse: true,
        submitNonce: sessionNonce,
      })
    }

    // Postojeća (naslijeđena) poveznica poslana prije uvođenja jednokratnog zaključavanja:
    // ostaje važeća do trenutka predaje podataka.
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

    return noStoreJson({
      member: buildPublicProfile(member),
      missingFields,
      singleUse: false,
      submitNonce: null,
    })
  } catch (error: any) {
    console.error("Public member data GET error:", error)
    return noStoreJson(
      { error: error.message || "Interna greška poslužitelja." },
      500
    )
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> | { token: string } }
) {
  try {
    if (await checkMaintenanceBlocked(request)) {
      return noStoreJson(
        { error: "Sustav se trenutno ažurira i nije mu moguće pristupiti. Kontaktirajte administratora.", maintenanceMode: true },
        503
      )
    }
    const resolved = await Promise.resolve(context.params)
    const token = String(resolved.token || "").trim()
    if (!token || token.length < 16) {
      return noStoreJson({ error: "Neispravna poveznica.", code: "INVALID_TOKEN" }, 400)
    }

    const tokenRow = findMemberRowByToken(token)
    const member = tokenRow ? await memberService.getMember(tokenRow.id) : null
    if (!tokenRow || !member) {
      return noStoreJson(
        {
          error: "Poveznica je već iskorištena ili nije važeća. Podatke više nije moguće mijenjati putem ove poveznice.",
          code: "TOKEN_INVALID_OR_USED",
        },
        410
      )
    }

    if (tokenRow.data_form_submitted_at && String(tokenRow.data_form_submitted_at).trim() !== "") {
      clearMemberToken(tokenRow.id)
      return noStoreJson(
        {
          error: "Podaci su već predani i poveznica je trajno poništena.",
          code: "ALREADY_SUBMITTED",
        },
        410
      )
    }

    const payload = await request.json()
    const now = new Date().toISOString()
    const isSingleUse = Number(tokenRow.data_form_single_use || 0) === 1

    if (isSingleUse) {
      const providedNonce = String(payload.submitNonce || "").trim()
      const expectedNonce = String(tokenRow.data_form_session_nonce || "").trim()
      if (!safeEqualSecret(providedNonce, expectedNonce)) {
        try {
          DatabaseService.insertLog({
            userId: String(member.id),
            userName: member.name,
            userRole: member.role || "member",
            action: "Blokirana neovlaštena predaja dopune podataka",
            details: `Odbijen pokušaj predaje podataka s nevažećim ili ponovljenim pristupom za člana ${member.name} (${member.email}).`,
            timestamp: now,
          })
        } catch {}
        return noStoreJson(
          {
            error: "Neovlašten ili ponovljen pokušaj predaje podataka. Jednokratna poveznica više nije važeća.",
            code: "SINGLE_USE_EXHAUSTED",
          },
          403
        )
      }
    }

    // Atomičko poništenje tokena i zaključavanje predaje prije upisa podataka
    const db = getAppDb()
    const consumeRes = isSingleUse
      ? db
          .prepare(
            `UPDATE members
             SET data_form_token = NULL,
                 data_form_session_nonce = NULL,
                 data_form_single_use = 0,
                 data_form_submitted_at = ?,
                 data_form_viewed_at = COALESCE(NULLIF(TRIM(data_form_viewed_at), ''), ?)
             WHERE id = ?
               AND data_form_token = ?
               AND data_form_session_nonce = ?
               AND (data_form_submitted_at IS NULL OR TRIM(data_form_submitted_at) = '')`
          )
          .run(now, now, member.id, token, String(tokenRow.data_form_session_nonce || ""))
      : db
          .prepare(
            `UPDATE members
             SET data_form_token = NULL,
                 data_form_session_nonce = NULL,
                 data_form_single_use = 0,
                 data_form_submitted_at = ?,
                 data_form_viewed_at = COALESCE(NULLIF(TRIM(data_form_viewed_at), ''), ?)
             WHERE id = ?
               AND data_form_token = ?
               AND (data_form_submitted_at IS NULL OR TRIM(data_form_submitted_at) = '')`
          )
          .run(now, now, member.id, token)

    if (consumeRes.changes === 0) {
      return noStoreJson(
        {
          error: "Podaci su već predani i poveznica je poništena.",
          code: "ALREADY_SUBMITTED",
        },
        410
      )
    }

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

    await memberService.updateMember(member.id, {
      ...nextValues,
      initials: initials || member.initials,
      dataFormToken: null,
      dataFormSessionNonce: null,
      dataFormSingleUse: false,
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
        details: `Član ${combinedName} (${nextValues.email}) je popunio i predao online formu za dopunu podataka (jednokratna poveznica trajno je poništena). Ažurirana polja: ${
          updatedLabels.length > 0 ? updatedLabels.join(", ") : "potvrđeni postojeći podaci"
        }.`,
        timestamp: now,
      })
    } catch (logErr) {
      console.error("Failed to insert log on public member submit:", logErr)
    }

    const refreshed = await memberService.getMember(member.id)
    const finalMember = refreshed || { ...member, ...nextValues, dataFormSubmittedAt: now }
    const missingFields = getMissingMemberFields(finalMember)

    let pdfBase64: string | null = null
    let pdfFilename = ""
    try {
      const pdfBuffer = generateMemberPdfBuffer(finalMember)
      const cleanName = sanitizePdfFileNamePart(finalMember.name, `clan_${member.id}`)
      pdfFilename = `Evidencijski_list_${cleanName}.pdf`
      pdfBase64 = pdfBuffer.toString("base64")
    } catch (pdfErr) {
      console.error("Failed to build updated PDF on submit:", pdfErr)
    }

    return noStoreJson({
      success: true,
      submittedAt: now,
      updatedFields: updatedLabels,
      member: buildPublicProfile(finalMember),
      missingFields,
      linkInvalidated: true,
      pdfBase64,
      pdfFilename,
    })
  } catch (error: any) {
    console.error("Public member data POST error:", error)
    return noStoreJson(
      { error: error.message || "Greška prilikom spremanja podataka." },
      500
    )
  }
}
