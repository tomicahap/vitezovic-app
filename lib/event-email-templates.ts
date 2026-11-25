import {
  escapeHtml,
  formatHrdEmailDate,
  formatHrdEmailTime,
  type HrdEmailTemplateTypeId,
} from "./hrd-email-system"

export interface EventNotificationItem {
  id?: number | string
  title: string
  type?: string
  date: string
  time?: string
  start_time?: string
  location?: string
  host?: string
  status?: string
}

export type ResolvedEventKindKey =
  | "meeting"
  | "gathering"
  | "visit"
  | "workshop"
  | "excursion"
  | "lecture"

export interface ResolvedEventKind {
  key: ResolvedEventKindKey
  isMeeting: boolean
  isGathering: boolean
  typeLabel: string
  genitiveLabel: string
}

export function resolveEventKind(
  type: "meeting" | "lecture",
  item: Pick<EventNotificationItem, "title" | "type">
): ResolvedEventKind {
  if (type === "meeting") {
    return {
      key: "meeting",
      isMeeting: true,
      isGathering: false,
      typeLabel: "Sjednica",
      genitiveLabel: "sjednici",
    }
  }

  const rawType = String(item.type || "").trim().toLowerCase()
  const rawTitle = String(item.title || "").trim().toLowerCase()

  if (
    rawType === "gathering" ||
    rawType === "druzenje" ||
    rawType === "druženje" ||
    rawTitle.includes("druženje") ||
    rawTitle.includes("druzenje") ||
    rawTitle.includes("rodoslovno")
  ) {
    return {
      key: "gathering",
      isMeeting: false,
      isGathering: true,
      typeLabel: "Rodoslovno druženje",
      genitiveLabel: "rodoslovnom druženju",
    }
  }

  if (rawType === "visit" || rawType === "gostovanje") {
    return {
      key: "visit",
      isMeeting: false,
      isGathering: false,
      typeLabel: "Gostovanje",
      genitiveLabel: "gostovanju",
    }
  }

  if (rawType === "workshop" || rawType === "radionica") {
    return {
      key: "workshop",
      isMeeting: false,
      isGathering: false,
      typeLabel: "Radionica",
      genitiveLabel: "radionici",
    }
  }

  if (rawType === "excursion" || rawType === "izlet") {
    return {
      key: "excursion",
      isMeeting: false,
      isGathering: false,
      typeLabel: "Izlet / ekskurzija",
      genitiveLabel: "izletu",
    }
  }

  return {
    key: "lecture",
    isMeeting: false,
    isGathering: false,
    typeLabel: "Predavanje",
    genitiveLabel: "predavanju",
  }
}

export interface DefaultEventEmailContent {
  subject: string
  body: string
  templateType: HrdEmailTemplateTypeId
  infoBoxTitle: string
  kind: ResolvedEventKind
}

