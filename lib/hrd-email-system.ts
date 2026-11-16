import { formatDateDMY } from "./utils"

export interface HrdEmailPalette {
  darkGreen: string   // #343C32 - Primarna boja, zaglavlje i podnožje
  bronzeGold: string  // #A17B50 - Naglasci, razdjelnici i detalji
  parchment: string   // #EAE1D1 - Pozadine i informativni blokovi
  leatherBrown: string // #704C3A - Poveznice i sekundarni naglasci
  sand: string        // #B6AA94 - Sekundarni elementi
  white: string       // #FFFFFF - Glavna površina sadržaja
  graphite: string    // #292929 - Osnovni tekst
}

export const DEFAULT_HRD_EMAIL_PALETTE: HrdEmailPalette = {
  darkGreen: "#343C32",
  bronzeGold: "#A17B50",
  parchment: "#EAE1D1",
  leatherBrown: "#704C3A",
  sand: "#B6AA94",
  white: "#FFFFFF",
  graphite: "#292929",
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
    headerSubtitle: "Službena obavijest Društva",
    defaultTitle: "Službena obavijest",
    defaultInfoBoxTitle: "Važne informacije",
    defaultClosingText: "S poštovanjem,",
  },
  {
    id: "poziv_predavanje",
    label: "2. Poziv na predavanje ili događanje",
    headerSubtitle: "Poziv na javno predavanje i druženje",
    defaultTitle: "Poziv na predavanje",
    defaultInfoBoxTitle: "Detalji događanja",
    defaultClosingText: "Radujemo se Vašem dolasku!",
  },
  {
    id: "poziv_sjednica",
    label: "3. Poziv na sjednicu ili sastanak",
    headerSubtitle: "Poziv na sjednicu tijela Društva",
    defaultTitle: "Poziv na sjednicu",
    defaultInfoBoxTitle: "Podaci o održavanju sjednice",
    defaultClosingText: "Molimo Vas da potvrdite svoj dolazak.",
  },
  {
    id: "zapisnik_sjednice",
    label: "4. Zapisnik sjednice",
    headerSubtitle: "Službeni zapisnik i zaključci sjednice",
    defaultTitle: "Zapisnik i sažetak sjednice",
    defaultInfoBoxTitle: "Sažetak održane sjednice",
    defaultClosingText: "U privitku se nalazi službeni dokument.",
  },
  {
    id: "obavijest_clanovima",
    label: "5. Obavijest članovima",
    headerSubtitle: "Obavijest članovima Društva",
    defaultTitle: "Obavijest članovima",
    defaultInfoBoxTitle: "Evidencija članstva",
    defaultClosingText: "Zahvaljujemo na suradnji i podršci radu Društva.",
  },
  {
    id: "zahvala",
    label: "6. Zahvala",
    headerSubtitle: "Zahvala Hrvatskog rodoslovnog društva",
    defaultTitle: "Zahvala na podršci i suradnji",
    defaultInfoBoxTitle: "Potvrda",
    defaultClosingText: "Od srca zahvaljujemo na Vašem doprinosu!",
  },
  {
    id: "poslovna_korespondencija",
    label: "7. Službena poslovna korespondencija",
    headerSubtitle: "Službena korespondencija",
    defaultTitle: "Službeni dopis",
    defaultInfoBoxTitle: "Predmet korespondencije",
    defaultClosingText: "Stojimo Vam na raspolaganju za sve dodatne informacije.",
  },
  {
    id: "informacije_clanstvo",
    label: "8. Informacije o članstvu",
    headerSubtitle: "Informacije o članstvu i pristupu sustavu",
    defaultTitle: "Informacije o članstvu u Društvu",
    defaultInfoBoxTitle: "Članski podaci",
    defaultClosingText: "Dobro došli u Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”!",
  },
]

