import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { MemberService } from "@/src/services/member-service"
import { SettingsService } from "@/src/services/settings-service"
import { sendEmail } from "@/lib/mail"
import { DatabaseService } from "@/lib/database"
import { generateMemberPdfBuffer, sanitizePdfFileNamePart } from "@/lib/member-pdf"
import {
  DEFAULT_MISSING_DATA_EMAIL_BODY,
  SINGLE_USE_LINK_EMAIL_NOTICE_HTML,
  ensureSingleUseNoticeInBody,
  formatMissingFieldsBullets,
  getMissingMemberFields,
} from "@/lib/member-missing-fields"
import { buildHrdMasterEmail, escapeHtml } from "@/lib/hrd-email-system"
import { DoNotContactBlockedError, formatDoNotContactError, getDoNotContactEmailSet } from "@/lib/do-not-contact"
import { abortableSleep, computeSafePacingMs, createNdjsonStreamResponse } from "@/lib/ndjson-stream"
import { resolveServerSenderIdentity } from "@/lib/sender-role-server"

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
      sender: rawSender,
      testOnly,
      testEmail,
      previewMemberId,
      stream,
    } = body

    const sender = resolveServerSenderIdentity(rawSender, settings)

    const allMembers = await memberService.getAllMembers()

    const defaultSubject =
      (settings as any).missingDataEmailSubject ||
      'Zamolba za dopunu članskih podataka — HRD „Pavao Ritter Vitezović”'
    const defaultBody =
      (settings as any).missingDataEmailBody || DEFAULT_MISSING_DATA_EMAIL_BODY

    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host
    const protocol = request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
    const origin = `${protocol}://${host}`

    const rawSubject = customSubject?.trim() || defaultSubject
    const rawBody = customBody?.trim() || defaultBody
    const now = new Date().toISOString()

    if (testOnly) {
      const allowedSampleMembers = allMembers.filter((m) => !m.doNotContact)
      const sampleMember =
        (previewMemberId ? allowedSampleMembers.find((m) => m.id === Number(previewMemberId)) : null) ||
        (Array.isArray(memberIds) && memberIds.length > 0
          ? allowedSampleMembers.find((m) => m.id === Number(memberIds[0]))
          : null) ||
        allowedSampleMembers[0] || {
          id: 1,
          name: "Ivan Horvat",
          email: settings.smtpFrom,
        }

      // Testni mail nikad ne koristi niti mijenja stvarni token člana u bazi
      const token = "test-jednokratna-poveznica-pregled"
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

      const memberBody = ensureSingleUseNoticeInBody(
        rawWithToken
          .replace(/{{name}}/gi, sampleMember.name)
          .replace(/{{ime}}/gi, sampleMember.name)
          .replace(/{{missingFields}}/gi, missingBullets)
          .replace(/{{nedostaje}}/gi, missingBullets)
          .replace(/{{formLink}}/gi, formLink)
          .replace(/{{link}}/gi, formLink)
      )

      const pdfBuffer = generateMemberPdfBuffer(sampleMember)
      const cleanName = sanitizePdfFileNamePart(sampleMember.name, "clan")
      const pdfFilename = `Evidencijski_list_${cleanName}.pdf`

      const missingHtmlList =
        missing.length > 0
          ? `<ul style="margin: 6px 0 0; padding-left: 18px; color: #7C2D12;">${missing
              .map((f) => `<li style="margin: 3px 0;"><strong>${escapeHtml(f.label)}</strong></li>`)
              .join("")}</ul>`
          : `<div>Svi traženi podaci su već evidentirani — molimo provjerite priloženi PDF za eventualne ispravke.</div>`

      const built = buildHrdMasterEmail({
        templateType: "obavijest_clanovima",
        title: memberSubject,
        subtitle: "Ažuriranje matične evidencije članova",
        bodyTextOrHtml: memberBody,
        infoBoxTitle: `Sažetak podataka za dopunu (${missing.length})`,
        infoBoxHtml: `${missingHtmlList}${SINGLE_USE_LINK_EMAIL_NOTICE_HTML}<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #E2E8F0;"><strong>Privitak:</strong> U privitku se nalazi Vaš trenutni evidencijski list (<code>${escapeHtml(
          pdfFilename
        )}</code>).</div>`,
        ctaText: "Otvori osobni obrazac i dopuni podatke (1 pristup)",
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
        message: `Testni e-mail s PDF privitkom i jednokratnim linkom (za člana ${sampleMember.name}) poslan je na ${targetRecipient}.`,
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
    let targets = allMembers.filter((m) => idSet.has(m.id))

    if (targets.length === 0) {
      return NextResponse.json({ error: "Nije pronađen niti jedan odabrani član." }, { status: 404 })
    }

    if (targets.length === 1 && targets[0]?.doNotContact) {
      const m = targets[0]
      return NextResponse.json(
        {
          error: formatDoNotContactError([
            {
              id: m.id,
              name: m.name,
              email: m.email || "",
              doNotContactDate: m.doNotContactDate || "",
              doNotContactNote: m.doNotContactNote || "",
            },
          ]),
        },
        { status: 403 }
      )
    }

    const blockedEmails = getDoNotContactEmailSet()
    const beforeFilterCount = targets.length
    targets = targets.filter((m) => {
      if (!m || m.doNotContact) return false
      const emailLower = String(m.email || "").trim().toLowerCase()
      if (emailLower && blockedEmails.has(emailLower)) return false
      return true
    })
    const skippedDoNotContactCount = beforeFilterCount - targets.length

    if (targets.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nema dopuštenih primatelja — svi odabrani članovi na izričitu su napomenu zatražili da ih se ne kontaktira.",
        },
        { status: 403 }
      )
    }

    const runSending = async (emit?: (obj: Record<string, any>) => void) => {
      let sentCount = 0
      let errorCount = 0
      let processedCount = 0
      let cancelled = false
      const errorsList: string[] = []
      const sentMembersInfo: Array<{ id: number; token: string }> = []
      const total = targets.length
      const delayMs = computeSafePacingMs(total)

      emit?.({
        type: "start",
        total,
        skipped: skippedDoNotContactCount,
        delayMs,
        startedAt: new Date().toISOString(),
      })

      for (let i = 0; i < targets.length; i++) {
        if (request.signal.aborted) {
          cancelled = true
          break
        }

        const member = targets[i]
        emit?.({
          type: "progress",
          total,
          processed: processedCount,
          sent: sentCount,
          failed: errorCount,
          skipped: skippedDoNotContactCount,
          currentName: member.name,
          currentEmail: member.email || "",
          delayMs,
        })

        if (!member.email || !member.email.includes("@")) {
          errorCount++
          processedCount++
          const msg = `${member.name}: Nedostaje valjana email adresa.`
          errorsList.push(msg)
          emit?.({
            type: "progress",
            total,
            processed: processedCount,
            sent: sentCount,
            failed: errorCount,
            skipped: skippedDoNotContactCount,
            currentName: member.name,
            currentEmail: member.email || "",
            lastError: msg,
          })
          continue
        }

        try {
          // Uvijek izdajemo potpuno novu jednokratnu poveznicu za svaki poslani podsjetnik
          const token = crypto.randomBytes(24).toString("hex")
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

          const memberBody = ensureSingleUseNoticeInBody(
            rawWithToken
              .replace(/{{name}}/gi, member.name)
              .replace(/{{ime}}/gi, member.name)
              .replace(/{{missingFields}}/gi, missingBullets)
              .replace(/{{nedostaje}}/gi, missingBullets)
              .replace(/{{formLink}}/gi, formLink)
              .replace(/{{link}}/gi, formLink)
          )

          const pdfBuffer = generateMemberPdfBuffer(member)
          const cleanName = sanitizePdfFileNamePart(member.name, `clan_${member.id}`)
          const pdfFilename = `Evidencijski_list_${cleanName}.pdf`

          const missingHtmlList =
            missing.length > 0
              ? `<ul style="margin: 6px 0 0; padding-left: 18px; color: #7C2D12;">${missing
                  .map((f) => `<li style="margin: 3px 0;"><strong>${escapeHtml(f.label)}</strong></li>`)
                  .join("")}</ul>`
              : `<div>Svi traženi podaci su već evidentirani — molimo provjerite priloženi PDF za eventualne ispravke.</div>`

          const built = buildHrdMasterEmail({
            templateType: "obavijest_clanovima",
            title: memberSubject,
            subtitle: "Ažuriranje matične evidencije članova",
            bodyTextOrHtml: memberBody,
            infoBoxTitle: `Sažetak podataka za dopunu (${missing.length})`,
            infoBoxHtml: `${missingHtmlList}${SINGLE_USE_LINK_EMAIL_NOTICE_HTML}<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #E2E8F0;"><strong>Privitak:</strong> U privitku se nalazi Vaš trenutni evidencijski list (<code>${escapeHtml(
              pdfFilename
            )}</code>).</div>`,
            ctaText: "Otvori osobni obrazac i dopuni podatke (1 pristup)",
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
              dataFormSingleUse: true,
              dataFormSessionNonce: null,
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
              details: `Poslana zamolba za dopunu podataka (jednokratni link [1 pristup] + PDF) članu: ${member.name} (${member.email}). Nedostaje polja: ${missing.length}.`,
              timestamp: now,
            })
          } catch (logErr) {
            console.error(`Greška pri upisu aktivnosti za dopunu podataka člana ${member.id}:`, logErr)
          }

          sentCount++
          processedCount++
          sentMembersInfo.push({ id: member.id, token })
          emit?.({
            type: "progress",
            total,
            processed: processedCount,
            sent: sentCount,
            failed: errorCount,
            skipped: skippedDoNotContactCount,
            currentName: member.name,
            currentEmail: member.email,
          })
        } catch (err: any) {
          console.error(`Neuspjelo slanje zamolbe članu ${member.email}:`, err)
          errorCount++
          processedCount++
          const errMsg = `${member.name} (${member.email}): ${err.message || "Greška"}`
          errorsList.push(errMsg)
          emit?.({
            type: "progress",
            total,
            processed: processedCount,
            sent: sentCount,
            failed: errorCount,
            skipped: skippedDoNotContactCount,
            currentName: member.name,
            currentEmail: member.email,
            lastError: errMsg,
          })
        }

        if (i < targets.length - 1 && delayMs > 0) {
          const ok = await abortableSleep(delayMs, request.signal)
          if (!ok) {
            cancelled = true
            break
          }
        }
      }

      if (sentCount === 0 && errorCount > 0 && !cancelled) {
        return {
          status: 500,
          payload: {
            success: false,
            count: 0,
            errors: errorCount,
            error: `Slanje nije uspjelo niti za jednog primatelja. ${errorsList[0] || "Provjerite SMTP postavke."}`,
            details: errorsList,
          },
        }
      }

      return {
        status: 200,
        cancelled,
        payload: {
          success: true,
          cancelled,
          count: sentCount,
          errors: errorCount,
          skippedDoNotContactCount,
          sentAt: now,
          sentMemberIds: sentMembersInfo.map((x) => x.id),
          sentMembersInfo,
          message: cancelled
            ? `Slanje je zaustavljeno. Poslano ${sentCount} od ${total} personaliziranih e-mailova.${errorCount > 0 ? ` Neuspjelo: ${errorCount}.` : ""}`
            : `Uspješno poslano ${sentCount} personaliziranih e-mailova (link za dopunu + PDF privitak).${errorCount > 0 ? ` Neuspjelo: ${errorCount}.` : ""}${skippedDoNotContactCount > 0 ? ` Preskočeno zbog zabrane kontakta: ${skippedDoNotContactCount}.` : ""}`,
          details: errorsList,
        },
      }
    }

    if (stream) {
      return createNdjsonStreamResponse(async (emit) => {
        const outcome = await runSending(emit)
        if (!outcome.payload.success) {
          emit({ type: "error", error: outcome.payload.error, details: outcome.payload.details })
          return
        }
        emit({
          type: "done",
          cancelled: Boolean(outcome.cancelled),
          sent: outcome.payload.count,
          failed: outcome.payload.errors,
          skipped: outcome.payload.skippedDoNotContactCount || 0,
          processed: (outcome.payload.count || 0) + (outcome.payload.errors || 0),
          total: targets.length,
          finishedAt: new Date().toISOString(),
          result: outcome.payload,
        })
      })
    }

    const outcome = await runSending()
    return NextResponse.json(outcome.payload, { status: outcome.status })
  } catch (error: any) {
    if (error instanceof DoNotContactBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error("Missing data notification error:", error)
    return NextResponse.json(
      { error: error.message || "Interna greška poslužitelja." },
      { status: 500 }
    )
  }
}