export function getDefaultEventEmailContent(
  type: "meeting" | "lecture",
  item: EventNotificationItem
): DefaultEventEmailContent {
  const kind = resolveEventKind(type, item)
  const isCompleted = item.status === "completed"
  const title = (item.title || "").trim()

  if (kind.key === "meeting") {
    if (isCompleted) {
      return {
        kind,
        templateType: "zapisnik_sjednice",
        infoBoxTitle: "Sažetak održane sjednice",
        subject: title ? `Zapisnik i detalji sa sjednice: ${title}` : "Zapisnik i detalji sa sjednice",
        body: [
          "Poštovane članice i članovi tijela Društva,",
          "",
          "obavještavamo Vas da je sjednica Društva uspješno održana te da su zapisnik i zaključci pohranjeni u sustavu.",
          "",
          "Cjeloviti zapisnik, donesene odluke i sve priložene materijale možete pregledati nakon prijave u sustav „Rodoslovac”.",
        ].join("\n"),
      }
    }

    return {
      kind,
      templateType: "poziv_sjednica",
      infoBoxTitle: "Osnovni podaci o sjednici",
      subject: title ? `Sazvana je nova sjednica: ${title}` : "Sazvana je nova sjednica",
      body: [
        "Poštovane članice i članovi tijela Društva,",
        "",
        "obavještavamo Vas da je zakazana nova sjednica Društva. Osnovni podaci o održavanju nalaze se u sažetku u nastavku.",
        "",
        "Sve detalje sjednice — uključujući dnevni red, priloge, materijale za raspravu i evidenciju prisutnosti — možete pregledati nakon prijave u sustav „Rodoslovac”.",
      ].join("\n"),
    }
  }

  if (kind.key === "gathering") {
    return {
      kind,
      templateType: "poziv_predavanje",
      infoBoxTitle: "Osnovni podaci o događanju",
      subject: "Obavijest o rodoslovnom druženju",
      body: isCompleted
        ? [
            "Poštovane članice i članovi,",
            "",
            "obavještavamo Vas da je rodoslovno druženje uspješno održano te da su bilješke i materijali pohranjeni u sustavu.",
            "",
            "Sažetak događanja, fotografije i sve priložene dokumente možete pregledati nakon prijave u sustav „Rodoslovac”.",
          ].join("\n")
        : [
            "Poštovane članice i članovi,",
            "",
            "s osobitim zadovoljstvom najavljujemo nadolazeće rodoslovno druženje u organizaciji Društva. Osnovni podaci o terminu i mjestu održavanja nalaze se u sažetku u nastavku.",
            "",
            "Sve detalje događanja i povezane materijale možete pregledati nakon prijave u sustav „Rodoslovac”. Radujemo se Vašem dolasku!",
          ].join("\n"),
    }
  }

  if (kind.key === "visit") {
    return {
      kind,
      templateType: "poziv_predavanje",
      infoBoxTitle: isCompleted ? "Sažetak održanog gostovanja" : "Osnovni podaci o gostovanju",
      subject: isCompleted
        ? title
          ? `Održano gostovanje: ${title}`
          : "Održano gostovanje"
        : title
        ? `Najava gostovanja: ${title}`
        : "Najava gostovanja",
      body: isCompleted
        ? [
            "Poštovane članice i članovi,",
            "",
            "obavještavamo Vas da je gostovanje uspješno održano te da su bilješke i materijali pohranjeni u sustavu.",
            "",
            "Sažetak događanja, eventualne fotografije i sve priložene dokumente možete pregledati nakon prijave u sustav „Rodoslovac”.",
          ].join("\n")
        : [
            "Poštovane članice i članovi,",
            "",
            "obavještavamo Vas o nadolazećem gostovanju u sklopu aktivnosti Društva. Osnovni podaci o terminu i mjestu održavanja nalaze se u sažetku u nastavku.",
            "",
            "Sve detalje gostovanja, opis i priložene materijale možete pregledati nakon prijave u sustav „Rodoslovac”.",
          ].join("\n"),
    }
  }

  if (kind.key === "workshop") {
    return {
      kind,
      templateType: "poziv_predavanje",
      infoBoxTitle: isCompleted ? "Sažetak održane radionice" : "Osnovni podaci o radionici",
      subject: isCompleted
        ? title
          ? `Održana radionica: ${title}`
          : "Održana radionica"
        : title
        ? `Nova radionica: ${title}`
        : "Nova radionica",
      body: isCompleted
        ? [
            "Poštovane članice i članovi,",
            "",
            "obavještavamo Vas da je radionica uspješno održana te da su radni materijali pohranjeni u sustavu.",
            "",
            "Sve detalje radionice, prezentacije i priložene dokumente možete pregledati nakon prijave u sustav „Rodoslovac”.",
          ].join("\n")
        : [
            "Poštovane članice i članovi,",
            "",
            "najavljujemo novu radionicu u organizaciji Društva. Osnovni podaci o terminu i mjestu održavanja nalaze se u sažetku u nastavku.",
            "",
            "Sve detalje radionice, opis programa i materijale možete pregledati nakon prijave u sustav „Rodoslovac”.",
          ].join("\n"),
    }
  }

  if (kind.key === "excursion") {
    return {
      kind,
      templateType: "poziv_predavanje",
      infoBoxTitle: isCompleted ? "Sažetak održanog izleta" : "Osnovni podaci o izletu",
      subject: isCompleted
        ? title
          ? `Održan izlet / ekskurzija: ${title}`
          : "Održan izlet / ekskurzija"
        : title
        ? `Najava izleta / ekskurzije: ${title}`
        : "Najava izleta / ekskurzije",
      body: isCompleted
        ? [
            "Poštovane članice i članovi,",
            "",
            "obavještavamo Vas da je izlet / ekskurzija uspješno održan te da su sažetak i prilozi pohranjeni u sustavu.",
            "",
            "Sve detalje, fotografije i popratnu dokumentaciju možete pregledati nakon prijave u sustav „Rodoslovac”.",
          ].join("\n")
        : [
            "Poštovane članice i članovi,",
            "",
            "najavljujemo izlet / ekskurziju u organizaciji Društva. Osnovni podaci o terminu i mjestu okupljanja nalaze se u sažetku u nastavku.",
            "",
            "Cjeloviti plan, opis programa i sve upute možete pregledati nakon prijave u sustav „Rodoslovac”.",
          ].join("\n"),
    }
  }

  // Standardno predavanje
  return {
    kind,
    templateType: "poziv_predavanje",
    infoBoxTitle: isCompleted ? "Sažetak održanog predavanja" : "Osnovni podaci o predavanju",
    subject: isCompleted
      ? title
        ? `Održano predavanje: ${title}`
        : "Održano predavanje"
      : title
      ? `Novo predavanje: ${title}`
      : "Novo predavanje",
    body: isCompleted
      ? [
          "Poštovane članice i članovi,",
          "",
          "obavještavamo Vas da je predavanje uspješno održano te da su sažetak i materijali pohranjeni u sustavu.",
          "",
          "Sve detalje predavanja, prezentacije, snimku i priložene dokumente možete pregledati nakon prijave u sustav „Rodoslovac”.",
        ].join("\n")
      : [
          "Poštovane članice i članovi,",
          "",
          "s osobitim zadovoljstvom najavljujemo novo predavanje u organizaciji Društva. Osnovni podaci o terminu i mjestu održavanja nalaze se u sažetku u nastavku.",
          "",
          "Sve detalje predavanja, sažetak teme i priložene materijale možete pregledati nakon prijave u sustav „Rodoslovac”. Radujemo se Vašem dolasku!",
        ].join("\n"),
  }
}

