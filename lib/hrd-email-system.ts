import { formatDateDMY } from "./utils"

export interface HrdEmailPalette {
  // Primarne boje (obvezni vizualni standard HRD-a)
  navyBlue: string      // #1E3A5F - Institucionalna tamnoplava (Zaglavlje e-maila)
  terracotta: string    // #7C2D12 - Tamna terakota (Naslovi i važne oznake)
  goldOrange: string    // #D97706 - Zlatno-narančasta (Akcenti, istaknuti blokovi i linije)
  graphite: string      // #1F2937 - Grafitna (Glavni tekst)
  linkBlue: string      // #1F77C5 - Plava poveznica (URL-ovi i poveznice)

  // Sekundarne i pozadinske boje
  white: string         // #FFFFFF - Bijela (Glavna podloga sadržaja)
  lightGrayBg: string   // #F8FAFC - Svijetlosiva (Vanjska podloga i neutralni blokovi)
  lightCream: string    // #FEFCE8 - Svijetla krem (Informativni i naglašeni blokovi)
  borderGray: string    // #E2E8F0 - Svijetlosiva za rubove (Obrubi, razdjelnici i linije)
  discreteBlue: string  // #E2E8F0 - Svijetloplava (Diskretni kontrastni elementi)

  // Alias polja radi kompatibilnosti postojećih poziva
  darkGreen: string
  bronzeGold: string
  parchment: string
  leatherBrown: string
  sand: string
}

export const DEFAULT_HRD_EMAIL_PALETTE: HrdEmailPalette = {
  navyBlue: "#1E3A5F",
  terracotta: "#7C2D12",
  goldOrange: "#D97706",
  graphite: "#1F2937",
  linkBlue: "#1F77C5",
  white: "#FFFFFF",
  lightGrayBg: "#F8FAFC",
  lightCream: "#FEFCE8",
  borderGray: "#E2E8F0",
  discreteBlue: "#E2E8F0",

  // Alias mapiranja na obveznu službenu paletu
  darkGreen: "#1E3A5F",
  bronzeGold: "#D97706",
  parchment: "#FEFCE8",
  leatherBrown: "#7C2D12",
  sand: "#E2E8F0",
}

export type HrdEmailTemplateTypeId =
  | "sluzbena_obavijest"
  | "poziv_predavanje"
  | "poziv_sjednica"
  | "zapisnik_sjednice"
  | "obavijest_clanovima"
  | "zahvala"
  | "poslovna_korespondencija"
  | "informacije_clanstvo"

export interface HrdEmailTemplateTypeMeta {
  id: HrdEmailTemplateTypeId
  label: string
  headerSubtitle: string
  defaultTitle: string
  defaultInfoBoxTitle?: string
  defaultClosingText?: string
}

export const HRD_EMAIL_TEMPLATE_TYPES: HrdEmailTemplateTypeMeta[] = [
  {
    id: "sluzbena_obavijest",
    label: "1. Službena obavijest",
    headerSubtitle: "Pavao Ritter Vitezović",
    defaultTitle: "Službena obavijest",
    defaultInfoBoxTitle: "Važne informacije",
    defaultClosingText: "S poštovanjem,",
  },
  {
    id: "poziv_predavanje",
    label: "2. Poziv na predavanje ili događanje",
    headerSubtitle: "Pavao Ritter Vitezović",
    defaultTitle: "Poziv na predavanje",
    defaultInfoBoxTitle: "Detalji događanja",
    defaultClosingText: "Radujemo se Vašem dolasku!",
  },
  {
    id: "poziv_sjednica",
    label: "3. Poziv na sjednicu ili sastanak",
    headerSubtitle: "Pavao Ritter Vitezović",
    defaultTitle: "Poziv na sjednicu",
    defaultInfoBoxTitle: "Podaci o održavanju sjednice",
    defaultClosingText: "Molimo Vas da potvrdite svoj dolazak.",
  },
  {
    id: "zapisnik_sjednice",
    label: "4. Zapisnik sjednice",
    headerSubtitle: "Pavao Ritter Vitezović",
    defaultTitle: "Zapisnik i sažetak sjednice",
    defaultInfoBoxTitle: "Sažetak održane sjednice",
    defaultClosingText: "U privitku se nalazi službeni dokument.",
  },
  {
    id: "obavijest_clanovima",
    label: "5. Obavijest članovima",
    headerSubtitle: "Pavao Ritter Vitezović",
    defaultTitle: "Obavijest članovima",
    defaultInfoBoxTitle: "Evidencija članstva",
    defaultClosingText: "Zahvaljujemo na suradnji i podršci radu Društva.",
  },
  {
    id: "zahvala",
    label: "6. Zahvala",
    headerSubtitle: "Pavao Ritter Vitezović",
    defaultTitle: "Zahvala na podršci i suradnji",
    defaultInfoBoxTitle: "Potvrda",
    defaultClosingText: "Od srca zahvaljujemo na Vašem doprinosu!",
  },
  {
    id: "poslovna_korespondencija",
    label: "7. Službena poslovna korespondencija",
    headerSubtitle: "Pavao Ritter Vitezović",
    defaultTitle: "Službeni dopis",
    defaultInfoBoxTitle: "Predmet korespondencije",
    defaultClosingText: "Stojimo Vam na raspolaganju za sve dodatne informacije.",
  },
  {
    id: "informacije_clanstvo",
    label: "8. Informacije o članstvu",
    headerSubtitle: "Pavao Ritter Vitezović",
    defaultTitle: "Informacije o članstvu u Društvu",
    defaultInfoBoxTitle: "Članski podaci",
    defaultClosingText: "Dobro došli u Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”!",
  },
]

