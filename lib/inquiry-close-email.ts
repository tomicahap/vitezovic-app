import {
  buildHrdMasterEmail,
  escapeHtml,
  formatHrdEmailDate,
  type SenderIdentityInput,
} from "./hrd-email-system"

export const INQUIRY_ARCHIVE_EMAIL = "rodoslovlje@rodoslovlje.hr"

export interface InquiryCloseEmailInput {
  id: number
  subject: string
  requesterName: string
  requesterContact?: string | null
  requesterEmail?: string | null
  researcherName?: string | null
  researcherEmail?: string | null
  inquiryDate?: string | null
  closedDate?: string | Date | null
  closedByName?: string | null
  closingNote?: string | null
  actionsTaken?: string | null
  collectedDocuments?: string | null
  researchResult?: string | null
  attachmentsCount?: number
}

export type InquiryCloseRecipientRole = "requester" | "researcher" | "archive"

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

  if (role === "archive") {
    const emailSubject = `ARHIVA — Zatvoren istraživački predmet #${inquiry.id}: ${safeSubject}`
    const bodyParagraphs = [
      `U arhivu Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović” dostavlja se automatski sažetak trajno zatvorenog istraživačkog predmeta #${inquiry.id} („${safeSubject}”).`,
      `Predmet je trajno zaključan u sustavu „Rodoslovac” (daljnje izmjene na ovom predmetu nisu moguće), a obavijesti su automatski upućene podnositelju upita i dodijeljenom istraživaču.`,
      ...(noteTrimmed ? [`Završna napomena pri zatvaranju: ${noteTrimmed}`] : []),
    ]

    const resultTrimmed = String(inquiry.researchResult || "").trim()
    const actionsTrimmed = String(inquiry.actionsTaken || "").trim()
    const docsTrimmed = String(inquiry.collectedDocuments || "").trim()
    const requesterContactLabel = [inquiry.requesterEmail, inquiry.requesterContact]
      .filter((v, idx, arr) => v && String(v).trim() && arr.indexOf(v) === idx)
      .join(" • ")

    const infoBoxHtml = `
      <div><strong>Broj predmeta:</strong> #${inquiry.id}</div>
      <div><strong>Predmet istraživanja:</strong> ${escapeHtml(safeSubject)}</div>
      <div><strong>Naručitelj / podnositelj:</strong> ${escapeHtml(inquiry.requesterName || "—")}${
        requesterContactLabel ? ` (${escapeHtml(requesterContactLabel)})` : ""
      }</div>
      <div><strong>Datum zaprimanja:</strong> ${escapeHtml(receivedDateLabel)}</div>
      <div><strong>Dodijeljeni istraživač:</strong> ${
        inquiry.researcherName
          ? `${escapeHtml(inquiry.researcherName)}${
              inquiry.researcherEmail ? ` (${escapeHtml(inquiry.researcherEmail)})` : ""
            }`
          : "Nije dodijeljen"
      }</div>
      <div><strong>Datum zatvaranja:</strong> ${escapeHtml(closedDateLabel)}</div>
      ${inquiry.closedByName ? `<div><strong>Predmet zatvorio/la:</strong> ${escapeHtml(inquiry.closedByName)}</div>` : ""}
      <div><strong>Broj priloženih datoteka u predmetu:</strong> ${Number(inquiry.attachmentsCount || 0)}</div>
      ${
        resultTrimmed
          ? `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #E2E8F0;"><strong>Zaključak / rezultat istraživanja:</strong><br/>${escapeHtml(
              resultTrimmed
            ).replace(/\n/g, "<br/>")}</div>`
          : ""
      }
      ${
        actionsTrimmed
          ? `<div style="margin-top: 6px;"><strong>Poduzete radnje:</strong><br/>${escapeHtml(
              actionsTrimmed
            ).replace(/\n/g, "<br/>")}</div>`
          : ""
      }
      ${
        docsTrimmed
          ? `<div style="margin-top: 6px;"><strong>Prikupljeni dokumenti i izvori:</strong><br/>${escapeHtml(
              docsTrimmed
            ).replace(/\n/g, "<br/>")}</div>`
          : ""
      }
    `

    const built = buildHrdMasterEmail({
      templateType: "sluzbena_obavijest",
      title: `Arhivski zapis zatvorenog predmeta #${inquiry.id}`,
      greeting: "Poštovana arhivo Društva,",
      bodyTextOrHtml: bodyParagraphs.join("\n\n"),
      infoBoxTitle: "Arhivski podaci istraživačkog predmeta",
      infoBoxHtml,
      closingText: "Automatska arhivska evidencija sustava „Rodoslovac”,",
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
