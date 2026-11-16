import { NextRequest, NextResponse } from "next/server"
import { MemberService } from "@/src/services/member-service"
import { SettingsService } from "@/src/services/settings-service"
import { sendEmail } from "@/lib/mail"
import { DatabaseService } from "@/lib/database"
import { generateMemberPdfBuffer } from "@/lib/member-pdf"
import {
  formatMissingFieldsBullets,
  getMissingMemberFields,
} from "@/lib/member-missing-fields"

const memberService = new MemberService()
const settingsService = new SettingsService()

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export async function POST(request: NextRequest) {
  try {
    const settings = await settingsService.getSettings()
    if (!settings) {
      return NextResponse.json({ error: "Postavke sustava nisu pronađene." }, { status: 404 })
    }

    if (!settings.smtpHost || !settings.smtpFrom) {
      return NextResponse.json(
        { error: "SMTP poslužitelj nije konfiguriran u postavkama sustava." },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      memberIds,
      selectedFieldKeys,
      customSubject,
      customBody,
      sender,
    } = body

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json(
        { error: "Odaberite barem jednog člana kojem želite poslati e-mail." },
        { status: 400 }
      )
    }

    const allMembers = await memberService.getAllMembers()
    const idSet = new Set(memberIds.map((id: any) => Number(id)))
    const targets = allMembers.filter((m) => idSet.has(m.id))

    if (targets.length === 0) {
      return NextResponse.json({ error: "Nije pronađen niti jedan odabrani član." }, { status: 404 })
    }

    const defaultSubject =
      (settings as any).missingDataEmailSubject ||
      'Zamolba za dopunu članskih podataka - HRD "Pavao Ritter Vitezović"'
    const defaultBody =
      (settings as any).missingDataEmailBody ||
      'Poštovani/a {{name}},\n\nU tijeku je ažuriranje službene matične knjige Hrvatskog rodoslovnog društva "Pavao Ritter Vitezović". U privitku ove poruke šaljemo Vam Vaš trenutni evidencijski list u PDF formatu kako biste imali uvid u podatke koje trenutno imamo zabilježene.\n\nZa potpunu evidenciju u našem kartonu trenutno nam nedostaju sljedeći podaci:\n{{missingFields}}\n\nLjubazno Vas molimo da nam odgovorom na ovu poruku pošaljete podatke koji nedostaju (ili ispravke ako primijetite netočne podatke) kako bismo ažurirali Vaš karton.\n\nUnaprijed zahvaljujemo na suradnji!\n\nSrdačan pozdrav,\nTajništvo HRD "Pavao Ritter Vitezović"'

    const rawSubject = customSubject?.trim() || defaultSubject
    const rawBody = customBody?.trim() || defaultBody
    const now = new Date().toISOString()

    let sentCount = 0
    let errorCount = 0
    const errorsList: string[] = []
    const sentMemberIds: number[] = []

    for (const member of targets) {
      if (!member.email || !member.email.includes("@")) {
        errorCount++
        errorsList.push(`${member.name}: Nedostaje valjana email adresa.`)
        continue
      }

      try {
        const missing = getMissingMemberFields(member, selectedFieldKeys)
        const missingBullets = formatMissingFieldsBullets(missing)

        const memberSubject = rawSubject
          .replace(/{{name}}/gi, member.name)
          .replace(/{{ime}}/gi, member.name)

        const memberBody = rawBody
          .replace(/{{name}}/gi, member.name)
          .replace(/{{ime}}/gi, member.name)
          .replace(/{{missingFields}}/gi, missingBullets)
          .replace(/{{nedostaje}}/gi, missingBullets)

        const pdfBuffer = generateMemberPdfBuffer(member)
        const cleanName = String(member.name || `clan_${member.id}`)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]+/g, "_")
          .replace(/^_+|_+$/g, "")
        const pdfFilename = `Evidencijski_list_${cleanName || member.id}.pdf`

        const missingHtmlList =
          missing.length > 0
            ? `<ul style="margin: 8px 0 0; padding-left: 20px; color: #991B1B;">${missing
                .map((f) => `<li style="margin: 4px 0;"><strong>${escapeHtml(f.label)}</strong></li>`)
                .join("")}</ul>`
            : `<p style="margin: 6px 0 0; color: #065F46;">Svi traženi podaci su evidentirani — molimo provjerite priloženi PDF za eventualne ispravke.</p>`

        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1B2B36; background-color: #F2EFE9; margin: 0; padding: 24px; }
    .card { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E8E4DE; overflow: hidden; box-shadow: 0 4px 20px rgba(27, 43, 54, 0.08); }
    .header { background: #1B2B36; color: #ffffff; padding: 26px 32px; border-bottom: 3px solid #CEA369; text-align: left; }
    .header h2 { margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; }
    .header p { margin: 6px 0 0; font-size: 13px; color: #CEA369; font-weight: 500; }
    .content { padding: 32px; }
    .text { font-size: 14px; color: #334155; margin-bottom: 20px; line-height: 1.7; }
    .missing-box { background: #FEF2F2; border: 1px solid #FECACA; border-left: 4px solid #DC2626; border-radius: 10px; padding: 14px 18px; margin: 18px 0; font-size: 13px; }
    .attach-box { background: #FBF9F6; border: 1px solid #E8E4DE; border-left: 4px solid #CEA369; border-radius: 10px; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #1B2B36; }
    .footer { font-size: 13px; color: #6B7280; border-top: 1px solid #E8E4DE; padding-top: 20px; text-align: left; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>Hrvatsko rodoslovno društvo</h2>
      <p>&bdquo;Pavao Ritter Vitezović&rdquo; &mdash; Ažuriranje matične evidencije članova</p>
    </div>
    <div class="content">
      <div class="text">${escapeHtml(memberBody).replace(/\n/g, "<br>")}</div>
      <div class="missing-box">
        <strong style="color: #7F1D1D;">Sažetak podataka za dopunu (${missing.length}):</strong>
        ${missingHtmlList}
      </div>
      <div class="attach-box">
        <strong style="color: #9A6B2F;">Privitak:</strong> U privitku ove poruke nalazi se Vaš trenutni evidencijski list (<code>${escapeHtml(pdfFilename)}</code>) sa svim podacima koje imamo u našoj bazi.
      </div>
      <div class="footer">
        Hrvatsko rodoslovno društvo &bdquo;Pavao Ritter Vitezović&rdquo;<br>
        <span style="font-size: 12px; color: #9CA3AF;">Službena evidencija članstva</span>
      </div>
    </div>
  </div>
</body>
</html>`

        await sendEmail({
          to: member.email,
          subject: memberSubject,
          body: memberBody,
          html: htmlBody,
          config: settings,
          attachments: [
            {
              filename: pdfFilename,
              content: pdfBuffer,
              contentType: "application/pdf",
              contentDisposition: "attachment",
            },
          ],
        })

        try {
          await memberService.updateMember(member.id, {
            lastMissingDataEmailAt: now,
          })
        } catch (dbErr) {
          console.error(`Greška pri ažuriranju evidencije dopune podataka za člana ${member.id}:`, dbErr)
        }

        try {
          DatabaseService.insertLog({
            userId: sender?.userId || "system",
            userName: sender?.userName || "Administrator",
            userRole: sender?.userRole || "admin",
            action: "Slanje zamolbe za dopunu podataka",
            details: `Poslana zamolba za dopunu podataka (PDF u privitku) članu: ${member.name} (${member.email}). Nedostaje polja: ${missing.length}.`,
            timestamp: now,
          })
        } catch (logErr) {
          console.error(`Greška pri upisu aktivnosti za dopunu podataka člana ${member.id}:`, logErr)
        }

        sentCount++
        sentMemberIds.push(member.id)
      } catch (err: any) {
        console.error(`Neuspjelo slanje zamolbe članu ${member.email}:`, err)
        errorCount++
        errorsList.push(`${member.name} (${member.email}): ${err.message || "Greška"}`)
      }
    }

    if (sentCount === 0 && errorCount > 0) {
      return NextResponse.json(
        {
          success: false,
          count: 0,
          errors: errorCount,
          error: `Slanje nije uspjelo niti za jednog primatelja. ${errorsList[0] || "Provjerite SMTP postavke."}`,
          details: errorsList,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      count: sentCount,
      errors: errorCount,
      sentAt: now,
      sentMemberIds,
      message: `Uspješno poslano ${sentCount} personaliziranih e-mailova s PDF privitkom.${errorCount > 0 ? ` Neuspjelo: ${errorCount}.` : ""}`,
      details: errorsList,
    })
  } catch (error: any) {
    console.error("Missing data notification error:", error)
    return NextResponse.json(
      { error: error.message || "Interna greška poslužitelja." },
      { status: 500 }
    )
  }
}