export function getHrdPaletteFromSettings(_settings?: any): HrdEmailPalette {
  return DEFAULT_HRD_EMAIL_PALETTE
}

export function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Centralizirani format datuma za sve e-mailove: isključivo DD/MM/YYYY
 */
export function formatHrdEmailDate(dateInput?: string | Date | null): string {
  if (!dateInput) {
    return formatDateDMY(new Date(), "")
  }
  return formatDateDMY(dateInput, String(dateInput))
}

/**
 * Centralizirani 24-satni format vremena: HH:mm (npr. 19:00)
 */
export function formatHrdEmailTime(timeInput?: string | Date | null): string {
  if (!timeInput) return ""
  if (timeInput instanceof Date) {
    if (isNaN(timeInput.getTime())) return ""
    const hh = String(timeInput.getHours()).padStart(2, "0")
    const mm = String(timeInput.getMinutes()).padStart(2, "0")
    return `${hh}:${mm}`
  }
  const str = String(timeInput).trim()
  const match = str.match(/(\d{1,2}):(\d{2})/)
  if (match) {
    return `${match[1].padStart(2, "0")}:${match[2]}`
  }
  return str
}

export interface ResolvedLogoResult {
  hasLogo: boolean
  imgSrc: string | null
  inlineAttachment?: {
    filename: string
    content: Buffer
    contentType: string
    cid: string
    contentDisposition: "inline"
  }
  warning?: string
}

/**
 * Centralizirano učitavanje postojećeg službenog HRD logotipa iz postavki (settings.logoUrl).
 * Ne mijenja grafiku, proporcije ni boje. Koristi apsolutni URL ili CID privitak za e-mail klijente.
 * Napomena: Prema zahtjevu korisnika, logotip se NE prikazuje u zaglavlju e-maila, već isključivo
 * unutar postojećeg službenog potpisa ako potpis sadrži oznaku (LOGO) ili sliku logotipa.
 */
export function resolveOfficialHrdLogo(
  settings: any,
  forBrowserPreview = false,
  baseOrigin = "https://rodoslovlje.hr"
): ResolvedLogoResult {
  const rawLogo = String(settings?.logoUrl || "").trim()
  if (!rawLogo) {
    return {
      hasLogo: false,
      imgSrc: null,
    }
  }

  if (forBrowserPreview) {
    return {
      hasLogo: true,
      imgSrc: rawLogo,
    }
  }

  const dataMatch = rawLogo.match(/^data:([^;,]+);base64,([\s\S]+)$/i)
  if (dataMatch && typeof Buffer !== "undefined") {
    const mimeType = dataMatch[1].toLowerCase()
    const base64Clean = dataMatch[2].replace(/[\r\n\s]+/g, "")
    const ext = mimeType.includes("png")
      ? "png"
      : mimeType.includes("svg")
      ? "svg"
      : mimeType.includes("gif")
      ? "gif"
      : "jpg"
    const cid = "hrd_official_logo_cid"
    return {
      hasLogo: true,
      imgSrc: `cid:${cid}`,
      inlineAttachment: {
        filename: `hrd_logo.${ext}`,
        content: Buffer.from(base64Clean, "base64"),
        contentType: mimeType,
        cid,
        contentDisposition: "inline",
      },
    }
  }

  // Osiguraj apsolutni URL za relativne putanje
  if (rawLogo.startsWith("/")) {
    const cleanOrigin = baseOrigin.replace(/\/+$/, "")
    return {
      hasLogo: true,
      imgSrc: `${cleanOrigin}${rawLogo}`,
    }
  }

  return {
    hasLogo: true,
    imgSrc: rawLogo,
  }
}