const DUPLICATE_META_LINE_RE =
  /^\s*(?:naziv(?:\s+(?:sjednice|predavanja|događanja|dogadanja))?|datum(?:\s+(?:održavanja|odrzavanja|i\s+vrijeme))?|vrijeme|lokacija|predavač(?:\s*\/\s*voditelj)?|predavac(?:\s*\/\s*voditelj)?|poveznica\s+za\s+prijavu\s+u\s+sustav|link\s+za\s+prijavu)\s*:/i

const TRAILING_SIGNATURE_RE =
  /\n*\s*Srdačan\s+pozdrav,?\s*\n+(?:(?:Izvršni\s+odbor|Tajništvo\s+Društva)\s*\n+)?(?:HRD|Hrvatsko\s+rodoslovno\s+društvo)[^\n]*\s*$/i

/**
 * Uklanja naslijeđene ponavljajuće retke metapodataka (Naziv/Datum/Lokacija/Predavač/Poveznica)
 * i dupli tekstualni potpis koji buildHrdMasterEmail već automatski prikazuje u sažetku i podnožju.
 */
export function stripDuplicateEventMetaLines(rawBody: string): string {
  const normalized = String(rawBody || "").replace(/\r\n/g, "\n")
  const filteredLines = normalized
    .split("\n")
    .filter((line) => !DUPLICATE_META_LINE_RE.test(line))
  const rejoined = filteredLines
    .join("\n")
    .replace(
      /Pozivamo Vas na sjednicu koja će se održati prema sljedećim podacima:\s*/gi,
      "obavještavamo Vas da je zakazana nova sjednica Društva. Osnovni podaci o održavanju nalaze se u sažetku u nastavku, dok su dnevni red i svi materijali dostupni nakon prijave u sustav „Rodoslovac”."
    )
    .replace(
      /Zadovoljstvo nam je najaviti rodoslovno druženje:\s*/gi,
      "s osobitim zadovoljstvom najavljujemo nadolazeće rodoslovno druženje. Osnovni podaci o održavanju nalaze se u sažetku u nastavku, a svi detalji dostupni su nakon prijave u sustav „Rodoslovac”."
    )
    .replace(
      /Zadovoljstvo nam je najaviti(?: novo)? predavanje:\s*/gi,
      "s osobitim zadovoljstvom najavljujemo novo predavanje. Osnovni podaci o održavanju nalaze se u sažetku u nastavku, a svi detalji dostupni su nakon prijave u sustav „Rodoslovac”."
    )
    .replace(TRAILING_SIGNATURE_RE, "")
  return rejoined.replace(/\n{3,}/g, "\n\n").trim()
}

export function buildEventInfoBoxHtml(params: {
  type: "meeting" | "lecture"
  item: EventNotificationItem
  pdfFilename?: string | null
  forBrowserPreview?: boolean
}): string {
  const { type, item, pdfFilename, forBrowserPreview } = params
  const kind = resolveEventKind(type, item)
  const formattedDate = item.date ? formatHrdEmailDate(item.date) : "—"
  const formattedTime = formatHrdEmailTime(item.time || item.start_time)
  const dateAndTimeLabel = formattedTime ? `${formattedDate} u ${formattedTime}` : formattedDate

  const attachmentLine = pdfFilename
    ? `<div style="margin-top: 4px;"><strong>PDF sažetak u privitku:</strong> <code>${escapeHtml(pdfFilename)}</code></div>`
    : forBrowserPreview
    ? `<div style="margin-top: 4px;"><strong>PDF sažetak u privitku:</strong> Automatski se prilaže službeni A4 PDF dokument.</div>`
    : ""

  return `
    <div><strong>Naziv:</strong> ${escapeHtml(item.title || "—")}</div>
    <div><strong>Datum i vrijeme:</strong> ${escapeHtml(dateAndTimeLabel)}</div>
    <div><strong>Lokacija:</strong> ${escapeHtml(item.location || "Online")}</div>
    ${!kind.isMeeting && !kind.isGathering && item.host ? `<div><strong>Predavač / voditelj:</strong> ${escapeHtml(item.host)}</div>` : ""}
    <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #E2E8F0; color: #475569;">
      <div>Svi detalji, prilozi i potpuna dokumentacija dostupni su nakon prijave u sustav <strong>Rodoslovac</strong>.</div>
      ${attachmentLine}
    </div>
  `
}
