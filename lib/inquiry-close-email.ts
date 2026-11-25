import {
  buildHrdMasterEmail,
  escapeHtml,
  formatHrdEmailDate,
  type SenderIdentityInput,
} from "./hrd-email-system"

export interface InquiryCloseEmailInput {
  id: number
  subject: string
  requesterName: string
  requesterEmail?: string | null
  researcherName?: string | null
  researcherEmail?: string | null
  inquiryDate?: string | null
  closedDate?: string | Date | null
  closedByName?: string | null
  closingNote?: string | null
}

export type InquiryCloseRecipientRole = "requester" | "researcher"

export type BuiltInquiryCloseEmail = ReturnType<typeof buildHrdMasterEmail> & {
  subject: string
}

export function buildInquiryClosedEmail(params: {
  role: InquiryCloseRecipientRole
  inquiry: InquiryCloseEmailInput
  settings?: any
  sender?: SenderIdentityInput | null
  forBrowserPreview?: boolean
}): BuiltInquiryCloseEmail {
  const { role, inquiry, settings, sender, forBrowserPreview = false } = params
  const receivedDateLabel = inquiry.inquiryDate ? formatHrdEmailDate(inquiry.inquiryDate) : "—"
  const closedDateLabel = formatHrdEmailDate(inquiry.closedDate || new Date())
  const safeSubject = String(inquiry.subject || "Rodoslovni upit").trim()
  const noteTrimmed = String(inquiry.closingNote || "").trim()

  if (role === "requester") {
    const emailSubject = `Obavijest o zatvaranju istraživačkog predmeta #${inquiry.id}: ${safeSubject}`
    const bodyParagraphs = [
      `obavještavamo Vas da je Vaš istraživački predmet #${inquiry.id} („${safeSubject}”) službeno zatvoren i trajno zaključen u evidenciji Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović”.`,
      `Nakon zatvaranja predmeta daljnji rad i izmjene unutar ovog predmeta više nisu mogući.`,
      ...(noteTrimmed ? [`Završna napomena: ${noteTrimmed}`] : []),
      `Ako u bilo kojem trenutku bude potrebno nešto promijeniti, dopuniti ili doraditi vezano uz ovo istraživanje, ljubazno Vas molimo da nam ponovno pošaljete novi upit kako bismo otvorili novi predmet.`,
    ]

    const infoBoxHtml = `
      <div><strong>Broj predmeta:</strong> #${inquiry.id}</div>
      <div><strong>Predmet istraživanja:</strong> ${escapeHtml(safeSubject)}</div>
      <div><strong>Datum zaprimanja:</strong> ${escapeHtml(receivedDateLabel)}</div>
      <div><strong>Datum zatvaranja:</strong> ${escapeHtml(closedDateLabel)}</div>
      ${inquiry.researcherName ? `<div><strong>Dodijeljeni istraživač:</strong> ${escapeHtml(inquiry.researcherName)}</div>` : ""}
      <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #E2E8F0; color: #7C2D12;">
        <strong>Napomena:</strong> Ovaj predmet je trajno zaključan. Za eventualne promjene ili dorade molimo pošaljite <strong>novi upit</strong>.
      </div>
    `

    const built = buildHrdMasterEmail({
      templateType: "sluzbena_obavijest",
      title: `Istraživački predmet #${inquiry.id} je zatvoren`,
      greeting: `Poštovani/a ${inquiry.requesterName || "podnositelju upita"},`,
      bodyTextOrHtml: bodyParagraphs.join("\n\n"),
      infoBoxTitle: "Podaci o zatvorenom predmetu",
      infoBoxHtml,
      closingText: "Srdačan pozdrav i hvala na povjerenju,",
      settings,
      sender,
      forBrowserPreview,
    })

    return { ...built, subject: emailSubject }
  }

  const emailSubject = `Obavijest istraživaču — Zatvoren predmet #${inquiry.id}: ${safeSubject}`
  const bodyParagraphs = [
    `obavještavamo Vas da je istraživački predmet #${inquiry.id} („${safeSubject}”) za podnositelja ${inquiry.requesterName || "—"} službeno zatvoren i trajno zaključan u sustavu „Rodoslovac”.`,
    `Nakon zatvaranja daljnji rad i izmjene na ovom predmetu više nisu mogući (predmet ostaje dostupan isključivo za uvid).`,
    ...(noteTrimmed ? [`Završna napomena: ${noteTrimmed}`] : []),
    `Podnositelj upita automatski je obaviješten e-mailom o zatvaranju predmeta te je zamoljen da, u slučaju potrebe za promjenom ili doradom, ponovno pošalje novi upit.`,
  ]

  const infoBoxHtml = `
    <div><strong>Broj predmeta:</strong> #${inquiry.id}</div>
    <div><strong>Predmet istraživanja:</strong> ${escapeHtml(safeSubject)}</div>
    <div><strong>Podnositelj upita:</strong> ${escapeHtml(inquiry.requesterName || "—")}</div>
    <div><strong>Datum zaprimanja:</strong> ${escapeHtml(receivedDateLabel)}</div>
    <div><strong>Datum zatvaranja:</strong> ${escapeHtml(closedDateLabel)}</div>
    ${inquiry.closedByName ? `<div><strong>Predmet zatvorio/la:</strong> ${escapeHtml(inquiry.closedByName)}</div>` : ""}
    <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #E2E8F0; color: #7C2D12;">
      <strong>Status zaključavanja:</strong> Trajno zatvoreno — nastavak rada nije moguć (za dorade se šalje novi upit).
    </div>
  `

  const built = buildHrdMasterEmail({
    templateType: "sluzbena_obavijest",
    title: `Zatvoren istraživački predmet #${inquiry.id}`,
    greeting: `Poštovani/a ${inquiry.researcherName || "istraživaču"},`,
    bodyTextOrHtml: bodyParagraphs.join("\n\n"),
    infoBoxTitle: "Sažetak zatvaranja predmeta",
    infoBoxHtml,
    closingText: "Hvala na uloženom trudu i suradnji,",
    settings,
    sender,
    forBrowserPreview,
  })

  return { ...built, subject: emailSubject }
}
