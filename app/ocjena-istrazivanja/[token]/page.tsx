"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  AlertCircle,
  CheckCircle2,
  HeartHandshake,
  Loader2,
  Lock,
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
        if (!cancelled) setSurveyData(data)
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
            <div className="p-8 sm:p-10 text-center space-y-5">
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

                {financialSupport === "da" && (
                  <div className="rounded-xl border border-[#D97706]/40 bg-[#FEFCE8] p-3 text-xs text-slate-800 space-y-1">
                    <div className="font-bold text-[#7C2D12]">
                      Podaci za dobrovoljnu donaciju Društvu:
                    </div>
                    <div>
                      <strong>Primatelj:</strong> Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”
                    </div>
                    <div>
                      <strong>IBAN:</strong>{" "}
                      <span className="font-mono font-bold">
                        {surveyData.iban || "HR6523600001102892498"}
                      </span>
                    </div>
                    <div>
                      <strong>Opis plaćanja:</strong> Donacija za rad Društva
                    </div>
                  </div>
                )}
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
                  className="bg-white border-[#E8E4DE] rounded-2xl text-sm"
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
