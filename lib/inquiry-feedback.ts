import {
  buildHrdMasterEmail,
  escapeHtml,
  formatHrdEmailDate,
  type SenderIdentityInput,
} from "./hrd-email-system"

export type FinancialSupportChoice = "da" | "mozda" | "ne" | ""

export interface InquiryFeedbackQuestion {
  key:
    | "rating_overall"
    | "rating_clarity"
    | "rating_communication"
    | "rating_timeliness"
    | "rating_recommendation"
  shortTitle: string
  questionText: string
}

export const INQUIRY_FEEDBACK_QUESTIONS: InquiryFeedbackQuestion[] = [
  {
    key: "rating_overall",
    shortTitle: "Opće zadovoljstvo provedenim istraživanjem",
    questionText:
      "Koliko ste ukupno zadovoljni rezultatima i kvalitetom provedenog rodoslovnog istraživanja?",
  },
  {
    key: "rating_clarity",
    shortTitle: "Stručnost i jasnoća nalaza",
    questionText:
      "Koliko su Vam dostavljeni podaci, izvori i objašnjenja bili jasni, pouzdani i korisni?",
  },
  {
    key: "rating_communication",
    shortTitle: "Komunikacija i susretljivost",
    questionText:
      "Kako ocjenjujete komunikaciju, ljubaznost i profesionalnost istraživača i Društva tijekom obrade upita?",
  },
  {
    key: "rating_timeliness",
    shortTitle: "Brzina i pravovremenost obrade",
    questionText:
      "Koliko ste zadovoljni vremenom obrade upita i pravovremenim obavještavanjem o tijeku istraživanja?",
  },
  {
    key: "rating_recommendation",
    shortTitle: "Preporuka Hrvatskog rodoslovnog društva",
    questionText:
      "Koliko je vjerojatno da biste rad Hrvatskog rodoslovnog društva preporučili obitelji, prijateljima ili drugim istraživačima?",
  },
]

export const STAR_RATING_LABELS: Record<number, string> = {
  1: "Vrlo nezadovoljan/na",
  2: "Nezadovoljan/na",
  3: "Osrednje",
  4: "Zadovoljan/na",
  5: "Izuzetno zadovoljan/na",
}

export const FINANCIAL_SUPPORT_OPTIONS: Array<{
  value: Exclude<FinancialSupportChoice, "">
  label: string
  shortLabel: string
}> = [
  {
    value: "da",
    label: "Da, rado bih financijski podržao/la rad Društva",
    shortLabel: "Da, rado bih podržao/la",
  },
  {
    value: "mozda",
    label: "Možda u budućnosti",
    shortLabel: "Možda u budućnosti",
  },
  {
    value: "ne",
    label: "Trenutno nisam u mogućnosti",
    shortLabel: "Trenutno ne",
  },
]

export interface InquiryFeedbackRecord {
  id: number
  inquiry_id: number
  hasToken?: boolean
  sent_at?: string | null
  sent_by_id?: string | null
  sent_by_name?: string | null
  recipient_name?: string | null
  recipient_email?: string | null
  opened_at?: string | null
  submitted_at?: string | null
  rating_overall?: number | null
  rating_clarity?: number | null
  rating_communication?: number | null
  rating_timeliness?: number | null
  rating_recommendation?: number | null
  average_rating?: number | null
  financial_support?: FinancialSupportChoice | string | null
  comment?: string | null
  payment_info_sent_at?: string | null
  payment_info_sent_to?: string | null
}

export interface InquiryFeedbackStats {
  totalCompletedInquiries: number
  totalSent: number
  totalSubmitted: number
  responseRatePct: number
  overallAverage: number
  questionAverages: Array<{
    key: InquiryFeedbackQuestion["key"]
    shortTitle: string
    average: number
    count: number
  }>
  ratingDistribution: Array<{
    stars: 5 | 4 | 3 | 2 | 1
    count: number
    pct: number
  }>
  financialSupportSummary: {
    da: number
    mozda: number
    ne: number
    unspecified: number
  }
  recentSubmissions: Array<{
    id: number
    inquiryId: number
    subject: string
    requesterName: string
    requesterEmail: string
    researcherName: string
    inquiryDate: string
    sentAt: string | null
    submittedAt: string
    averageRating: number
    rating_overall: number
    rating_clarity: number
    rating_communication: number
    rating_timeliness: number
    rating_recommendation: number
    financialSupport: string
    comment: string
    paymentInfoSentAt?: string | null
  }>
  pendingClosedInquiries: Array<{
    inquiryId: number
    subject: string
    requesterName: string
    requesterEmail: string
    researcherName: string
    inquiryDate: string
    sentAt: string | null
    openedAt: string | null
    blockedDoNotContact: boolean
  }>
}

