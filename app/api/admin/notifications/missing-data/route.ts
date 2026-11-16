import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { MemberService } from "@/src/services/member-service"
import { SettingsService } from "@/src/services/settings-service"
import { sendEmail } from "@/lib/mail"
import { DatabaseService } from "@/lib/database"
import { generateMemberPdfBuffer } from "@/lib/member-pdf"
import {
  formatMissingFieldsBullets,
  getMissingMemberFields,
} from "@/lib/member-missing-fields"
import { buildHrdMasterEmail, escapeHtml } from "@/lib/hrd-email-system"

const memberService = new MemberService()
const settingsService = new SettingsService()

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
      testOnly,
      testEmail,
      previewMemberId,
    } = body

    const allMembers = await memberService.getAllMembers()

    const defaultSubject =
      (settings as any).missingDataEmailSubject ||
      'Zamolba za dopunu članskih podataka — HRD „Pavao Ritter Vitezović”'
    const defaultBody =
      (settings as any).missingDataEmailBody ||
      'Poštovani/a {{name}},\n\nU tijeku je ažuriranje službene matične knjige Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović”. U privitku ove poruke šaljemo Vam Vaš trenutni evidencijski list u PDF formatu kako biste imali uvid u podatke koje trenutno imamo zabilježene.\n\nZa potpunu evidenciju u našem kartonu trenutno nam nedostaju sljedeći podaci:\n{{missingFields}}\n\nPodatke možete najbrže dopuniti i provjeriti klikom na Vašu osobnu poveznicu:\n{{formLink}}\n\nAlternativno, možete nam odgovoriti i na ovu poruku. Unaprijed zahvaljujemo na suradnji!'

    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host
    const protocol = request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
    const origin = `${protocol}://${host}`

    const rawSubject = customSubject?.trim() || defaultSubject
    const rawBody = customBody?.trim() || defaultBody
    const now = new Date().toISOString()

    if (testOnly) {
      const sampleMember =
        (previewMemberId ? allMembers.find((m) => m.id === Number(previewMemberId)) : null) ||
        (Array.isArray(memberIds) && memberIds.length > 0
          ? allMembers.find((m) => m.id === Number(memberIds[0]))
          : null) ||
        allMembers[0] || {
          id: 1,
          name: "Ivan Horvat",
          email: settings.smtpFrom,
        }

      const token =
        sampleMember.dataFormToken && String(sampleMember.dataFormToken).length >= 16
          ? String(sampleMember.dataFormToken)
          : crypto.randomBytes(24).toString("hex")
      if (sampleMember.id && !sampleMember.dataFormToken) {
        try {
          await memberService.updateMember(sampleMember.id, { dataFormToken: token })
        } catch {}
      }

      const formLink = `${origin}/dopuna-podataka/${token}`
      const missing = getMissingMemberFields(sampleMember, selectedFieldKeys)
      const missingBullets = formatMissingFieldsBullets(missing)

      const memberSubject = rawSubject
        .replace(/{{name}}/gi, sampleMember.name)
        .replace(/{{ime}}/gi, sampleMember.name)

      const rawWithToken =
        rawBody.includes("{{formLink}}") || rawBody.includes("{{link}}")
          ? rawBody
          : `${rawBody}\n\nPoveznica za brzu online dopunu podataka:\n${formLink}`

      const memberBody = rawWithToken
        .replace(/{{name}}/gi, sampleMember.name)
        .replace(/{{ime}}/gi, sampleMember.name)
        .replace(/{{missingFields}}/gi, missingBullets)
        .replace(/{{nedostaje}}/gi, missingBullets)
        .replace(/{{formLink}}/gi, formLink)
        .replace(/{{link}}/gi, formLink)

      const pdfBuffer = generateMemberPdfBuffer(sampleMember)
      const cleanName = String(sampleMember.name || "clan")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/^_+|_+$/g, "")
      const pdfFilename = `Evidencijski_list_${cleanName}.pdf`

      const missingHtmlList =
        missing.length > 0
          ? `<ul style="margin: 6px 0 0; padding-left: 18px; color: #704C3A;">${missing
              .map((f) => `<li style="margin: 3px 0;"><strong>${escapeHtml(f.label)}</strong></li>`)
              .join("")}</ul>`
          : `<div>Svi traženi podaci su već evidentirani — molimo provjerite priloženi PDF za eventualne ispravke.</div>`

      const built = buildHrdMasterEmail({
        templateType: "obavijest_clanovima",
        title: memberSubject,
        subtitle: "Ažuriranje matične evidencije članova",
        bodyTextOrHtml: memberBody,
        infoBoxTitle: `Sažetak podataka za dopunu (${missing.length})`,
        infoBoxHtml: `${missingHtmlList}<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #B6AA94;"><strong>Privitak:</strong> U privitku se nalazi Vaš trenutni evidencijski list (<code>${escapeHtml(
          pdfFilename
        )}</code>).</div>`,
        ctaText: "Otvori osobni obrazac i dopuni podatke",
        ctaUrl: formLink,
        settings,
        sender,
      })

      const targetRecipient = testEmail?.trim() || settings.smtpFrom

      await sendEmail({
        to: targetRecipient,
        subject: `[TEST] ${memberSubject}`,
        body: built.plainText,
        html: built.html,
        config: settings,
        attachments: [
          ...built.inlineAttachments,
          {
            filename: pdfFilename,
            content: pdfBuffer,
            contentType: "application/pdf",
            contentDisposition: "attachment",
          },
        ],
      })

      return NextResponse.json({
        success: true,
        testOnly: true,
        count: 1,
        errors: 0,
        sentAt: now,
        message: `Testni e-mail s PDF privitkom i linkom (za člana ${sampleMember.name}) poslan je na ${targetRecipient}.`,
        warnings: built.warnings,
      })
    }

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json(
        { error: "Odaberite barem jednog člana kojem želite poslati e-mail." },
        { status: 400 }
      )
    }

    const idSet = new Set(memberIds.map((id: any) => Number(id)))
    const targets = allMembers.filter((m) => idSet.has(m.id))

    if (targets.length === 0) {
      return NextResponse.json({ error: "Nije pronađen niti jedan odabrani član." }, { status: 404 })
    }

    let sentCount = 0
    let errorCount = 0
    const errorsList: string[] = []
    const sentMembersInfo: Array<{ id: number; token: string }> = []

    for (const member of targets) {
      if (!member.email || !member.email.includes("@")) {
        errorCount++
        errorsList.push(`${member.name}: Nedostaje valjana email adresa.`)
        continue
      }

      try {
        const token =
          member.dataFormToken && String(member.dataFormToken).length >= 16
            ? String(member.dataFormToken)
            : crypto.randomBytes(24).toString("hex")
        const formLink = `${origin}/dopuna-podataka/${token}`

        const missing = getMissingMemberFields(member, selectedFieldKeys)
        const missingBullets = formatMissingFieldsBullets(missing)

        const memberSubject = rawSubject
          .replace(/{{name}}/gi, member.name)
          .replace(/{{ime}}/gi, member.name)

        const rawWithToken =
          rawBody.includes("{{formLink}}") || rawBody.includes("{{link}}")
            ? rawBody
            : `${rawBody}\n\nPoveznica za brzu online dopunu podataka:\n${formLink}`

        const memberBody = rawWithToken
          .replace(/{{name}}/gi, member.name)
          .replace(/{{ime}}/gi, member.name)
          .replace(/{{missingFields}}/gi, missingBullets)
          .replace(/{{nedostaje}}/gi, missingBullets)
          .replace(/{{formLink}}/gi, formLink)
          .replace(/{{link}}/gi, formLink)

        const pdfBuffer = generateMemberPdfBuffer(member)
        const cleanName = String(member.name || `clan_${member.id}`)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]+/g, "_")
          .replace(/^_+|_+$/g, "")
        const pdfFilename = `Evidencijski_list_${cleanName || member.id}.pdf`

        const missingHtmlList =
          missing.length > 0
            ? `<ul style="margin: 6px 0 0; padding-left: 18px; color: #704C3A;">${missing
                .map((f) => `<li style="margin: 3px 0;"><strong>${escapeHtml(f.label)}</strong></li>`)
                .join("")}</ul>`
            : `<div>Svi traženi podaci su već evidentirani — molimo provjerite priloženi PDF za eventualne ispravke.</div>`

        const built = buildHrdMasterEmail({
          templateType: "obavijest_clanovima",
          title: memberSubject,
          subtitle: "Ažuriranje matične evidencije članova",
          bodyTextOrHtml: memberBody,
          infoBoxTitle: `Sažetak podataka za dopunu (${missing.length})`,
          infoBoxHtml: `${missingHtmlList}<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #B6AA94;"><strong>Privitak:</strong> U privitku se nalazi Vaš trenutni evidencijski list (<code>${escapeHtml(
            pdfFilename
          )}</code>).</div>`,
          ctaText: "Otvori osobni obrazac i dopuni podatke",
          ctaUrl: formLink,
          settings,
          sender,
        })

        await sendEmail({
          to: member.email,
          subject: memberSubject,
          body: built.plainText,
          html: built.html,
          config: settings,
          attachments: [
            ...built.inlineAttachments,
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
            dataFormToken: token,
            dataFormViewedAt: null,
            dataFormSubmittedAt: null,
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
            details: `Poslana zamolba za dopunu podataka (link + PDF) članu: ${member.name} (${member.email}). Nedostaje polja: ${missing.length}.`,
            timestamp: now,
          })
        } catch (logErr) {
          console.error(`Greška pri upisu aktivnosti za dopunu podataka člana ${member.id}:`, logErr)
        }

        sentCount++
        sentMembersInfo.push({ id: member.id, token })
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
      sentMemberIds: sentMembersInfo.map((x) => x.id),
      sentMembersInfo,
      message: `Uspješno poslano ${sentCount} personaliziranih e-mailova (link za dopunu + PDF privitak).${errorCount > 0 ? ` Neuspjelo: ${errorCount}.` : ""}`,
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
