"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  HeartHandshake,
  Loader2,
  Lock,
  Mail,
  QrCode,
  Send,
  Sparkles,
  Star,
} from "lucide-react"
import {
  FINANCIAL_SUPPORT_OPTIONS,
  INQUIRY_FEEDBACK_QUESTIONS,
  STAR_RATING_LABELS,
  type FinancialSupportChoice,
  type InquiryFeedbackQuestion,
} from "@/lib/inquiry-feedback"
import { formatDateDMY, formatDateTimeDMY } from "@/lib/utils"

interface DonationPaymentData {
  recipientName: string
  recipientStreet: string
  recipientCity: string
  iban: string
  model: string
  reference: string
  purpose: string
  description: string
  amountNote: string
  hub3BarcodeDataUrl: string
  epcQrDataUrl: string
}

interface PublicSurveyData {
  isPreview?: boolean
  alreadySubmitted?: boolean
  submittedAt?: string
  inquiry: {
    id: number
    subject: string
    requesterName: string
    researcherName?: string | null
    inquiryDate?: string | null
  }
  requesterEmail?: string
  paymentInfoSentAt?: string | null
  paymentInfoSentTo?: string | null
  donationPayment?: DonationPaymentData
  societyName?: string
  iban?: string
}

export default function PublicInquiryFeedbackPage() {
  const params = useParams()
  const token = String(params?.token || "")

  const [loading, setLoading] = React.useState(true)
  const [errorMsg, setErrorMsg] = React.useState("")
  const [surveyData, setSurveyData] = React.useState<PublicSurveyData | null>(null)

  const [ratings, setRatings] = React.useState<Record<InquiryFeedbackQuestion["key"], number>>({
    rating_overall: 0,
    rating_clarity: 0,
    rating_communication: 0,
    rating_timeliness: 0,
    rating_recommendation: 0,
  })
  const [hoverRatings, setHoverRatings] = React.useState<Record<string, number>>({})
  const [financialSupport, setFinancialSupport] = React.useState<FinancialSupportChoice>("")
  const [comment, setComment] = React.useState("")

  const [donationEmail, setDonationEmail] = React.useState("")
  const [sendingPaymentInfo, setSendingPaymentInfo] = React.useState(false)
  const [paymentInfoError, setPaymentInfoError] = React.useState("")
  const [paymentInfoSent, setPaymentInfoSent] = React.useState<{
    sentTo: string
    sentAt: string
    isPreview?: boolean
    message?: string
  } | null>(null)
  const [copiedIban, setCopiedIban] = React.useState(false)
  const [postSubmitPaymentToken, setPostSubmitPaymentToken] = React.useState<string | null>(null)

  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState("")
  const [submitResult, setSubmitResult] = React.useState<{
    submittedAt: string
    averageRating: number
  } | null>(null)

  React.useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    setErrorMsg("")
    fetch(`/api/public/inquiry-feedback/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data?.error || "Poveznica za ocjenjivanje nije valjana ili je već iskorištena.")
        }
        return data as PublicSurveyData
      })
      .then((data) => {
        if (!cancelled) {
          setSurveyData(data)
          if (data.requesterEmail) {
            setDonationEmail(data.requesterEmail)
          }
          if (data.paymentInfoSentAt) {
            setPaymentInfoSent({
              sentTo: data.paymentInfoSentTo || data.requesterEmail || "",
              sentAt: data.paymentInfoSentAt,
            })
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setErrorMsg(err?.message || "Greška pri učitavanju ankete.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token])

  const answeredCount = Object.values(ratings).filter((v) => v >= 1 && v <= 5).length
  const allQuestionsRated = answeredCount === INQUIRY_FEEDBACK_QUESTIONS.length
  const currentAvg =
    answeredCount > 0
      ? Object.values(ratings).reduce((a, b) => a + b, 0) / answeredCount
      : 0

  const handleCopyIban = async (ibanValue: string) => {
    try {
      await navigator.clipboard.writeText(ibanValue)
      setCopiedIban(true)
      setTimeout(() => setCopiedIban(false), 2500)
    } catch {}
  }

  const handleSendPaymentInfoEmail = async () => {
    const cleanEmail = donationEmail.trim()
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setPaymentInfoError("Molimo unesite valjanu e-mail adresu na koju želite primiti podatke za uplatu.")
      return
    }

    setSendingPaymentInfo(true)
    setPaymentInfoError("")
    try {
      const res = await fetch(`/api/public/inquiry-feedback/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send-payment-info",
          email: cleanEmail,
          paymentEmailToken: postSubmitPaymentToken || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        throw new Error(data.error || "Slanje podataka za uplatu na e-mail nije uspjelo.")
      }
      setPaymentInfoSent({
        sentTo: data.sentTo || cleanEmail,
        sentAt: data.sentAt || new Date().toISOString(),
        isPreview: Boolean(data.isPreview),
        message: data.message,
      })
    } catch (err: any) {
      setPaymentInfoError(err?.message || "Greška pri slanju podataka za uplatu.")
    } finally {
      setSendingPaymentInfo(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!allQuestionsRated) {
      setSubmitError("Molimo ocijenite svih 5 pitanja zvjezdicama (1–5) prije predaje.")
      return
    }
    if (surveyData?.isPreview) {
      setSubmitError("Ovo je testni pregled obrasca. Stvarni korisnici ovdje predaju svoju ocjenu.")
      return
    }

    setSubmitting(true)
    setSubmitError("")
    try {
      const res = await fetch(`/api/public/inquiry-feedback/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...ratings,
          financial_support: financialSupport,
          comment: comment.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        throw new Error(data.error || "Spremanje ocjene nije uspjelo.")
      }
      if (data.paymentEmailToken) {
        setPostSubmitPaymentToken(String(data.paymentEmailToken))
      }
      setSubmitResult({
        submittedAt: data.submittedAt || new Date().toISOString(),
        averageRating: Number(data.averageRating || currentAvg),
      })
    } catch (err: any) {
      setSubmitError(err?.message || "Greška pri slanju ocjene.")
    } finally {
      setSubmitting(false)
    }
  }

  const renderDonationPaymentBox = () => {
    const dp = surveyData?.donationPayment
    const ibanText = dp?.iban || surveyData?.iban || "HR6523600001102892498"

    return (
      <div className="rounded-2xl border-2 border-[#D97706]/50 bg-[#FEFCE8] p-4 sm:p-5 text-left space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D97706]/25 pb-2.5">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#7C2D12] shrink-0" />
            <div>
              <h4 className="font-serif text-sm sm:text-base font-bold text-[#7C2D12]">
                Podaci, 2D barkod i QR kod za dobrovoljnu donaciju Društvu
              </h4>
              <p className="text-[11px] text-slate-700">
                Možete odmah skenirati kod mobitelom ili si poslati kompletne upute i slike na e-mail.
              </p>
            </div>
          </div>
          <Badge className="bg-[#1E3A5F] text-white text-[10px]">
            Proizvoljan iznos
          </Badge>
        </div>

        {/* Osnovni podaci za uplatu */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 text-xs text-slate-800 space-y-1.5">
          <div>
            <strong>Primatelj:</strong>{" "}
            {dp?.recipientName || "Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”"}
          </div>
          <div>
            <strong>Adresa:</strong>{" "}
            {dp ? `${dp.recipientStreet}, ${dp.recipientCity}` : "Trg Marka Marulića 21, 10000 Zagreb"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span>
              <strong>IBAN:</strong>{" "}
              <span className="font-mono font-bold text-[#1E3A5F]">{ibanText}</span>
            </span>
            <button
              type="button"
              onClick={() => handleCopyIban(ibanText)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-[#FBF9F6] px-2.5 py-0.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-100"
            >
              {copiedIban ? (
                <>
                  <Check className="h-3 w-3 text-emerald-700" />
                  Kopirano
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Kopiraj IBAN
                </>
              )}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-0.5">
            <div>
              <strong>Model i poziv na broj:</strong>{" "}
              <span className="font-mono">{dp ? `${dp.model} ${dp.reference}` : `HR00 ${new Date().getFullYear()}`}</span>
            </div>
            <div>
              <strong>Šifra namjene:</strong> <span className="font-mono">{dp?.purpose || "CHAR"}</span>
            </div>
          </div>
          <div>
            <strong>Opis plaćanja:</strong> {dp?.description || "Donacija za rad Društva"}
          </div>
        </div>

        {/* Prikaz kodova za skeniranje (HUB-3A + SEPA QR) */}
        {dp && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 flex flex-col items-center text-center gap-2">
              <div className="text-xs font-bold text-[#7C2D12]">
                2D barkod (HUB-3A — HR m-bankarstvo)
              </div>
              <div className="rounded-lg border border-[#E2E8F0] bg-white p-2">
                <img
                  src={dp.hub3BarcodeDataUrl}
                  alt="2D HUB-3A barkod za donaciju"
                  className="max-w-[230px] w-full h-auto mx-auto"
                />
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Odaberite „Skeniraj i plati” (m-zaba, PBZ, George, OTP, RBA, HPB) i upišite željeni iznos.
              </p>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 flex flex-col items-center text-center gap-2">
              <div className="text-xs font-bold text-[#7C2D12]">
                SEPA QR kod (EU / inozemne uplate)
              </div>
              <div className="rounded-lg border border-[#E2E8F0] bg-white p-2">
                <img
                  src={dp.epcQrDataUrl}
                  alt="SEPA QR kod za donaciju"
                  className="w-[144px] h-[144px] object-contain mx-auto"
                />
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Za mobilne aplikacije banaka izvan Hrvatske ili standardne QR čitače uplatnica.
              </p>
            </div>
          </div>
        )}

        {/* Slanje kompletnih uputa i slika na e-mail */}
        <div className="rounded-xl border border-[#CEA369]/60 bg-white p-3.5 space-y-2.5">
          {paymentInfoSent ? (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-950 flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold">
                  {paymentInfoSent.isPreview
                    ? "Testna simulacija slanja potvrđena"
                    : "Kompletni podaci i QR/2D kodovi poslani su na Vaš e-mail!"}
                </div>
                <p className="leading-relaxed">
                  {paymentInfoSent.message ||
                    `E-mail sa svim uputama za uplatu i priloženim barkodovima poslan je na adresu ${paymentInfoSent.sentTo} (${formatDateTimeDMY(
                      paymentInfoSent.sentAt
                    )}).`}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-[#1E3A5F] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-[#1E3A5F]">
                    Želite li ove podatke i QR kodove primiti i u svoj e-mail sandučić?
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Poslat ćemo Vam kompletan e-mail s uputama za uplatu i ugrađenim slikama (2D barkod i SEPA QR kod).
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  value={donationEmail}
                  onChange={(e) => setDonationEmail(e.target.value)}
                  placeholder="vasa.adresa@email.hr"
                  aria-label="E-mail adresa za slanje podataka za uplatu"
                  className="bg-[#FBF9F6] border-[#E8E4DE] h-10 text-base sm:text-sm"
                />
                <Button
                  type="button"
                  onClick={handleSendPaymentInfoEmail}
                  disabled={sendingPaymentInfo}
                  className="rounded-full h-10 px-5 bg-[#1E3A5F] hover:bg-[#162D4A] text-white border-2 border-[#D97706] font-bold shrink-0 gap-2"
                >
                  {sendingPaymentInfo ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Slanje na e-mail…
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 text-[#FEFCE8]" />
                      Pošalji upute i QR kod na moj e-mail
                    </>
                  )}
                </Button>
              </div>

              {paymentInfoError && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{paymentInfoError}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F2EFE9] text-[#1B2B36] py-6 px-4 sm:py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Službeno HRD zaglavlje */}
        <div className="rounded-3xl overflow-hidden border border-[#E2E8F0] bg-white shadow-lg">
          <div className="bg-[#1E3A5F] border-b-4 border-[#D97706] px-6 py-6 text-white">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#FEFCE8]/90">
              Hrvatsko rodoslovno društvo
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold mt-1">
              Pavao Ritter Vitezović
            </h1>
            <p className="text-xs sm:text-sm text-[#F8FAFC]/90 mt-2">
              Provjera zadovoljstva korisnika provedenim rodoslovnim istraživanjem
            </p>
          </div>

          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-[#1E3A5F]" />
              <p className="text-sm font-medium">Učitavanje obrasca za ocjenjivanje…</p>
            </div>
          ) : errorMsg ? (
            <div className="p-8 text-center space-y-4">
              <div className="mx-auto h-14 w-14 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800">
                <Lock className="h-7 w-7" />
              </div>
              <h2 className="font-serif text-xl font-bold text-[#7C2D12]">
                Obrazac nije dostupan
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed max-w-md mx-auto">
                {errorMsg}
              </p>
            </div>
          ) : surveyData?.alreadySubmitted ? (
            <div className="p-8 text-center space-y-4">
              <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="font-serif text-xl font-bold text-[#1E3A5F]">
                Ocjena je već predana
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed max-w-md mx-auto">
                Zahvaljujemo Vam! Vaša ocjena za istraživanje{" "}
                <strong>„{surveyData.inquiry.subject}”</strong> već je zaprimljena{" "}
                {surveyData.submittedAt ? `(${formatDateTimeDMY(surveyData.submittedAt)})` : ""} i
                pohranjena u arhivu Društva.
              </p>
            </div>
          ) : submitResult ? (
            <div className="p-6 sm:p-10 text-center space-y-5">
              <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 border-2 border-emerald-400 flex items-center justify-center text-emerald-700">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h2 className="font-serif text-2xl font-bold text-[#1E3A5F]">
                  Od srca Vam hvala na ocjeni!
                </h2>
                <p className="text-sm text-slate-700 leading-relaxed max-w-md mx-auto">
                  Vaši odgovori i zabilježena prosječna ocjena{" "}
                  <strong className="text-[#7C2D12]">
                    {submitResult.averageRating.toFixed(2)} / 5
                  </strong>{" "}
                  trajno su pohranjeni u arhivu Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović”.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FEFCE8] border border-[#D97706]/40 px-4 py-2 text-sm font-bold text-[#7C2D12]">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 ${
                      star <= Math.round(submitResult.averageRating)
                        ? "fill-[#D97706] text-[#D97706]"
                        : "text-slate-300"
                    }`}
                  />
                ))}
                <span className="ml-1.5">{submitResult.averageRating.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Predano: {formatDateTimeDMY(submitResult.submittedAt)}
              </p>

              {financialSupport === "da" && (
                <div className="pt-2">{renderDonationPaymentBox()}</div>
              )}
            </div>
          ) : surveyData ? (
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
              {surveyData.isPreview && (
                <div className="rounded-2xl border border-amber-300 bg-[#FEFCE8] p-3.5 text-xs text-[#7C2D12] flex items-center gap-2.5">
                  <Sparkles className="h-4 w-4 shrink-0 text-[#D97706]" />
                  <span>
                    <strong>Testni pregled obrasca:</strong> Prikaz izgleda javne ankete sa zvjezdicama za korisnike.
                  </span>
                </div>
              )}

              {/* Podaci o predmetu */}
              <div className="rounded-2xl border border-[#E2E8F0] border-l-4 border-l-[#D97706] bg-[#FEFCE8] p-4 space-y-1.5 text-xs sm:text-sm">
                <div className="font-serif font-bold text-[#7C2D12] text-sm">
                  Poštovani/a {surveyData.inquiry.requesterName},
                </div>
                <p className="text-slate-700 leading-relaxed">
                  zahvaljujemo na povjerenju i suradnji. Molimo Vas da ocjenama od{" "}
                  <strong>1 do 5 zvjezdica</strong> ocijenite naše istraživanje kako bismo unaprijedili rad Društva:
                </p>
                <div className="pt-2 mt-2 border-t border-[#E2E8F0] grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-700">
                  <div>
                    <strong>Predmet:</strong>{" "}
                    {surveyData.inquiry.id > 0 ? `#${surveyData.inquiry.id} — ` : ""}
                    {surveyData.inquiry.subject}
                  </div>
                  {surveyData.inquiry.researcherName && (
                    <div>
                      <strong>Istraživač:</strong> {surveyData.inquiry.researcherName}
                    </div>
                  )}
                  {surveyData.inquiry.inquiryDate && (
                    <div>
                      <strong>Zaprimljeno:</strong>{" "}
                      {formatDateDMY(surveyData.inquiry.inquiryDate)}
                    </div>
                  )}
                </div>
              </div>

              {/* 5 pitanja sa zvjezdicama 1-5 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-serif text-base sm:text-lg font-bold text-[#1E3A5F]">
                    Ocjenjivanje kvalitete rada (1–5 zvjezdica)
                  </h2>
                  <Badge
                    variant="outline"
                    className={`text-xs font-bold ${
                      allQuestionsRated
                        ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                        : "border-[#CEA369] bg-[#FBF9F6] text-[#1E3A5F]"
                    }`}
                  >
                    Ocijenjeno {answeredCount} / {INQUIRY_FEEDBACK_QUESTIONS.length}
                  </Badge>
                </div>

                {INQUIRY_FEEDBACK_QUESTIONS.map((q, idx) => {
                  const val = ratings[q.key]
                  const hoverVal = hoverRatings[q.key] || 0
                  const displayVal = hoverVal || val
                  return (
                    <div
                      key={q.key}
                      className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] p-4 space-y-3"
                    >
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-[#7C2D12]">
                          {idx + 1}. {q.shortTitle}
                        </div>
                        <p className="text-sm font-medium text-[#1B2B36] mt-0.5 leading-snug">
                          {q.questionText}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div
                          className="flex items-center gap-1.5"
                          role="radiogroup"
                          aria-label={q.shortTitle}
                        >
                          {[1, 2, 3, 4, 5].map((star) => {
                            const active = star <= displayVal
                            return (
                              <button
                                key={star}
                                type="button"
                                role="radio"
                                aria-checked={val === star}
                                aria-label={`${star} od 5 zvjezdica (${STAR_RATING_LABELS[star]})`}
                                onMouseEnter={() =>
                                  setHoverRatings((prev) => ({ ...prev, [q.key]: star }))
                                }
                                onMouseLeave={() =>
                                  setHoverRatings((prev) => ({ ...prev, [q.key]: 0 }))
                                }
                                onClick={() =>
                                  setRatings((prev) => ({ ...prev, [q.key]: star }))
                                }
                                className="p-1.5 rounded-xl transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#CEA369]"
                              >
                                <Star
                                  className={`h-8 w-8 sm:h-9 sm:w-9 transition-colors ${
                                    active
                                      ? "fill-[#D97706] text-[#D97706] drop-shadow-xs"
                                      : "fill-white text-slate-300 hover:text-[#D97706]/60"
                                  }`}
                                />
                              </button>
                            )
                          })}
                        </div>

                        <span className="text-xs font-semibold text-[#1E3A5F] min-w-[140px] sm:text-right">
                          {displayVal > 0
                            ? `${displayVal}/5 — ${STAR_RATING_LABELS[displayVal]}`
                            : "Odaberite zvjezdice"}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Neobavezno pitanje: Financijska podrška radu Društva */}
              <div className="rounded-2xl border border-[#E8E4DE] bg-white p-4 sm:p-5 space-y-3 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <HeartHandshake className="h-5 w-5 text-[#D97706] shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-[#1E3A5F]">
                        Postoji li mogućnost financijske podrške radu Društva?
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Ovo pitanje nije obavezno. Vaš odgovor nam pomaže u planiranju projekata i očuvanju rodoslovne građe.
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    Nije obavezno
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {FINANCIAL_SUPPORT_OPTIONS.map((opt) => {
                    const selected = financialSupport === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setFinancialSupport((prev) => (prev === opt.value ? "" : opt.value))
                        }
                        className={`rounded-xl border-2 px-3 py-2.5 text-left text-xs font-semibold transition-all ${
                          selected
                            ? "border-[#D97706] bg-[#FEFCE8] text-[#7C2D12] shadow-xs"
                            : "border-[#E8E4DE] bg-[#FBF9F6] text-slate-700 hover:border-[#1E3A5F]/40"
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>

                {financialSupport === "da" && renderDonationPaymentBox()}
              </div>

              {/* Neobavezni dodatni komentar */}
              <div className="space-y-1.5">
                <label
                  htmlFor="feedback-comment"
                  className="text-xs sm:text-sm font-bold text-[#1E3A5F] block"
                >
                  Dodatni komentar, pohvala ili prijedlog <span className="font-normal text-muted-foreground">(nije obavezno)</span>
                </label>
                <Textarea
                  id="feedback-comment"
                  rows={4}
                  maxLength={2000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Podijelite svoje dojmove, pohvale ili prijedloge za unapređenje rada Društva…"
                  className="bg-white border-[#E8E4DE] rounded-2xl text-base sm:text-sm"
                />
              </div>

              {submitError && (
                <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#E8E4DE]">
                <span className="text-xs text-muted-foreground">
                  {answeredCount > 0
                    ? `Trenutni prosjek Vaših ocjena: ${currentAvg.toFixed(2)} / 5 ★`
                    : "Ocijenite svih 5 pitanja kako biste predali anketu."}
                </span>
                <Button
                  type="submit"
                  disabled={!allQuestionsRated || submitting}
                  className="rounded-full h-11 px-7 bg-[#1E3A5F] hover:bg-[#162D4A] text-white border-2 border-[#CEA369] font-bold shadow-md gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Spremanje ocjene…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 text-[#CEA369]" />
                      Pošalji ocjenu
                    </>
                  )}
                </Button>
              </div>
            </form>
          ) : null}
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović” • Trg Marka Marulića 21, 10000 Zagreb • www.rodoslovlje.hr
        </p>
      </div>
    </div>
  )
}