export function getHrdPaletteFromSettings(settings?: any): HrdEmailPalette {
  if (!settings?.emailPaletteJson) return DEFAULT_HRD_EMAIL_PALETTE
  try {
    const parsed =
      typeof settings.emailPaletteJson === "string"
        ? JSON.parse(settings.emailPaletteJson)
        : settings.emailPaletteJson
    return {
      darkGreen: parsed?.darkGreen || DEFAULT_HRD_EMAIL_PALETTE.darkGreen,
      bronzeGold: parsed?.bronzeGold || DEFAULT_HRD_EMAIL_PALETTE.bronzeGold,
      parchment: parsed?.parchment || DEFAULT_HRD_EMAIL_PALETTE.parchment,
      leatherBrown: parsed?.leatherBrown || DEFAULT_HRD_EMAIL_PALETTE.leatherBrown,
      sand: parsed?.sand || DEFAULT_HRD_EMAIL_PALETTE.sand,
      white: parsed?.white || DEFAULT_HRD_EMAIL_PALETTE.white,
      graphite: parsed?.graphite || DEFAULT_HRD_EMAIL_PALETTE.graphite,
    }
  } catch {
    return DEFAULT_HRD_EMAIL_PALETTE
  }
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
 * Dohvaća postojeći službeni HRD logo iz postavki sustava (settings.logoUrl).
 * Ne generira zamjenski logo ako nije dostupan, već vraća upozorenje.
 */
export function resolveOfficialHrdLogo(
  settings: any,
  forBrowserPreview = false
): ResolvedLogoResult {
  const rawLogo = String(settings?.logoUrl || "").trim()
  if (!rawLogo) {
    return {
      hasLogo: false,
      imgSrc: null,
      warning:
        "Upozorenje: Službeni HRD logotip nije postavljen u Postavkama sustava. Učitajte službeni logotip u Postavkama kako bi bio prikazan u zaglavlju e-maila.",
    }
  }

  if (forBrowserPreview) {
    return {
      hasLogo: true,
      imgSrc: rawLogo,
    }
  }

  const dataMatch = rawLogo.match(/^data:([^;,]+);base64,([\s\S]+)$/i)
  if (dataMatch) {
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
}

export interface ResolvedSignatureResult {
  hasSignature: boolean
  signatureHtml: string
  signaturePlain: string
  warning?: string
}

/**
 * Dohvaća postojeći standardizirani potpis na temelju prijavljenog korisnika / pošiljatelja
 * ili postojećeg konfiguriranog potpisa u Postavkama (paymentEmailSignature / userSignaturesJson).
 * Ne generira zamjenski potpis ako ne postoji.
 */
export function resolveStandardizedSignature(
  settings: any,
  sender?: SenderIdentityInput | null
): ResolvedSignatureResult {
  let rawSig = ""

  // 1. Provjeri postoji li pojedinačno mapirani standardizirani potpis za ovog korisnika
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

  if (!rawSig) {
    return {
      hasSignature: false,
      signatureHtml: "",
      signaturePlain: "",
      warning:
        "Upozorenje: Za odabranog pošiljatelja nije pronađen standardizirani potpis. Molimo administrativno povežite ili unesite postojeći standardizirani potpis u Postavkama e-pošte.",
    }
  }

  const isHtml = /<[a-z][\s\S]*>/i.test(rawSig)
  const signatureHtml = isHtml
    ? rawSig
    : `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: #292929;">${escapeHtml(
        rawSig
      ).replace(/\n/g, "<br/>")}</div>`

  const signaturePlain = isHtml
    ? rawSig
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .trim()
    : rawSig

  return {
    hasSignature: true,
    signatureHtml,
    signaturePlain,
  }
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
 * Gradi centralizirani, responzivni tablični HTML e-mail (max 600px) prema službenom
 * vizualnom identitetu HRD „Pavao Ritter Vitezović”.
 */
export function buildHrdMasterEmail({
  templateType = "sluzbena_obavijest",
  title,
  subtitle,
  sentDate,
  greeting,
  bodyTextOrHtml,
  isBodyHtml = false,
  infoBoxTitle,
  infoBoxHtml,
  ctaText,
  ctaUrl,
  closingText,
  extraContentHtml,
  settings,
  sender,
  forBrowserPreview = false,
  customWebsiteUrl,
}: BuildHrdEmailParams): BuiltHrdEmailResult {
  const palette = getHrdPaletteFromSettings(settings)
  const typeMeta =
    HRD_EMAIL_TEMPLATE_TYPES.find((t) => t.id === templateType) || HRD_EMAIL_TEMPLATE_TYPES[0]

  const logoRes = resolveOfficialHrdLogo(settings, forBrowserPreview)
  const sigRes = resolveStandardizedSignature(settings, sender)

  const warnings: string[] = []
  if (logoRes.warning) warnings.push(logoRes.warning)
  if (sigRes.warning) warnings.push(sigRes.warning)

  const inlineAttachments: BuiltHrdEmailResult["inlineAttachments"] = []
  if (logoRes.inlineAttachment) {
    inlineAttachments.push(logoRes.inlineAttachment)
  }

  const formattedSentDate = formatHrdEmailDate(sentDate || new Date())
  const societyName = "Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”"
  const websiteUrl = (customWebsiteUrl || settings?.officialWebsiteUrl || "https://rodoslovlje.hr").trim()
  const headerSubtitle = subtitle || typeMeta.headerSubtitle
  const effectiveTitle = title || typeMeta.defaultTitle

  // Formatiranje glavnog sadržaja s poveznicama u Kožno smeđoj (#704C3A)
  const formattedBodyHtml = isBodyHtml
    ? bodyTextOrHtml
    : escapeHtml(bodyTextOrHtml)
        .replace(
          /(https?:\/\/[^\s<]+)/g,
          `<a href="$1" target="_blank" style="color: ${palette.leatherBrown}; font-weight: bold; text-decoration: underline;">$1</a>`
        )
        .replace(/\n/g, "<br/>")

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
      .hrd-header-pad { padding: 22px 18px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${palette.parchment}; color: ${palette.graphite}; font-family: Arial, Helvetica, sans-serif;">
  <!-- 1. Vanjska pozadina u boji #EAE1D1 -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${palette.parchment}; width: 100%; margin: 0; padding: 24px 10px;">
    <tr>
      <td align="center">
        <!-- Glavna tablica maksimalne širine 600 px -->
        <table role="presentation" class="hrd-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; background-color: ${palette.white}; border: 1px solid ${palette.sand}; border-collapse: collapse;">
          
          <!-- 2. Glavno zaglavlje u boji #343C32 + 3. Postojeći službeni HRD logo + 4. Naziv društva -->
          <tr>
            <td class="hrd-header-pad" style="background-color: ${palette.darkGreen}; padding: 26px 32px; text-align: left;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  ${
                    logoRes.hasLogo && logoRes.imgSrc
                      ? `<td width="68" valign="middle" style="padding-right: 16px; width: 68px;">
                          <img src="${logoRes.imgSrc}" alt="HRD Logo" width="60" style="display: block; max-width: 60px; height: auto; border: 0;" />
                        </td>`
                      : ""
                  }
                  <td valign="middle">
                    <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 18px; font-weight: bold; color: ${palette.white}; line-height: 1.3; margin: 0;">
                      ${societyName}
                    </div>
                    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: ${palette.bronzeGold}; font-weight: bold; letter-spacing: 0.03em; margin-top: 5px;">
                      ${escapeHtml(headerSubtitle)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 5. Zlatni razdjelnik #A17B50 -->
          <tr>
            <td height="4" style="background-color: ${palette.bronzeGold}; font-size: 1px; line-height: 4px;">&nbsp;</td>
          </tr>

          <!-- Glavna površina sadržaja #FFFFFF -->
          <tr>
            <td class="hrd-pad" style="padding: 30px 32px; background-color: ${palette.white};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                
                <!-- 6. Naslov e-maila (Georgia) i 7. Datum slanja (DD/MM/YYYY) -->
                <tr>
                  <td style="padding-bottom: 18px; border-bottom: 1px solid ${palette.parchment};">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td valign="top" style="font-family: Georgia, 'Times New Roman', serif; font-size: 20px; font-weight: bold; color: ${palette.darkGreen}; line-height: 1.3;">
                          ${escapeHtml(effectiveTitle)}
                        </td>
                        <td valign="top" align="right" style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: ${palette.leatherBrown}; white-space: nowrap; padding-left: 12px;">
                          Datum: <strong>${escapeHtml(formattedSentDate)}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                ${
                  greeting
                    ? `<tr>
                        <td style="padding-top: 20px; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; font-weight: bold; color: ${palette.graphite};">
                          ${escapeHtml(greeting)}
                        </td>
                      </tr>`
                    : ""
                }

                <!-- 8. Glavni sadržaj poruke -->
                <tr>
                  <td style="padding-top: 16px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.7; color: ${palette.graphite};">
                    ${formattedBodyHtml}
                  </td>
                </tr>

                <!-- 9. Opcionalni informativni blok s pozadinom #EAE1D1 -->
                ${
                  infoBoxHtml
                    ? `<tr>
                        <td style="padding-top: 22px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${palette.parchment}; border: 1px solid ${palette.sand}; border-left: 4px solid ${palette.bronzeGold};">
                            <tr>
                              <td style="padding: 16px 20px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: ${palette.graphite};">
                                ${
                                  infoBoxTitle
                                    ? `<div style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; font-weight: bold; color: ${palette.leatherBrown}; margin-bottom: 8px;">${escapeHtml(
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

                <!-- Dodatni ugrađeni sadržaj (npr. uplatnica, barkod, prilozi) -->
                ${
                  extraContentHtml
                    ? `<tr>
                        <td style="padding-top: 20px;">
                          ${extraContentHtml}
                        </td>
                      </tr>`
                    : ""
                }

                <!-- Gumb / Poveznica (ako postoji) -->
                ${
                  ctaText && ctaUrl
                    ? `<tr>
                        <td align="center" style="padding-top: 26px; padding-bottom: 8px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td align="center" bgcolor="${palette.darkGreen}" style="background-color: ${palette.darkGreen}; border: 2px solid ${palette.bronzeGold}; padding: 12px 28px;">
                                <a href="${escapeHtml(ctaUrl)}" target="_blank" style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; font-weight: bold; color: ${palette.white}; text-decoration: none; display: inline-block;">
                                  ${escapeHtml(ctaText)}
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>`
                    : ""
                }

                <!-- 10. Završna poruka -->
                ${
                  closingText
                    ? `<tr>
                        <td style="padding-top: 22px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: ${palette.graphite}; line-height: 1.6;">
                          ${escapeHtml(closingText)}
                        </td>
                      </tr>`
                    : ""
                }

                <!-- 11. Automatski uključeni postojeći standardizirani potpis pošiljatelja -->
                ${
                  sigRes.hasSignature
                    ? `<tr>
                        <td style="padding-top: 22px; margin-top: 16px; border-top: 1px solid ${palette.sand};">
                          <div data-hrd-signature="standardized" style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: ${palette.graphite};">
                            ${sigRes.signatureHtml}
                          </div>
                        </td>
                      </tr>`
                    : ""
                }

              </table>
            </td>
          </tr>

          <!-- Zlatni razdjelnik iznad podnožja -->
          <tr>
            <td height="2" style="background-color: ${palette.bronzeGold}; font-size: 1px; line-height: 2px;">&nbsp;</td>
          </tr>

          <!-- 12. Podnožje u boji #343C32 s nazivom Društva i poveznicom na https://rodoslovlje.hr -->
          <tr>
            <td style="background-color: ${palette.darkGreen}; padding: 18px 32px; text-align: center; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: ${palette.parchment}; line-height: 1.6;">
              <div style="font-family: Georgia, 'Times New Roman', serif; font-weight: bold; color: ${palette.white};">
                ${societyName}
              </div>
              <div style="margin-top: 4px;">
                Službena mrežna stranica: <a href="${escapeHtml(websiteUrl)}" target="_blank" style="color: ${palette.bronzeGold}; font-weight: bold; text-decoration: underline;">${escapeHtml(
    websiteUrl
  )}</a>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const plainParts = [
    `${societyName} — ${headerSubtitle}`,
    `Naslov: ${effectiveTitle}`,
    `Datum: ${formattedSentDate}`,
    "",
    greeting || "",
    isBodyHtml ? bodyTextOrHtml.replace(/<[^>]+>/g, "") : bodyTextOrHtml,
    ctaText && ctaUrl ? `\n${ctaText}: ${ctaUrl}` : "",
    closingText ? `\n${closingText}` : "",
    sigRes.hasSignature ? `\n--\n${sigRes.signaturePlain}` : "",
    `\n${societyName} | ${websiteUrl}`,
  ].filter(Boolean)

  return {
    html,
    plainText: plainParts.join("\n"),
    inlineAttachments,
    warnings,
  }
}
