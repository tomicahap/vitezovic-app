"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { CloseActionButton } from "@/components/ui/action-bar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"
import type { BulkSendJobState, PreflightSummary } from "@/lib/mailcrawl/types"

interface DonationsBulkSendDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "initial" | "resend"
  selectedIds: number[]
  defaultTestEmail: string
  onStarted: (job: BulkSendJobState) => void
}

export function DonationsBulkSendDialog({
  open,
  onOpenChange,
  mode,
  selectedIds,
  defaultTestEmail,
  onStarted,
}: DonationsBulkSendDialogProps) {
  const [loadingPreflight, setLoadingPreflight] = React.useState(false)
  const [preflight, setPreflight] = React.useState<PreflightSummary | null>(null)
  const [dailySentCount, setDailySentCount] = React.useState(0)
  const [dailyLimit, setDailyLimit] = React.useState(150)
  const [delaySec, setDelaySec] = React.useState("3.5")
  const [autoFillTemplate, setAutoFillTemplate] = React.useState(true)
  const [addReminderPrefix, setAddReminderPrefix] = React.useState(true)
  const [testEmail, setTestEmail] = React.useState(defaultTestEmail || "")
  const [sendingTest, setSendingTest] = React.useState(false)
  const [startingSend, setStartingSend] = React.useState(false)

  const endpoint =
    mode === "resend"
      ? "/api/admin/mailcrawl/sent-registry/bulk-resend"
      : "/api/admin/mailcrawl/leads/bulk-send"

  React.useEffect(() => {
    if (defaultTestEmail && !testEmail) {
      setTestEmail(defaultTestEmail)
    }
  }, [defaultTestEmail, testEmail])

  const loadPreflight = React.useCallback(async () => {
    if (!open || selectedIds.length === 0) return
    setLoadingPreflight(true)
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          dryRunPreflight: true,
          autoFillTemplate,
        }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setPreflight(data.preflight)
        setDailySentCount(Number(data.dailySentCount || 0))
        setDailyLimit(Number(data.dailyLimit || 150))
        if (data.defaultDelaySec) {
          setDelaySec(String(data.defaultDelaySec))
        }
      } else {
        toast.error(data.error || "Greška pri provjeri odabranih kontakata.")
      }
    } catch {
      toast.error("Greška pri spajanju s poslužiteljem.")
    } finally {
      setLoadingPreflight(false)
    }
  }, [open, selectedIds, endpoint, autoFillTemplate])

  React.useEffect(() => {
    loadPreflight()
  }, [loadPreflight])

  const handleSendTest = async () => {
    if (!testEmail.trim() || !testEmail.includes("@")) {
      toast.error("Unesite valjanu e-mail adresu za test.")
      return
    }
    setSendingTest(true)
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          testOnly: true,
          testEmail: testEmail.trim(),
          autoFillTemplate,
          addReminderPrefix,
        }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.success(data.message || `Testni mail poslan na ${testEmail.trim()}!`)
      } else {
        toast.error(data.error || "Slanje testnog maila nije uspjelo.")
      }
    } catch {
      toast.error("Greška pri slanju testnog maila.")
    } finally {
      setSendingTest(false)
    }
  }

  const handleConfirmStart = async () => {
    setStartingSend(true)
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          delaySec: parseFloat(delaySec) || 3.5,
          autoFillTemplate,
          addReminderPrefix,
        }),
      })
      const data = await res.json()
      if (res.ok && data.ok && data.job) {
        toast.success(data.message || "Skupno slanje pokrenuto!")
        onStarted(data.job)
        onOpenChange(false)
      } else {
        toast.error(data.error || "Nije moguće pokrenuti skupno slanje.")
      }
    } catch {
      toast.error("Greška pri pokretanju skupnog slanja.")
    } finally {
      setStartingSend(false)
    }
  }

  const eligibleCount = preflight?.eligibleCount ?? 0
  const projectedTotal = dailySentCount + eligibleCount
  const exceedsDailyLimit = projectedTotal > dailyLimit

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="bg-[#1E3A5F] border-b-2 border-[#D97706] text-white px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base text-white">
            <Send className="h-4 w-4 text-[#D97706]" />
            {mode === "resend"
              ? "Potvrda skupnog ponovnog slanja (Podsjetnik)"
              : "Potvrda skupnog slanja donacijskih poziva"}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#F8FAFC]/90">
            Sustav šalje poruke sekvencijalno kroz jednu SMTP vezu s anti-spam razmakom i živim brojačem.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-4 text-xs">
          {/* Preflight sažetak */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Sigurnosna provjera prije slanja
              </span>
              {loadingPreflight && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>

            {preflight && (
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-background border text-center">
                  <div className="text-[10px] text-muted-foreground">Označeno</div>
                  <div className="text-lg font-bold">{preflight.totalRequested}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 text-center">
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400">Spremno za slanje</div>
                  <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{preflight.eligibleCount}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-300 text-center">
                  <div className="text-[10px] text-amber-800 dark:text-amber-400">Preskočeno</div>
                  <div className="text-lg font-bold text-amber-800 dark:text-amber-400">{preflight.skippedCount}</div>
                </div>
              </div>
            )}

            {preflight && preflight.skippedCount > 0 && (
              <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                {preflight.skippedAlreadySent > 0 && (
                  <Badge variant="outline">Već poslano: {preflight.skippedAlreadySent}</Badge>
                )}
                {preflight.skippedBlocked > 0 && (
                  <Badge variant="outline" className="text-rose-600 border-rose-300">
                    Odjava / Ne kontaktirati: {preflight.skippedBlocked}
                  </Badge>
                )}
                {preflight.skippedMissingDraft > 0 && (
                  <Badge variant="outline">Bez nacrta: {preflight.skippedMissingDraft}</Badge>
                )}
                {preflight.skippedMissingEmail > 0 && (
                  <Badge variant="outline">Bez e-maila: {preflight.skippedMissingEmail}</Badge>
                )}
                {preflight.skippedInvalidOrRejected > 0 && (
                  <Badge variant="outline">Neispravno / Donator / Odbijeno: {preflight.skippedInvalidOrRejected}</Badge>
                )}
              </div>
            )}
          </div>

          {/* Dnevni limit upozorenje */}
          <div
            className={`rounded-lg border px-3.5 py-2.5 flex items-center justify-between gap-2 ${
              exceedsDailyLimit
                ? "bg-amber-50 border-amber-300 text-amber-900"
                : "bg-slate-50 dark:bg-muted/40 border-border text-muted-foreground"
            }`}
          >
            <div className="flex items-center gap-2">
              {exceedsDailyLimit ? (
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              )}
              <span>
                Danas već poslano: <strong>{dailySentCount}</strong> · Nakon ove serije: <strong>{projectedTotal}</strong> / preporučeno{" "}
                <strong>{dailyLimit}</strong>
              </span>
            </div>
          </div>

          {/* Opcije tempa i predloška */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-foreground">Sigurni razmak između e-mailova</div>
                <div className="text-[11px] text-muted-foreground">
                  Dodaje se i mali nasumični pomak (0–1,2 s) kako bi slanje izgledalo prirodno.
                </div>
              </div>
              <Select value={delaySec} onValueChange={setDelaySec}>
                <SelectTrigger className="w-44 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2,0 s (Brzo)</SelectItem>
                  <SelectItem value="3.5">3,5 s (Preporučeno)</SelectItem>
                  <SelectItem value="6">6,0 s (Vrlo oprezno)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === "initial" ? (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div>
                  <div className="font-medium text-foreground">Automatski pripremi kontakte bez teksta</div>
                  <div className="text-[11px] text-muted-foreground">
                    Ako neki odabrani kontakt još nema AI nacrt, primijeni brzi personalizirani predložak.
                  </div>
                </div>
                <Switch checked={autoFillTemplate} onCheckedChange={setAutoFillTemplate} />
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div>
                  <div className="font-medium text-foreground">Dodaj oznaku [Podsjetnik] u predmet</div>
                  <div className="text-[11px] text-muted-foreground">
                    Automatski ističe da se radi o ljubaznom podsjetniku na prethodni poziv.
                  </div>
                </div>
                <Switch checked={addReminderPrefix} onCheckedChange={setAddReminderPrefix} />
              </div>
            )}
          </div>

          {/* Testni e-mail */}
          <div className="p-3 rounded-xl border bg-[#FEFCE8] dark:bg-amber-950/20 border-[#D97706]/40 space-y-2">
            <div className="font-semibold text-[#7C2D12] dark:text-amber-300 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Prvo provjeri 1 testni mail na vlastitu adresu (preporučeno):
            </div>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Unesite svoj e-mail..."
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="h-8 text-xs bg-background"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs shrink-0 border-[#D97706] text-[#1E3A5F]"
                onClick={handleSendTest}
                disabled={sendingTest || eligibleCount === 0}
              >
                {sendingTest ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                Pošalji test
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 px-5 py-3.5 rounded-b-2xl gap-2.5">
          <CloseActionButton
            label="Odustani"
            onClick={() => onOpenChange(false)}
            disabled={startingSend}
          />
          <Button
            type="button"
            onClick={handleConfirmStart}
            disabled={startingSend || loadingPreflight || eligibleCount === 0}
            className="rounded-full h-10 px-6 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 border border-[#D97706] text-white font-bold shadow-md"
          >
            {startingSend ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Pokrećem...
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5 mr-1.5 text-[#D97706]" />
                Pokreni slanje ({eligibleCount})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