export interface SenderIdentityInput {
  userId?: string | number
  userName?: string
  userEmail?: string
  userRole?: string
  userFunction?: string
  societyRole?: string
}

function isGenericRoleToken(value: string): boolean {
  const norm = value.trim().toLowerCase()
  return (
    norm === "" ||
    norm === "administrator" ||
    norm === "rezervni administrator" ||
    norm === "admin" ||
    norm === "moderator" ||
    norm === "moderator (tijelo društva)" ||
    norm === "član društva" ||
    norm === "clan drustva" ||
    norm === "član" ||
    norm === "clan"
  )
}

function prioritizeSocietyRolesInLabel(rawLabel: string): string {
  const parts = String(rawLabel || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length <= 1) return parts[0] || ""

  const societyParts = parts.filter((p) => !isGenericRoleToken(p))
  if (societyParts.length > 0) {
    // Ako postoji stvarna funkcija u Društvu, stavi je na prvo mjesto i izbjegni suvišno „Administrator”
    return societyParts.join(", ")
  }
  return parts.join(", ")
}

export interface ResolvedSignatureResult {
  hasSignature: boolean
  signatureHtml: string
  signaturePlain: string
  inlineAttachment?: {
    filename: string
    content: Buffer
    contentType: string
    cid: string
    contentDisposition: "inline"
  }
  warning?: string
}

export function linkifyHrdText(rawText: string, linkColor = DEFAULT_HRD_EMAIL_PALETTE.linkBlue): string {
  const escaped = escapeHtml(rawText || "")
  let withLinks = escaped.replace(
    /(https?:\/\/[^\s<]+)/gi,
    `<a href="$1" target="_blank" rel="noopener noreferrer" style="color: ${linkColor}; text-decoration: underline;">$1</a>`
  )
  withLinks = withLinks.replace(
    /(^|[\s>(])(www\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s<]*)?)/g,
    `$1<a href="https://$2" target="_blank" rel="noopener noreferrer" style="color: ${linkColor}; text-decoration: underline;">$2</a>`
  )
  withLinks = withLinks.replace(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    `<a href="mailto:$1" style="color: ${linkColor}; text-decoration: underline;">$1</a>`
  )
  return withLinks.replace(/\n/g, "<br/>")
}

/**
 * Centralizirano dohvaćanje postojećeg standardiziranog HRD potpisa iz konfiguracije ili pohrane.
 * Ako potpis sadrži oznaku (LOGO), ugrađuje postojeći službeni HRD logotip bez promjene proporcija.
 */
