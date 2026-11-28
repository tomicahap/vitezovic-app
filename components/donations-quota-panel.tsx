"use client"

import * as React from "react"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Flame,
  Gauge,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"
import { formatDateDMY, formatDateTimeDMY } from "@/lib/utils"
import type { ApiProviderQuotaItem, ApiQuotaSummaryResponse } from "@/lib/mailcrawl/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CloseActionButton, ModalActionFooter, SaveActionButton } from "@/components/ui/action-bar"

interface DonationsQuotaPanelProps {
  refreshTrigger?: number
}

function formatNumberHr(val: number): string {
  if (!Number.isFinite(val)) return "0"
  return Number.isInteger(val)
    ? val.toLocaleString("hr-HR")
    : val.toLocaleString("hr-HR", { maximumFractionDigits: 2 })
}

function getProviderIcon(provider: ApiProviderQuotaItem["provider"]) {
  switch (provider) {
    case "gemini":
      return <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
    case "serper":
      return <Search className="h-4 w-4 text-emerald-600 shrink-0" />
    case "tavily":
      return <Activity className="h-4 w-4 text-sky-600 shrink-0" />
    case "firecrawl":
      return <Flame className="h-4 w-4 text-amber-600 shrink-0" />
  }
}

function getStatusStyles(status: ApiProviderQuotaItem["status"]) {
  switch (status) {
    case "unconfigured":
      return {
        card: "border-border/80 bg-muted/20",
        bar: "bg-slate-300",
        badge: "bg-slate-100 text-slate-600 border-slate-300",
        label: "Nije postavljen ključ",
      }
    case "exhausted":
      return {
        card: "border-red-300 bg-red-50/50",
        bar: "bg-red-600",
        badge: "bg-red-100 text-red-800 border-red-300",
        label: "Iscrpljeno",
      }
    case "critical":
      return {
        card: "border-red-300 bg-red-50/35",
        bar: "bg-red-600",
        badge: "bg-red-100 text-red-800 border-red-300",
        label: "Pri kraju",
      }
    case "warning":
      return {
        card: "border-amber-300 bg-amber-50/40",
        bar: "bg-amber-500",
        badge: "bg-amber-100 text-amber-900 border-amber-300",
        label: "Smanjena kvota",
      }
    case "ok":
      return {
        card: "border-border bg-background",
        bar: "bg-emerald-600",
        badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
        label: "Dostupno",
      }
  }
}

