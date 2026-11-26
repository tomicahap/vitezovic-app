"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Award,
  CheckCircle2,
  HeartHandshake,
  Loader2,
  Mail,
  MessageSquareText,
  RefreshCw,
  Send,
  Star,
  TrendingUp,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDateDMY, formatDateTimeDMY } from "@/lib/utils"
import {
  getFinancialSupportLabel,
  type InquiryFeedbackStats,
} from "@/lib/inquiry-feedback"

function StarRow({
  rating,
  size = "sm",
}: {
  rating: number
  size?: "xs" | "sm" | "md"
}) {
  const cls =
    size === "xs"
      ? "h-3 w-3"
      : size === "md"
      ? "h-5 w-5"
      : "h-4 w-4"
  const rounded = Math.round(rating)
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${cls} ${
            s <= rounded
              ? "fill-[#D97706] text-[#D97706]"
              : "fill-slate-100 text-slate-300"
          }`}
        />
      ))}
    </span>
  )
}

export function InquiryFeedbackStatsPanel({
  user,
  getAuthHeaders,
  onOpenInquiryById,
  onSendFeedbackForInquiryId,
  refreshKey = 0,
}: {
  user: any
  getAuthHeaders: (user: any) => Record<string, string>
  onOpenInquiryById: (inquiryId: number) => void
  onSendFeedbackForInquiryId?: (inquiryId: number) => void
  refreshKey?: number
}) {
  const [stats, setStats] = useState<InquiryFeedbackStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [archiveFilter, setArchiveFilter] = useState<"all" | "with_comment" | "support_yes">("all")

  const loadStats = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/projects/inquiries/feedback", {
        cache: "no-store",
        headers: getAuthHeaders(user),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Greška pri dohvaćanju statistike zadovoljstva.")
      }
      setStats(data)
    } catch (e: any) {
      setError(e?.message || "Greška pri dohvaćanju statistike.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      loadStats()
    }
  }, [user?.id, refreshKey])

  const filteredSubmissions = useMemo(() => {
    const list = stats?.recentSubmissions || []
    if (archiveFilter === "with_comment") {
      return list.filter((s) => Boolean(s.comment && s.comment.trim()))
    }
    if (archiveFilter === "support_yes") {
      return list.filter((s) => s.financialSupport === "da" || s.financialSupport === "mozda")
    }
    return list
  }, [stats?.recentSubmissions, archiveFilter])

  const isAdmin = String(user?.role || "").toLowerCase() === "admin"

  if (loading && !stats) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-7 w-7 animate-spin text-[#1E3A5F]" />
        <p className="text-xs font-medium">Učitavanje statistike zadovoljstva korisnika…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
        <p className="text-sm font-semibold text-red-800">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={loadStats}>
          Pokušaj ponovno
        </Button>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-6">
      {/* KPI traka */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-[#CEA369]/50 bg-gradient-to-br from-[#FEFCE8] to-white p-4 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7C2D12]">
              Ukupna prosječna ocjena
            </span>
            <Award className="h-4 w-4 text-[#D97706]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl font-bold text-[#1E3A5F]">
              {stats.totalSubmitted > 0 ? stats.overallAverage.toFixed(2) : "—"}
            </span>
            {stats.totalSubmitted > 0 && (
              <span className="text-xs font-semibold text-muted-foreground">/ 5.00</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StarRow rating={stats.overallAverage} size="sm" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Ispunjene ankete / odaziv
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl font-bold text-primary">
              {stats.totalSubmitted}
            </span>
            <span className="text-xs text-muted-foreground">
              od {stats.totalSent} poslanih
            </span>
          </div>
          <p className="text-xs text-emerald-800 font-semibold">
            Stopa odaziva: {stats.responseRatePct}% (zatvorenih predmeta: {stats.totalCompletedInquiries})
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Mogućnost financijske podrške
            </span>
            <HeartHandshake className="h-4 w-4 text-rose-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl font-bold text-primary">
              {stats.financialSupportSummary.da}
            </span>
            <span className="text-xs text-muted-foreground">
              + {stats.financialSupportSummary.mozda} možda
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Iskazan interes za podršku radu Društva
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Čeka slanje ili odgovor
            </span>
            <Mail className="h-4 w-4 text-[#1E3A5F]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl font-bold text-primary">
              {stats.pendingClosedInquiries.length}
            </span>
            <span className="text-xs text-muted-foreground">zatvorenih predmeta</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Poslano i čeka: {Math.max(0, stats.totalSent - stats.totalSubmitted)}
            </span>
            <button
              type="button"
              onClick={loadStats}
              className="text-[11px] font-semibold text-[#1E3A5F] hover:underline inline-flex items-center gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Osvježi
            </button>
          </div>
        </div>
      </div>

      {/* Analitika po pitanjima i distribucija zvjezdica */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Prosjek po pitanjima */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-base font-bold text-[#1E3A5F] flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#D97706]" />
              Prosječne ocjene po kriterijima (1–5 zvjezdica)
            </h3>
            <Badge variant="outline" className="text-[11px]">
              {stats.totalSubmitted} predanih ocjena
            </Badge>
          </div>

          <div className="space-y-3">
            {stats.questionAverages.map((q, idx) => {
              const pct = Math.round((q.average / 5) * 100)
              return (
                <div key={q.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-foreground">
                      {idx + 1}. {q.shortTitle}
                    </span>
                    <span className="inline-flex items-center gap-2 shrink-0">
                      <StarRow rating={q.average} size="xs" />
                      <strong className="font-mono text-[#1E3A5F]">
                        {q.count > 0 ? q.average.toFixed(2) : "—"}
                      </strong>
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#1E3A5F] to-[#D97706] transition-all duration-500"
                      style={{ width: `${q.count > 0 ? Math.max(4, pct) : 0}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Raspodjela zvjezdica i financijska podrška */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-5 shadow-2xs">
          <div className="space-y-3">
            <h3 className="font-serif text-base font-bold text-[#1E3A5F]">
              Raspodjela ukupnih ocjena
            </h3>
            <div className="space-y-2">
              {stats.ratingDistribution.map((row) => (
                <div key={row.stars} className="flex items-center gap-2 text-xs">
                  <span className="w-12 font-semibold text-[#7C2D12] shrink-0">
                    {row.stars} ★
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#D97706]"
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <span className="w-14 text-right font-mono text-[11px] text-muted-foreground">
                    {row.count} ({row.pct}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-border space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1E3A5F]">
              Financijska podrška Društvu (opcijsko)
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                <div className="text-[10px] text-emerald-900 font-bold uppercase">Da, podržao/la bi</div>
                <div className="text-lg font-bold text-emerald-900">{stats.financialSupportSummary.da}</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
                <div className="text-[10px] text-amber-900 font-bold uppercase">Možda kasnije</div>
                <div className="text-lg font-bold text-amber-900">{stats.financialSupportSummary.mozda}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[10px] text-slate-700 font-bold uppercase">Trenutno ne</div>
                <div className="text-lg font-bold text-slate-800">{stats.financialSupportSummary.ne}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div className="text-[10px] text-muted-foreground font-bold uppercase">Bez odgovora</div>
                <div className="text-lg font-bold text-muted-foreground">{stats.financialSupportSummary.unspecified}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Zatvoreni predmeti za slanje ankete (Administrator) */}
      {isAdmin && stats.pendingClosedInquiries.length > 0 && (
        <div className="rounded-2xl border border-amber-300/80 bg-[#FEFCE8]/60 p-5 space-y-3 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-serif text-base font-bold text-[#7C2D12]">
                Zatvoreni predmeti spremni za provjeru zadovoljstva ({stats.pendingClosedInquiries.length})
              </h3>
              <p className="text-xs text-slate-700">
                Administrator može jednim klikom poslati zahvalni e-mail s pozivom na ocjenjivanje (1–5 zvjezdica) naručitelju istraživanja.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
            {stats.pendingClosedInquiries.map((item) => (
              <div
                key={item.inquiryId}
                className="rounded-xl border border-border bg-white p-3 flex items-center justify-between gap-3 shadow-2xs"
              >
                <div className="min-w-0 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => onOpenInquiryById(item.inquiryId)}
                    className="text-xs font-bold text-[#1E3A5F] hover:underline truncate block text-left"
                  >
                    #{item.inquiryId} — {item.subject}
                  </button>
                  <div className="text-[11px] text-muted-foreground truncate">
                    Naručitelj: <strong>{item.requesterName}</strong>
                    {item.requesterEmail ? ` (${item.requesterEmail})` : " (nema e-maila)"}
                  </div>
                  {item.sentAt && (
                    <div className="text-[10px] text-amber-800 font-semibold">
                      Poslano: {formatDateTimeDMY(item.sentAt)}
                      {item.openedAt ? ` • Otvoreno: ${formatDateTimeDMY(item.openedAt)}` : " • Čeka otvaranje"}
                    </div>
                  )}
                </div>

                {onSendFeedbackForInquiryId && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!item.requesterEmail || item.blockedDoNotContact}
                    onClick={() => onSendFeedbackForInquiryId(item.inquiryId)}
                    className="rounded-full h-8 px-3 text-[11px] font-bold bg-[#1E3A5F] hover:bg-[#162D4A] text-white border border-[#D97706] shrink-0 gap-1"
                    title={
                      item.blockedDoNotContact
                        ? "Naručitelj ima oznaku Ne kontaktirati"
                        : !item.requesterEmail
                        ? "Naručitelj nema upisanu e-mail adresu"
                        : undefined
                    }
                  >
                    <Send className="h-3 w-3 text-[#D97706]" />
                    {item.sentAt ? "Pošalji ponovno" : "Pošalji anketu"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Arhiva svih zaprimljenih ocjena i komentara */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-base font-bold text-[#1E3A5F] flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-[#D97706]" />
              Arhiva zaprimljenih ocjena i komentara ({filteredSubmissions.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              Svaka ocjena trajno je povezana sa svojim zatvorenim istraživačkim predmetom.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "all", label: "Sve ocjene" },
              { id: "with_comment", label: "S komentarom" },
              { id: "support_yes", label: "Podrška Društvu (Da/Možda)" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setArchiveFilter(f.id as any)}
                className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                  archiveFilter === f.id
                    ? "bg-[#1E3A5F] text-white border-[#CEA369]"
                    : "bg-white text-[#1E3A5F] border-border hover:bg-[#EFF5FB]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredSubmissions.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
            Još nema zaprimljenih ocjena zadovoljstva za odabrani filter.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSubmissions.map((sub) => (
              <div
                key={sub.id}
                className="rounded-2xl border border-border bg-[#FBF9F6] p-4 space-y-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpenInquiryById(sub.inquiryId)}
                      className="font-serif text-sm font-bold text-[#1E3A5F] hover:underline text-left"
                    >
                      Predmet #{sub.inquiryId}: {sub.subject}
                    </button>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>
                        Naručitelj: <strong className="text-foreground">{sub.requesterName}</strong>
                      </span>
                      {sub.researcherName && (
                        <span>
                          Istraživač: <strong className="text-foreground">{sub.researcherName}</strong>
                        </span>
                      )}
                      <span>Predano: {formatDateTimeDMY(sub.submittedAt)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                    {sub.paymentInfoSentAt && (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-semibold border-amber-300 bg-[#FEFCE8] text-[#7C2D12]"
                      >
                        Poslane upute i QR ({formatDateDMY(sub.paymentInfoSentAt)})
                      </Badge>
                    )}
                    {sub.financialSupport && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold ${
                          sub.financialSupport === "da"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : sub.financialSupport === "mozda"
                            ? "border-amber-300 bg-amber-50 text-amber-800"
                            : "border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        Podrška: {getFinancialSupportLabel(sub.financialSupport)}
                      </Badge>
                    )}
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#CEA369] px-3 py-1">
                      <StarRow rating={sub.averageRating} size="xs" />
                      <span className="font-mono text-xs font-bold text-[#1E3A5F]">
                        {sub.averageRating.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[11px]">
                  {[
                    { label: "Opće", val: sub.rating_overall },
                    { label: "Jasnoća", val: sub.rating_clarity },
                    { label: "Komunikacija", val: sub.rating_communication },
                    { label: "Brzina", val: sub.rating_timeliness },
                    { label: "Preporuka", val: sub.rating_recommendation },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg bg-white border border-border px-2.5 py-1.5 flex items-center justify-between"
                    >
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-bold text-[#7C2D12]">{item.val}/5 ★</span>
                    </div>
                  ))}
                </div>

                {sub.comment && (
                  <div className="rounded-xl bg-white border border-border p-3 text-xs text-slate-800 italic leading-relaxed">
                    „{sub.comment}”
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function DashboardFeedbackWidget({ user }: { user: any }) {
  const [stats, setStats] = useState<InquiryFeedbackStats | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetch("/api/projects/inquiries/feedback", {
      cache: "no-store",
      headers: {
        "x-user-id": String(user.id ?? ""),
        "x-user-role": String(user.role ?? ""),
        "x-user-email": String(user.email ?? ""),
      },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.overallAverage === "number") {
          setStats(data)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user?.id])

  if (!stats) return null

  return (
    <div className="rounded-3xl border border-[#CEA369]/40 bg-gradient-to-br from-[#FEFCE8]/80 via-white to-white p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-amber-100 text-[#D97706]">
            <Star className="h-4 w-4 fill-[#D97706]" />
          </div>
          <h4 className="font-serif text-base font-bold text-primary">
            Zadovoljstvo istraživanjima
          </h4>
        </div>
        <Link
          href="/research?tab=satisfaction"
          className="text-[11px] font-bold text-[#1E3A5F] hover:underline shrink-0"
        >
          Statistika →
        </Link>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white border border-[#E8E4DE] p-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Prosječna ocjena
          </div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-serif text-2xl font-bold text-[#1E3A5F]">
              {stats.totalSubmitted > 0 ? stats.overallAverage.toFixed(2) : "—"}
            </span>
            {stats.totalSubmitted > 0 && (
              <span className="text-xs text-muted-foreground">/ 5.00</span>
            )}
          </div>
        </div>
        <div className="text-right space-y-1">
          <StarRow rating={stats.overallAverage} size="sm" />
          <div className="text-[11px] text-muted-foreground">
            {stats.totalSubmitted} od {stats.totalSent} anketa
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-xl bg-white border border-border">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Odaziv</div>
          <div className="text-sm font-bold text-foreground mt-0.5">
            {stats.responseRatePct}%
          </div>
        </div>
        <div className="p-2 rounded-xl bg-white border border-border">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Podrška Da</div>
          <div className="text-sm font-bold text-emerald-700 mt-0.5">
            {stats.financialSupportSummary.da}
          </div>
        </div>
        <div className="p-2 rounded-xl bg-white border border-border">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Zatvoreno</div>
          <div className="text-sm font-bold text-foreground mt-0.5">
            {stats.totalCompletedInquiries}
          </div>
        </div>
      </div>
    </div>
  )
}