export function resolveStandardizedSignature(
  settings: any,
  sender?: SenderIdentityInput | null,
  forBrowserPreview = false,
  baseOrigin = "https://rodoslovlje.hr"
): ResolvedSignatureResult {
  const palette = getHrdPaletteFromSettings(settings)
  let rawSig = ""

  // 1. Provjeri postoji li pojedinačno mapirani potpis za prijavljenog korisnika / pošiljatelja
  if (settings?.userSignaturesJson && sender) {
    try {
      const map =
        typeof settings.userSignaturesJson === "string"
          ? JSON.parse(settings.userSignaturesJson)
          : settings.userSignaturesJson
      if (map && typeof map === "object") {
        const byId = sender.userId !== undefined ? map[String(sender.userId)] : undefined
        const byEmail = sender.userEmail ? map[sender.userEmail.toLowerCase()] : undefined
        const byName = sender.userName ? map[sender.userName] : undefined
        rawSig = String(byId || byEmail || byName || "").trim()
      }
    } catch {}
  }

  // 2. Ako nema pojedinačnog mapiranja, koristi postojeći službeni potpis iz Postavki
  if (!rawSig && settings?.paymentEmailSignature) {
    rawSig = String(settings.paymentEmailSignature).trim()
  }

  // 3. Ako u Postavkama nije unesen potpis, koristi postojeći standardizirani HRD potpis iz konfiguracije sustava
  if (!rawSig) {
    rawSig = `Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”
(LOGO)
OIB: 17328479414
IBAN: HR6523600001102892498

📍 Trg Marka Marulića 21, 10000 Zagreb
📧 rodoslovlje@rodoslovlje.hr
🌐 www.rodoslovlje.hr
🔗 https://www.facebook.com/groups/rodoslovlje`
  }

  const logoRes = resolveOfficialHrdLogo(settings, forBrowserPreview, baseOrigin)
  const logoImgTag =
    logoRes.hasLogo && logoRes.imgSrc
      ? `<img src="${logoRes.imgSrc}" alt="Službeni logotip Hrvatskog rodoslovnog društva Pavao Ritter Vitezović" style="max-width: 140px; max-height: 70px; height: auto; width: auto; display: block; border: 0;" />`
      : ""

  const isHtml = /<[a-z][\s\S]*>/i.test(rawSig)
  let signatureHtml = ""

  if (isHtml) {
    signatureHtml = rawSig
    if (/\(LOGO\)/i.test(signatureHtml)) {
      signatureHtml = signatureHtml.replace(
        /\(LOGO\)/gi,
        logoImgTag ? `<div style="margin: 10px 0 12px 0;">${logoImgTag}</div>` : ""
      )
    }
  } else {
    let linked = linkifyHrdText(rawSig, palette.linkBlue)
    if (/\(LOGO\)/i.test(linked)) {
      linked = linked.replace(
        /\(LOGO\)(?:<br\s*\/?>)?/gi,
        logoImgTag ? `<div style="margin: 10px 0 12px 0;">${logoImgTag}</div>` : ""
      )
    } else if (logoImgTag) {
      linked = `${linked}<div style="margin-top: 12px;">${logoImgTag}</div>`
    }
    signatureHtml = `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: ${palette.graphite};">${linked}</div>`
  }

  const signaturePlainBase = rawSig
    .replace(/\(LOGO\)\r?\n?/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim()

  const senderFullName = String(sender?.userName || "").trim()
  const preferredSocietyRole = String(sender?.societyRole || "").trim()
  const rawUserFunction = String(sender?.userFunction || "").trim()
  const fallbackSystemRole =
    sender?.userRole === "admin"
      ? "Administrator"
      : sender?.userRole === "moderator"
      ? "Moderator"
      : senderFullName
      ? "Član Društva"
      : ""

  const combinedRawLabel =
    preferredSocietyRole && !isGenericRoleToken(preferredSocietyRole)
      ? preferredSocietyRole
      : rawUserFunction && !isGenericRoleToken(rawUserFunction)
      ? rawUserFunction
      : preferredSocietyRole || rawUserFunction || fallbackSystemRole

  const senderRoleLabel = prioritizeSocietyRolesInLabel(combinedRawLabel) || fallbackSystemRole

  const alreadyHasSenderName =
    Boolean(senderFullName) &&
    signaturePlainBase.toLowerCase().includes(senderFullName.toLowerCase())

  const senderSignoffHtml =
    senderFullName && !alreadyHasSenderName
      ? `<div data-hrd-sender-signoff="true" style="margin-bottom: 10px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.5; color: ${palette.graphite};"><strong style="color: ${palette.navyBlue};">${escapeHtml(
          senderFullName
        )}</strong>${
          senderRoleLabel
            ? `<br/><span style="color: #475569; font-size: 12px;">${escapeHtml(senderRoleLabel)}</span>`
            : ""
        }</div>`
      : ""

  const finalSignatureHtml = senderSignoffHtml ? `${senderSignoffHtml}${signatureHtml}` : signatureHtml
  const finalSignaturePlain =
    senderFullName && !alreadyHasSenderName
      ? `${senderFullName}${senderRoleLabel ? `\n${senderRoleLabel}` : ""}\n\n${signaturePlainBase}`
      : signaturePlainBase

  return {
    hasSignature: true,
    signatureHtml: finalSignatureHtml,
    signaturePlain: finalSignaturePlain,
    inlineAttachment: logoImgTag ? logoRes.inlineAttachment : undefined,
  }
}

/**
 * 3. ZAJEDNIČKA KOMPONENTA STANDARDIZIRANOG ZAGLAVLJA (bez logotipa u zaglavlju)
 * - Tamnoplava pozadina (#1E3A5F)
 * - Naziv: HRVATSKO RODOSLOVNO DRUŠTVO
 * - Podnaslov: Pavao Ritter Vitezović
 * - Bijeli/svijetli tekst
 * - Ispod zaglavlja tanka zlatno-narančasta linija (#D97706)
 */
export function buildHrdStandardHeaderHtml(palette: HrdEmailPalette = DEFAULT_HRD_EMAIL_PALETTE): string {
  return `
          <!-- Standardizirano HRD zaglavlje (#1E3A5F) bez logotipa u zaglavlju -->
          <tr>
            <td class="hrd-header-pad" bgcolor="${palette.navyBlue}" style="background-color: ${palette.navyBlue}; padding: 24px 32px; text-align: left;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 18px; font-weight: bold; color: ${palette.white}; letter-spacing: 0.04em; line-height: 1.3; margin: 0; text-transform: uppercase;">
                      HRVATSKO RODOSLOVNO DRUŠTVO
                    </div>
                    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: ${palette.lightGrayBg}; font-weight: normal; letter-spacing: 0.02em; margin-top: 4px;">
                      Pavao Ritter Vitezović
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Tanka zlatno-narančasta linija (#D97706) ispod zaglavlja -->
          <tr>
            <td height="4" bgcolor="${palette.goldOrange}" style="background-color: ${palette.goldOrange}; height: 4px; font-size: 1px; line-height: 4px;">&nbsp;</td>
          </tr>`
}

/**
 * 5. ZAJEDNIČKA KOMPONENTA STANDARDIZIRANOG PODNOŽJA
 * - Diskretna horizontalna linija boje #E2E8F0 ispred potpisa
 * - Automatski ugrađen postojeći službeni HRD potpis iz konfiguracije
 */
export function buildHrdStandardFooterHtml(
  signatureHtml: string,
  palette: HrdEmailPalette = DEFAULT_HRD_EMAIL_PALETTE
): string {
  if (!signatureHtml) return ""
  return `
                <!-- Diskretna horizontalna linija (#E2E8F0) i postojeći službeni HRD potpis -->
                <tr>
                  <td style="padding-top: 22px; margin-top: 18px; border-top: 1px solid ${palette.borderGray};">
                    <div data-hrd-signature="standardized" style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: ${palette.graphite};">
                      ${signatureHtml}
                    </div>
                  </td>
                </tr>`
}

export interface BuildHrdEmailParams {
  templateType?: HrdEmailTemplateTypeId
  title: string
  subtitle?: string
  sentDate?: string | Date
  greeting?: string
  bodyTextOrHtml: string
  isBodyHtml?: boolean
  infoBoxTitle?: string
  infoBoxHtml?: string
  ctaText?: string
  ctaUrl?: string
  closingText?: string
  extraContentHtml?: string
  settings?: any
  sender?: SenderIdentityInput | null
  forBrowserPreview?: boolean
  customWebsiteUrl?: string
}

export interface BuiltHrdEmailResult {
  html: string
  plainText: string
  inlineAttachments: Array<{
    filename: string
    content: Buffer
    contentType: string
    cid: string
    contentDisposition: "inline"
  }>
  warnings: string[]
}

/**
 * Sažima slučajno uzastopno ponavljanje imena „Pavao Ritter Vitezović”
 * (npr. „Pavao Ritter Vitezović „Pavao Ritter Vitezović”” -> „Pavao Ritter Vitezović”).
 */
export function deduplicateHrdOrganizationName(text: string): string {
  if (!text) return ""
  return String(text).replace(
    /(["„“'«]?)\s*Pavao\s+Ritter\s+Vitezovi[ćc]\s*(["”’»]?)(?:[\s,–—\-]*)(["„“'«]?)\s*Pavao\s+Ritter\s+Vitezovi[ćc]\s*(["”’»]?)/gi,
    (_m, qOpen1, _qClose1, qOpen2) =>
      qOpen1 || qOpen2 ? "„Pavao Ritter Vitezović”" : "Pavao Ritter Vitezović"
  )
}

/**
 * 7. JEDINSTVENI HRD HTML E-MAIL PREDLOŽAK (max 600 px)
 * Kompatibilan s Gmailom, Outlookom, Apple Mailom i mobilnim klijentima.
 */
export function buildHrdMasterEmail({
  templateType = "sluzbena_obavijest",
  title,
  sentDate,
  greeting,
  bodyTextOrHtml: rawBodyTextOrHtml,
  isBodyHtml = false,
  infoBoxTitle,
  infoBoxHtml,
  ctaText,
  ctaUrl,
  closingText: rawClosingText,
  extraContentHtml,
  settings,
  sender,
  forBrowserPreview = false,
  customWebsiteUrl,
}: BuildHrdEmailParams): BuiltHrdEmailResult {
  const palette = getHrdPaletteFromSettings(settings)
  const typeMeta =
    HRD_EMAIL_TEMPLATE_TYPES.find((t) => t.id === templateType) || HRD_EMAIL_TEMPLATE_TYPES[0]

  const websiteUrl = (customWebsiteUrl || settings?.officialWebsiteUrl || "https://rodoslovlje.hr").trim()
  const sigRes = resolveStandardizedSignature(settings, sender, forBrowserPreview, websiteUrl)

  const warnings: string[] = []
  if (sigRes.warning) warnings.push(sigRes.warning)

  const inlineAttachments: BuiltHrdEmailResult["inlineAttachments"] = []
  if (sigRes.inlineAttachment) {
    inlineAttachments.push(sigRes.inlineAttachment)
  }

  const formattedSentDate = formatHrdEmailDate(sentDate || new Date())
  const effectiveTitle = deduplicateHrdOrganizationName(title || typeMeta.defaultTitle)
  const bodyTextOrHtml = isBodyHtml
    ? rawBodyTextOrHtml
    : deduplicateHrdOrganizationName(rawBodyTextOrHtml)
  const closingText = rawClosingText
    ? deduplicateHrdOrganizationName(rawClosingText)
    : rawClosingText

  // Ako korisnički tekst već na kraju sadrži pozdrav i naziv društva, a imamo službeni potpis,
  // zadržavamo tekst čitljivim i sve URL-ove bojimo u #1F77C5 (Plava poveznica)
  const formattedBodyHtml = isBodyHtml
    ? bodyTextOrHtml
    : escapeHtml(bodyTextOrHtml)
        .replace(
          /(https?:\/\/[^\s<]+)/g,
          `<a href="$1" target="_blank" rel="noopener noreferrer" style="color: ${palette.linkBlue}; font-weight: bold; text-decoration: underline;">$1</a>`
        )
        .replace(/\n/g, "<br/>")

  const headerHtml = buildHrdStandardHeaderHtml(palette)
  const footerSignatureHtml = buildHrdStandardFooterHtml(sigRes.signatureHtml, palette)

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="hr">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(effectiveTitle)}</title>
  <style type="text/css">
    body, table, td, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .hrd-container { width: 100% !important; max-width: 100% !important; }
      .hrd-pad { padding: 20px 18px !important; }
      .hrd-header-pad { padding: 20px 18px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${palette.lightGrayBg}; color: ${palette.graphite}; font-family: Arial, Helvetica, sans-serif;">
  <!-- Vanjska podloga (#F8FAFC) -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.lightGrayBg}" style="background-color: ${palette.lightGrayBg}; width: 100%; margin: 0; padding: 24px 10px;">
    <tr>
      <td align="center">
        <!-- Glavni bijeli kontejner (#FFFFFF) maksimalne širine 600 px s diskretnim obrubom (#E2E8F0) -->
        <table role="presentation" class="hrd-container" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.white}" style="width: 100%; max-width: 600px; background-color: ${palette.white}; border: 1px solid ${palette.borderGray}; border-collapse: collapse;">
          
          ${headerHtml}

          <!-- Glavna podloga sadržaja (#FFFFFF) -->
          <tr>
            <td class="hrd-pad" bgcolor="${palette.white}" style="padding: 28px 32px; background-color: ${palette.white};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                
                <!-- Naslov u boji Tamna terakota (#7C2D12) i datum slanja (DD/MM/YYYY) -->
                <tr>
                  <td style="padding-bottom: 16px; border-bottom: 1px solid ${palette.borderGray};">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td valign="top" style="font-family: Georgia, 'Times New Roman', serif; font-size: 19px; font-weight: bold; color: ${palette.terracotta}; line-height: 1.35;">
                          ${escapeHtml(effectiveTitle)}
                        </td>
                        <td valign="top" align="right" style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: ${palette.graphite}; white-space: nowrap; padding-left: 12px;">
                          Datum: <strong>${escapeHtml(formattedSentDate)}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                ${
                  greeting
                    ? `<tr>
                        <td style="padding-top: 20px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: bold; color: ${palette.graphite};">
                          ${escapeHtml(greeting)}
                        </td>
                      </tr>`
                    : ""
                }

                <!-- Glavni tekst (#1F2937) -->
                <tr>
                  <td style="padding-top: 16px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.7; color: ${palette.graphite};">
                    ${formattedBodyHtml}
                  </td>
                </tr>

                <!-- Informativni blok: pozadina Svijetla krem (#FEFCE8), lijevi obrub Zlatno-narančasta (#D97706), naslov Tamna terakota (#7C2D12) -->
                ${
                  infoBoxHtml
                    ? `<tr>
                        <td style="padding-top: 22px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.lightCream}" style="background-color: ${palette.lightCream}; border: 1px solid ${palette.borderGray}; border-left: 4px solid ${palette.goldOrange};">
                            <tr>
                              <td style="padding: 16px 20px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.65; color: ${palette.graphite};">
                                ${
                                  infoBoxTitle
                                    ? `<div style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; font-weight: bold; color: ${palette.terracotta}; margin-bottom: 8px;">${escapeHtml(
                                        infoBoxTitle
                                      )}</div>`
                                    : ""
                                }
                                ${infoBoxHtml}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>`
                    : ""
                }

                <!-- Dodatni ugrađeni sadržaj (npr. uplatnica, 2D barkod, prilozi) -->
                ${
                  extraContentHtml
                    ? `<tr>
                        <td style="padding-top: 20px;">
                          ${extraContentHtml}
                        </td>
                      </tr>`
                    : ""
                }

                <!-- Gumb i poveznica (#1F77C5) -->
                ${
                  ctaText && ctaUrl
                    ? `<tr>
                        <td align="center" style="padding-top: 24px; padding-bottom: 6px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td align="center" bgcolor="${palette.navyBlue}" style="background-color: ${palette.navyBlue}; border-bottom: 3px solid ${palette.goldOrange}; padding: 12px 28px; border-radius: 4px;">
                                <a href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener noreferrer" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: bold; color: ${palette.white}; text-decoration: none; display: inline-block;">
                                  ${escapeHtml(ctaText)}
                                </a>
                              </td>
                            </tr>
                          </table>
                          <div style="margin-top: 8px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: ${palette.graphite};">
                            Izravna poveznica: <a href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener noreferrer" style="color: ${palette.linkBlue}; text-decoration: underline;">${escapeHtml(ctaUrl)}</a>
                          </div>
                        </td>
                      </tr>`
                    : ""
                }

                <!-- Završna poruka -->
                ${
                  closingText
                    ? `<tr>
                        <td style="padding-top: 20px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: ${palette.graphite}; line-height: 1.6;">
                          ${escapeHtml(closingText)}
                        </td>
                      </tr>`
                    : ""
                }

                ${footerSignatureHtml}

              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const plainParts = [
    "HRVATSKO RODOSLOVNO DRUŠTVO — Pavao Ritter Vitezović",
    `Naslov: ${effectiveTitle}`,
    `Datum: ${formattedSentDate}`,
    "",
    greeting || "",
    isBodyHtml ? bodyTextOrHtml.replace(/<[^>]+>/g, "") : bodyTextOrHtml,
    ctaText && ctaUrl ? `\n${ctaText}: ${ctaUrl}` : "",
    closingText ? `\n${closingText}` : "",
    sigRes.hasSignature ? `\n--\n${sigRes.signaturePlain}` : "",
  ].filter(Boolean)

  return {
    html,
    plainText: plainParts.join("\n"),
    inlineAttachments,
    warnings,
  }
}

export const DEFAULT_BOARD_ANNOUNCEMENT_SUBJECT =
  "Obavijest o poruci poslanoj putem sustava Rodoslovac"

export interface BuildBoardAnnouncementEmailParams {
  subject?: string
  message: string
  senderName: string
  sentDate?: string | Date
  formattedDateTime: string
  ctaUrl?: string
  settings?: any
  sender?: SenderIdentityInput | null
  forBrowserPreview?: boolean
  attachments?: Array<{
    name: string
    size?: number
  }>
}

function formatBoardAttachmentMetaSize(bytes?: number): string {
  const n = Number(bytes || 0)
  if (!Number.isFinite(n) || n <= 0) return ""
  if (n < 1024) return `${Math.round(n)} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`
}

/**
 * Službeni unificirani predložak obavijesti za članove tijela Društva
 * (Izvršni odbor, Nadzorni odbor, Sud časti) uz zaglavlje i potpis HRD-a.
 */
export function buildBoardAnnouncementEmail({
  subject,
  message,
  senderName,
  sentDate,
  formattedDateTime,
  ctaUrl,
  settings,
  sender,
  forBrowserPreview = false,
  attachments,
}: BuildBoardAnnouncementEmailParams): BuiltHrdEmailResult {
  const palette = getHrdPaletteFromSettings(settings)
  const cleanTitle = String(subject || "").trim() || DEFAULT_BOARD_ANNOUNCEMENT_SUBJECT
  const cleanMessage = String(message || "").trim()
  const cleanSenderName = String(senderName || "").trim() || "Administrator"
  const effectiveUrl = (ctaUrl || settings?.officialWebsiteUrl || "https://rodoslovlje.hr").trim()
  const validAttachments = (attachments || []).filter((a) => a && String(a.name || "").trim().length > 0)

  const messageHtml = linkifyHrdText(cleanMessage, palette.linkBlue)

  const bodyHtml = `
    <p style="margin: 0 0 12px 0;">
      putem informacijskog sustava Rodoslovac upućena je obavijest svim članovima tijela Društva, odnosno članovima:
    </p>
    <ul style="margin: 0 0 14px 20px; padding: 0; color: ${palette.graphite}; line-height: 1.7;">
      <li style="margin-bottom: 2px;"><strong>Izvršnog odbora</strong></li>
      <li style="margin-bottom: 2px;"><strong>Nadzornog odbora</strong></li>
      <li style="margin-bottom: 2px;"><strong>Suda časti</strong></li>
    </ul>
    <p style="margin: 0 0 10px 0;">
      U nastavku donosimo tekst poslane poruke:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.lightGrayBg}" style="background-color: ${palette.lightGrayBg}; border: 1px solid ${palette.borderGray}; border-left: 4px solid ${palette.navyBlue};">
      <tr>
        <td style="padding: 14px 18px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.7; color: ${palette.graphite};">
          ${messageHtml}
        </td>
      </tr>
    </table>
  `

  const attachmentsInfoHtml =
    validAttachments.length > 0
      ? `
    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid ${palette.borderGray};">
      <div><strong>Priložene datoteke (${validAttachments.length}):</strong></div>
      <ul style="margin: 4px 0 0 18px; padding: 0; color: ${palette.graphite};">
        ${validAttachments
          .map((att) => {
            const sizeStr = formatBoardAttachmentMetaSize(att.size)
            return `<li style="margin-bottom: 2px;">${escapeHtml(att.name)}${sizeStr ? ` <span style="color: #6B7280;">(${escapeHtml(sizeStr)})</span>` : ""}</li>`
          })
          .join("")}
      </ul>
    </div>
  `
      : ""

  const infoBoxHtml = `
    <div style="margin-bottom: 4px;"><strong>Pošiljatelj:</strong> ${escapeHtml(cleanSenderName)}</div>
    <div><strong>Datum i vrijeme slanja:</strong> ${escapeHtml(formattedDateTime)}</div>
    ${attachmentsInfoHtml}
  `

  const built = buildHrdMasterEmail({
    templateType: "sluzbena_obavijest",
    title: cleanTitle,
    sentDate: sentDate || new Date(),
    greeting: "Poštovane članice i članovi tijela Društva,",
    bodyTextOrHtml: bodyHtml,
    isBodyHtml: true,
    infoBoxTitle: "Podaci o obavijesti:",
    infoBoxHtml,
    ctaText: "Otvori sustav Rodoslovac",
    ctaUrl: effectiveUrl,
    settings,
    sender,
    forBrowserPreview,
  })

  const sigRes = resolveStandardizedSignature(
    settings,
    sender,
    forBrowserPreview,
    (settings?.officialWebsiteUrl || effectiveUrl).trim()
  )

  const plainAttachmentsLines =
    validAttachments.length > 0
      ? [
          "",
          `Priložene datoteke (${validAttachments.length}):`,
          ...validAttachments.map((att) => {
            const sizeStr = formatBoardAttachmentMetaSize(att.size)
            return `- ${att.name}${sizeStr ? ` (${sizeStr})` : ""}`
          }),
        ]
      : []

  const plainParts = [
    "HRVATSKO RODOSLOVNO DRUŠTVO — Pavao Ritter Vitezović",
    cleanTitle,
    "",
    "Poštovane članice i članovi tijela Društva,",
    "",
    "putem informacijskog sustava Rodoslovac upućena je obavijest svim članovima tijela Društva, odnosno članovima:",
    "",
    "- Izvršnog odbora",
    "- Nadzornog odbora",
    "- Suda časti",
    "",
    "U nastavku donosimo tekst poslane poruke:",
    "",
    cleanMessage,
    "",
    "Podaci o obavijesti:",
    `Pošiljatelj: ${cleanSenderName}`,
    `Datum i vrijeme slanja: ${formattedDateTime}`,
    ...plainAttachmentsLines,
    effectiveUrl ? `\nOtvori sustav Rodoslovac: ${effectiveUrl}` : "",
    sigRes.hasSignature ? `\n--\n${sigRes.signaturePlain}` : "",
  ].filter((part) => part !== undefined)

  return {
    ...built,
    plainText: plainParts.join("\n"),
  }
}