export function sanitizeInquiryFeedbackForClient(row: any): InquiryFeedbackRecord | null {
  if (!row) return null
  return {
    id: Number(row.id),
    inquiry_id: Number(row.inquiry_id),
    hasToken: Boolean(row.token && String(row.token).trim()),
    sent_at: row.sent_at || null,
    sent_by_id: row.sent_by_id || null,
    sent_by_name: row.sent_by_name || null,
    recipient_name: row.recipient_name || null,
    recipient_email: row.recipient_email || null,
    opened_at: row.opened_at || null,
    submitted_at: row.submitted_at || null,
    rating_overall: row.rating_overall !== null && row.rating_overall !== undefined ? Number(row.rating_overall) : null,
    rating_clarity: row.rating_clarity !== null && row.rating_clarity !== undefined ? Number(row.rating_clarity) : null,
    rating_communication: row.rating_communication !== null && row.rating_communication !== undefined ? Number(row.rating_communication) : null,
    rating_timeliness: row.rating_timeliness !== null && row.rating_timeliness !== undefined ? Number(row.rating_timeliness) : null,
    rating_recommendation: row.rating_recommendation !== null && row.rating_recommendation !== undefined ? Number(row.rating_recommendation) : null,
    average_rating: row.average_rating !== null && row.average_rating !== undefined ? Number(row.average_rating) : null,
    financial_support: row.financial_support || "",
    comment: row.comment || "",
    payment_info_sent_at: row.payment_info_sent_at || null,
    payment_info_sent_to: row.payment_info_sent_to || null,
  }
}

export function getFinancialSupportLabel(value?: string | null): string {
  const found = FINANCIAL_SUPPORT_OPTIONS.find((opt) => opt.value === value)
  return found ? found.label : "Nije navedeno"
}

export function buildInquiryFeedbackEmail(params: {
  inquiry: {
    id: number
    subject: string
    requesterName: string
    researcherName?: string | null
    inquiryDate?: string | null
  }
  surveyUrl: string
  settings?: any
  sender?: SenderIdentityInput | null
  forBrowserPreview?: boolean
}) {
  const { inquiry, surveyUrl, settings, sender, forBrowserPreview = false } = params
  const safeSubject = String(inquiry.subject || "Rodoslovno istraživanje").trim()
  const receivedDateLabel = inquiry.inquiryDate ? formatHrdEmailDate(inquiry.inquiryDate) : "—"
  const emailSubject = `Zahvala i kratka ocjena zadovoljstva — Istraživanje #${inquiry.id}: ${safeSubject}`

  const bodyParagraphs = [
    `iskreno Vam zahvaljujemo na povjerenju koje ste ukazali Hrvatskom rodoslovnom društvu „Pavao Ritter Vitezović” te na suradnji tijekom obrade Vašeg istraživačkog predmeta #${inquiry.id} („${safeSubject}”).`,
    `Kako bismo kontinuirano unapređivali kvalitetu naših rodoslovnih istraživanja, komunikacije i rada Društva, ljubazno Vas molimo da odvojite manje od minute i ocijenite provedeno istraživanje ocjenom od 1 do 5 zvjezdica putem kratkog obrasca.`,
    `Vaše mišljenje i eventualni prijedlozi iznimno su nam vrijedni za budući rad naših istraživača i očuvanje rodoslovne baštine.`,
  ]

  const infoBoxHtml = `
    <div><strong>Broj predmeta:</strong> #${inquiry.id}</div>
    <div><strong>Tema istraživanja:</strong> ${escapeHtml(safeSubject)}</div>
    <div><strong>Datum zaprimanja upita:</strong> ${escapeHtml(receivedDateLabel)}</div>
    ${inquiry.researcherName ? `<div><strong>Istraživač:</strong> ${escapeHtml(inquiry.researcherName)}</div>` : ""}
    <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #E2E8F0; color: #7C2D12;">
      <strong>Napomena:</strong> Poveznica za ocjenjivanje je osobna i jednokratna — nakon predaje ocjene trajno se pohranjuje u arhivu Društva.
    </div>
  `

  const built = buildHrdMasterEmail({
    templateType: "zahvala",
    title: `Zahvala i ocjena istraživanja #${inquiry.id}`,
    greeting: `Poštovani/a ${inquiry.requesterName || "naručitelju istraživanja"},`,
    bodyTextOrHtml: bodyParagraphs.join("\n\n"),
    infoBoxTitle: "Podaci o završenom istraživanju",
    infoBoxHtml,
    ctaText: "Ocijeni provedeno istraživanje (1–5 ★)",
    ctaUrl: surveyUrl,
    closingText: "Od srca zahvaljujemo na vremenu, povjerenju i podršci,",
    settings,
    sender,
    forBrowserPreview,
  })

  return {
    ...built,
    subject: emailSubject,
  }
}