export function DonationsQuotaPanel({ refreshTrigger = 0 }: DonationsQuotaPanelProps) {
  const [summary, setSummary] = React.useState<ApiQuotaSummaryResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState(false)

  const [calibratingItem, setCalibratingItem] = React.useState<ApiProviderQuotaItem | null>(null)
  const [limitInput, setLimitInput] = React.useState("")
  const [rpmInput, setRpmInput] = React.useState("")
  const [desiredRemainingInput, setDesiredRemainingInput] = React.useState("")
  const [resetCounter, setResetCounter] = React.useState(false)
  const [savingCalibration, setSavingCalibration] = React.useState(false)

  const fetchQuota = React.useCallback(async (forceLiveRefresh = false) => {
    if (forceLiveRefresh) setRefreshing(true)
    try {
      const res = await fetch(
        `/api/admin/mailcrawl/quota${forceLiveRefresh ? "?refresh=1" : ""}`,
        { cache: "no-store" }
      )
      if (res.ok) {
        const data: ApiQuotaSummaryResponse = await res.json()
        setSummary(data)
      }
    } catch {
      // Ignore silent background load errors
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    fetchQuota(false)
  }, [fetchQuota, refreshTrigger])

  const openCalibrateModal = (item: ApiProviderQuotaItem) => {
    setCalibratingItem(item)
    setLimitInput(String(item.limit))
    setRpmInput(item.extra?.rpmLimit ? String(item.extra.rpmLimit) : "10")
    setDesiredRemainingInput("")
    setResetCounter(false)
  }

  const handleSaveCalibration = async () => {
    if (!calibratingItem) return
    setSavingCalibration(true)
    try {
      const res = await fetch("/api/admin/mailcrawl/quota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: calibratingItem.provider,
          limit: limitInput,
          rpmLimit: calibratingItem.provider === "gemini" ? rpmInput : undefined,
          desiredRemaining:
            calibratingItem.provider !== "gemini" && desiredRemainingInput.trim() !== ""
              ? desiredRemainingInput.trim()
              : null,
          resetLocalCounter: resetCounter,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Spremanje kalibracije nije uspjelo.")
      }
      if (data.summary) {
        setSummary(data.summary)
      } else {
        await fetchQuota(true)
      }
      setCalibratingItem(null)
      toast.success(`Kvota za ${calibratingItem.label} je ažurirana.`)
    } catch (err: any) {
      toast.error(err?.message || "Greška pri spremanju kalibracije.")
    } finally {
      setSavingCalibration(false)
    }
  }

  const providers = summary?.providers || []
  const anyLowOrExhausted = providers.some(
    (p) => p.configured && (p.status === "exhausted" || p.status === "critical" || p.status === "warning")
  )

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Gauge className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-foreground">
                Kvote besplatnih API alata (Gemini, Serper.dev, Tavily, Firecrawl)
              </h2>
              {anyLowOrExhausted && (
                <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Provjerite preostale kredite
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Firecrawl se sinkronizira izravno putem API-ja uživo; Gemini, Serper i Tavily prate svaki zahtjev iz sustava uz mogućnost kalibracije prema dashboardu.
              {summary?.checkedAt ? ` • Zadnja provjera: ${formatDateTimeDMY(summary.checkedAt)}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            disabled={refreshing || loading}
            onClick={() => fetchQuota(true)}
            title="Osvježi lokalnu statistiku i povuci uživo stanje kredita s Firecrawl API-ja"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Osvježi kvote
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1 text-muted-foreground"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Prikaži
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Sakrij
              </>
            )}
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="h-44 rounded-xl border bg-muted/20 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {providers.map((item) => {
                const st = getStatusStyles(item.status)
                return (
                  <div
                    key={item.provider}
                    className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 transition-colors ${st.card}`}
                  >
                    <div className="space-y-2.5">
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {getProviderIcon(item.provider)}
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-foreground truncate">
                              {item.label}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {item.subtitle}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="outline" className={`text-[10px] font-semibold ${st.badge}`}>
                            {st.label}
                          </Badge>
                          {item.configured && (
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                                item.mode === "live"
                                  ? "bg-emerald-500/15 text-emerald-700"
                                  : "bg-slate-200/70 text-slate-700"
                              }`}
                            >
                              {item.mode === "live" ? "Uživo API" : "Lokalno praćenje"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Remaining numbers + progress bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <div>
                            <span className="text-[11px] text-muted-foreground block">Preostalo</span>
                            <span className="text-xl font-bold font-mono text-foreground">
                              {item.configured ? formatNumberHr(item.remaining) : "—"}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">
                              / {formatNumberHr(item.limit)} {item.unitLabel}
                            </span>
                          </div>
                          {item.configured && (
                            <span className="font-mono text-xs font-bold text-foreground">
                              {item.percentRemaining}%
                            </span>
                          )}
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${st.bar}`}
                            style={{ width: `${item.configured ? Math.max(0, Math.min(100, item.percentRemaining)) : 0}%` }}
                          />
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-1 text-[11px] text-muted-foreground border-t border-border/60 pt-2">
                        <div className="flex items-center justify-between gap-2">
                          <span>Potrošeno u ciklusu:</span>
                          <strong className="font-mono text-foreground">{formatNumberHr(item.used)}</strong>
                        </div>
                        <div className="truncate" title={item.periodLabel}>
                          Ciklus: <span className="text-foreground font-medium">{item.periodLabel}</span>
                        </div>

                        {item.provider === "gemini" && item.extra && (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <span>Brzina (RPM):</span>
                              <span className="font-mono text-foreground font-medium">
                                {item.extra.rpmCurrent || 0} / {item.extra.rpmLimit || 10} u min
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span>Tokeni danas:</span>
                              <span className="font-mono text-foreground">
                                {formatNumberHr((item.extra.inputTokensToday || 0) + (item.extra.outputTokensToday || 0))}
                              </span>
                            </div>
                          </>
                        )}

                        {item.provider === "firecrawl" && item.liveSyncedAt && (
                          <div className="truncate">
                            Sinkronizirano:{" "}
                            <span className="font-mono text-foreground">
                              {formatDateTimeDMY(item.liveSyncedAt)}
                            </span>
                          </div>
                        )}
                        {item.provider === "firecrawl" && item.billingPeriodEnd && (
                          <div className="truncate">
                            Reset ciklusa:{" "}
                            <span className="font-mono text-foreground">
                              {formatDateDMY(item.billingPeriodEnd)}
                            </span>
                          </div>
                        )}

                        <div className="truncate">
                          Zadnji poziv:{" "}
                          <span className="font-mono text-foreground">
                            {item.lastCallAt ? formatDateTimeDMY(item.lastCallAt) : "—"}
                          </span>
                        </div>

                        {item.lastErrorMessage && (item.status === "exhausted" || item.provider === "firecrawl") && (
                          <div
                            className="mt-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] text-red-800 line-clamp-2"
                            title={item.lastErrorMessage}
                          >
                            {item.lastErrorMessage}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer actions */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
                      <a
                        href={item.dashboardUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                      >
                        Dashboard
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-[11px] gap-1"
                        onClick={() => openCalibrateModal(item)}
                      >
                        <SlidersHorizontal className="h-3 w-3" />
                        Kalibriraj
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Calibration Modal */}
      <Dialog
        open={!!calibratingItem}
        onOpenChange={(open) => {
          if (!open && !savingCalibration) setCalibratingItem(null)
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-md overflow-hidden p-0">
          <DialogHeader className="border-b border-border bg-[#FBF9F6] px-6 py-4">
            <DialogTitle className="flex items-center gap-2 font-serif text-lg">
              <SlidersHorizontal className="h-4 w-4 text-primary shrink-0" />
              Kalibracija kvote: {calibratingItem?.label}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Prilagodite ukupni limit besplatnog plana ili upišite stvarno preostalo stanje s korisničkog portala pružatelja kako bi metrika u aplikaciji točno pratila nastavak potrošnje.
            </DialogDescription>
          </DialogHeader>

          {calibratingItem && (
            <div className="px-6 py-4 space-y-4 text-sm">
              <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                <p className="text-muted-foreground">{calibratingItem.note}</p>
                <a
                  href={calibratingItem.dashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline mt-1"
                >
                  Otvori {calibratingItem.label} Dashboard
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="quota-limit" className="text-xs font-semibold">
                  Limit besplatnog plana ({calibratingItem.unitLabel})
                </Label>
                <Input
                  id="quota-limit"
                  type="number"
                  min={1}
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                />
              </div>

              {calibratingItem.provider === "gemini" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="quota-rpm" className="text-xs font-semibold">
                    Ograničenje zahtjeva u minuti (RPM)
                  </Label>
                  <Input
                    id="quota-rpm"
                    type="number"
                    min={1}
                    value={rpmInput}
                    onChange={(e) => setRpmInput(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Besplatni Gemini modeli obično dopuštaju 5–15 zahtjeva/min i 20–250 zahtjeva/dan ovisno o odabranom modelu.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="quota-remaining" className="text-xs font-semibold">
                    Stvarno preostalo kredita s dashboarda (opcionalno)
                  </Label>
                  <Input
                    id="quota-remaining"
                    type="number"
                    min={0}
                    step="any"
                    placeholder={`Trenutno procijenjeno: ${calibratingItem.remaining}`}
                    value={desiredRemainingInput}
                    onChange={(e) => setDesiredRemainingInput(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Ako ste ključ koristili prije uvođenja metrike, upišite točan broj preostalih kredita s dashboarda (npr. 1840). Ostavite prazno ako ne želite mijenjati odmak.
                  </p>
                </div>
              )}

              <label className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 p-3 text-xs cursor-pointer select-none">
                <Checkbox
                  checked={resetCounter}
                  onCheckedChange={(checked) => setResetCounter(checked === true)}
                  className="mt-0.5"
                />
                <span>
                  Poništi dosadašnji lokalni brojač zahtjeva za <strong>{calibratingItem.label}</strong> (korisno ako ste unijeli novi API ključ ili želite krenuti od nule).
                </span>
              </label>
            </div>
          )}

          <ModalActionFooter
            right={
              <>
                <CloseActionButton
                  label="Odustani"
                  disabled={savingCalibration}
                  onClick={() => setCalibratingItem(null)}
                />
                <SaveActionButton
                  label="Spremi kalibraciju"
                  loading={savingCalibration}
                  onClick={handleSaveCalibration}
                />
              </>
            }
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
