"use client"

import * as React from "react"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  CheckCircle2,
  Clock,
  Mail,
  RefreshCw,
  Square,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react"
import type { BulkEmailProgressState } from "@/lib/bulk-email-stream"

interface EmailSendProgressBannerProps {
  progress: BulkEmailProgressState
  onCancel?: () => void
  cancelling?: boolean
  title?: string
}

function formatDurationSeconds(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m} min ${rem < 10 ? "0" : ""}${rem} s`
}

export function EmailSendProgressBanner({
  progress,
  onCancel,
  cancelling = false,
  title,
}: EmailSendProgressBannerProps) {
  const [nowMs, setNowMs] = React.useState(() => Date.now())

  React.useEffect(() => {
    if (!progress.active) return
    setNowMs(Date.now())
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [progress.active])

  if (progress.status === "idle" && !progress.active) return null

  const total = Math.max(0, progress.total)
  const processed = Math.min(total || progress.processed, progress.processed)
  const remaining = Math.max(0, total - processed)
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0

  const startedMs = progress.startedAt ? new Date(progress.startedAt).getTime() : 0
  const endMs = progress.active ? nowMs : progress.finishedAt ? new Date(progress.finishedAt).getTime() : nowMs
  const elapsedSec = startedMs > 0 ? Math.max(0, (endMs - startedMs) / 1000) : 0

  let etaSec = 0
  if (progress.active && remaining > 0) {
    if (processed > 0 && elapsedSec > 0.5) {
      etaSec = (elapsedSec / processed) * remaining
    } else if (progress.delayMs && progress.delayMs > 0) {
      etaSec = (remaining * progress.delayMs) / 1000
    }
  }

  const isRunning = progress.active || progress.status === "running"
  const isError = progress.status === "error"
  const isCancelled = progress.status === "cancelled"

  return (
    <div
      className={`rounded-xl border p-4 shadow-sm space-y-3 transition-all ${
        isError
          ? "border-red-300 bg-red-50/70 dark:bg-red-950/20"
          : isCancelled || progress.pausedReason
          ? "border-amber-300 bg-[#FEFCE8] dark:bg-amber-950/20"
          : isRunning
          ? "border-[#D97706]/60 bg-[#FEFCE8] dark:bg-amber-950/20"
          : "border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/20"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {isRunning ? (
            <div className="h-8 w-8 rounded-lg bg-[#1E3A5F] text-white flex items-center justify-center shrink-0">
              <RefreshCw className="h-4 w-4 animate-spin text-[#D97706]" />
            </div>
          ) : isError ? (
            <div className="h-8 w-8 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
          ) : isCancelled || progress.pausedReason ? (
            <div className="h-8 w-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
              <ShieldAlert className="h-4 w-4" />
            </div>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-[#1E3A5F] dark:text-foreground">
                {title ||
                  progress.label ||
                  (isRunning
                    ? "Slanje e-mailova u tijeku"
                    : isCancelled
                    ? "Slanje zaustavljeno"
                    : isError
                    ? "Greška pri slanju"
                    : "Slanje završeno")}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-[#1E3A5F] text-white px-2.5 py-0.5 text-xs font-bold font-mono border border-[#D97706]">
                Poslano: {progress.sent} / {total}
              </span>
              {total > 0 && (
                <span className="text-xs font-semibold text-[#7C2D12] dark:text-amber-300 font-mono">
                  ({pct}%)
                </span>
              )}
            </div>

            {progress.currentName || progress.currentEmail ? (
              <div className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1.5">
                <Mail className="h-3 w-3 shrink-0 text-[#7C2D12]" />
                <span className="truncate">
                  {isRunning ? "Trenutno šaljem:" : "Zadnji obrađeni:"}{" "}
                  <strong className="text-foreground">{progress.currentName || "Primatelj"}</strong>
                  {progress.currentEmail ? (
                    <span className="font-mono ml-1">({progress.currentEmail})</span>
                  ) : null}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {typeof progress.dailySentCount === "number" && typeof progress.dailyLimit === "number" && (
            <Badge variant="outline" className="text-[11px] bg-white/80 font-mono border-[#D97706]/50 text-[#1E3A5F]">
              Danas ukupno: {progress.dailySentCount} / {progress.dailyLimit}
            </Badge>
          )}
          {isRunning && onCancel && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-7 text-xs px-2.5 gap-1"
              onClick={onCancel}
              disabled={cancelling}
            >
              <Square className="h-3 w-3 fill-current" />
              {cancelling ? "Zaustavljam..." : "Zaustavi slanje"}
            </Button>
          )}
        </div>
      </div>

      <Progress value={pct} className="h-2.5 bg-[#E2E8F0]" />

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold">
            Uspješno: {progress.sent}
          </Badge>
          {progress.failed > 0 && (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 font-semibold">
              Neuspjelo: {progress.failed}
            </Badge>
          )}
          {progress.skipped > 0 && (
            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-semibold">
              Preskočeno: {progress.skipped}
            </Badge>
          )}
          <Badge variant="outline" className="bg-white/80 text-slate-700 border-slate-300 font-mono">
            Preostalo: {remaining}
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-muted-foreground font-mono">
          {elapsedSec > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Proteklo: {formatDurationSeconds(elapsedSec)}
            </span>
          )}
          {isRunning && etaSec > 0 && (
            <span>Procjena preostalo: ~{formatDurationSeconds(etaSec)}</span>
          )}
        </div>
      </div>

      {progress.pausedReason && (
        <div className="rounded-lg border border-amber-300 bg-amber-100/70 px-3 py-2 text-xs text-amber-950 font-medium flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 shrink-0 text-amber-700" />
          <span>{progress.pausedReason}</span>
        </div>
      )}

      {progress.lastError && !progress.pausedReason && (
        <div className="rounded-lg border border-red-300 bg-red-100/70 px-3 py-2 text-xs text-red-900">
          Zadnja greška: {progress.lastError}
        </div>
      )}
    </div>
  )
}
