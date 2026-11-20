"use client"

import * as React from "react"
import {
  History,
  Mail,
  Users,
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { formatDateTimeDMY } from "@/lib/utils"
import { buildBoardAnnouncementEmail } from "@/lib/hrd-email-system"

export interface BoardAnnouncementRecipientItem {
  id?: number
  name: string
  email: string
  functionsLabel?: string
  status?: "sent" | "failed"
  error?: string
}

export interface BoardAnnouncementHistoryItem {
  id: number
  subject: string
  message: string
  senderId?: string
  senderName: string
  senderRole?: string
  senderEmail?: string
  recipients: BoardAnnouncementRecipientItem[]
  sentCount: number
  failedCount: number
  totalRecipients: number
  syncedBoardNotice?: boolean
  sentAt: string
  isLegacyLog?: boolean
  legacyDetails?: string
  legacyRecipientsSummary?: string
}

interface BoardAnnouncementsHistoryListProps {
  items: BoardAnnouncementHistoryItem[]
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
  onReuseMessage?: (item: BoardAnnouncementHistoryItem) => void
  settings?: any
  emptyHint?: string
}

export function BoardAnnouncementsHistoryList({
  items,
  loading = false,
  error = null,
  onRefresh,
  onReuseMessage,
  settings,
  emptyHint = "Još nije poslana niti jedna službena obavijest članovima tijela društva.",
}: BoardAnnouncementsHistoryListProps) {
  const [search, setSearch] = React.useState("")
  const [expandedRecipientsIds, setExpandedRecipientsIds] = React.useState<Record<number, boolean>>({})
  const [previewHtmlId, setPreviewHtmlId] = React.useState<number | null>(null)

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      if ((item.subject || "").toLowerCase().includes(q)) return true
      if ((item.message || "").toLowerCase().includes(q)) return true
      if ((item.senderName || "").toLowerCase().includes(q)) return true
      if ((item.senderRole || "").toLowerCase().includes(q)) return true
      if ((item.legacyDetails || "").toLowerCase().includes(q)) return true
      return (item.recipients || []).some(
        (r) =>
          (r.name || "").toLowerCase().includes(q) ||
          (r.email || "").toLowerCase().includes(q) ||
          (r.functionsLabel || "").toLowerCase().includes(q)
      )
    })
  }, [items, search])

  const toggleRecipients = (id: number, defaultExpanded: boolean) => {
    setExpandedRecipientsIds((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? defaultExpanded),
    }))
  }

  return (
    <div className="space-y-4">
      {/* Alatna traka za pretragu i osvježavanje */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pretraži po predmetu, tekstu, pošiljatelju ili primatelju..."
            className="pl-8 h-9 text-xs bg-background"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="text-[11px] font-mono bg-[#FBF9F6] border-border">
            Ukupno: {filtered.length}
          </Badge>
          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="h-9 text-xs gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Osvježi
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {error}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="py-10 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
          <RefreshCw className="h-5 w-5 animate-spin text-amber-600" />
          <span>Učitavanje povijesti poslanih obavijesti...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 py-10 px-4 text-center space-y-1.5">
          <History className="h-7 w-7 mx-auto text-muted-foreground/60" />
          <p className="text-sm font-semibold text-foreground">
            {items.length === 0 ? "Nema zabilježenih obavijesti" : "Nema rezultata za zadani pojam"}
          </p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {items.length === 0
              ? emptyHint
              : "Pokušajte s drugim pojmom pretrage (ime, e-mail, predmet ili sadržaj poruke)."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item, idx) => {
            const defaultExpanded = idx === 0
            const isExpanded = expandedRecipientsIds[item.id] ?? defaultExpanded
            const showHtmlPreview = previewHtmlId === item.id
            const formattedDate = formatDateTimeDMY(item.sentAt, "—")

            const builtPreview = showHtmlPreview
              ? buildBoardAnnouncementEmail({
                  subject: item.subject,
                  message: item.message,
                  senderName: item.senderName,
                  sentDate: item.sentAt,
                  formattedDateTime: formattedDate,
                  settings,
                  forBrowserPreview: true,
                })
              : null

            return (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden transition-colors"
              >
                {/* Zaglavlje kartice */}
                <div className="bg-[#FBF9F6] border-b border-border px-4 py-3 flex flex-col md:flex-row md:items-start justify-between gap-2.5">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[#1E3A5F] text-white shrink-0">
                        <Mail className="h-3.5 w-3.5 text-[#D97706]" />
                      </span>
                      <h4 className="font-serif text-sm font-bold text-[#1B2B36] break-words">
                        {item.subject}
                      </h4>
                      {item.isLegacyLog && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-amber-50 text-amber-900 border-amber-300"
                        >
                          Iz dnevnika rada
                        </Badge>
                      )}
                      {item.syncedBoardNotice && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-blue-50 text-blue-800 border-blue-200"
                        >
                          Objavljeno i na Oglasnoj ploči
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 text-foreground font-medium">
                        <UserCheck className="h-3.5 w-3.5 text-[#7C2D12]" />
                        <span>Pošiljatelj: </span>
                        <strong className="text-[#1E3A5F]">{item.senderName}</strong>
                        {item.senderRole && (
                          <span className="text-muted-foreground font-normal">({item.senderRole})</span>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="h-3 w-3 text-[#CEA369]" />
                        {formattedDate}
                      </span>
                    </div>
                  </div>

                  {/* Status dostave i brzi gumbi */}
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-50 text-[11px] font-mono">
                      Poslano: {item.sentCount}/{item.totalRecipients || item.recipients.length || item.sentCount}
                    </Badge>
                    {item.failedCount > 0 && (
                      <Badge className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-50 text-[11px] font-mono">
                        Neuspjelo: {item.failedCount}
                      </Badge>
                    )}
                    {!item.isLegacyLog && item.message && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] gap-1 bg-white"
                        onClick={() => setPreviewHtmlId(showHtmlPreview ? null : item.id)}
                      >
                        {showHtmlPreview ? (
                          <>
                            <EyeOff className="h-3 w-3" /> Sakrij e-mail
                          </>
                        ) : (
                          <>
                            <Eye className="h-3 w-3" /> Prikaži e-mail
                          </>
                        )}
                      </Button>
                    )}
                    {onReuseMessage && !item.isLegacyLog && item.message && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] gap-1 bg-white text-[#1E3A5F] border-[#D97706]/50 hover:bg-[#FEFCE8]"
                        onClick={() => onReuseMessage(item)}
                      >
                        <Copy className="h-3 w-3 text-[#D97706]" />
                        Kopiraj u novu
                      </Button>
                    )}
                  </div>
                </div>

                {/* Sadržaj poruke (što se slalo) */}
                <div className="p-4 space-y-3">
                  {item.message ? (
                    <div className="rounded-lg border border-border/80 bg-[#FEFCE8]/45 px-3.5 py-2.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7C2D12] block mb-1">
                        Poslana poruka
                      </span>
                      <p className="text-xs text-[#1F2937] leading-relaxed whitespace-pre-wrap">
                        {item.message}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3.5 py-2.5 flex items-start gap-2">
                      <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-950 space-y-1">
                        <p className="font-semibold">
                          Evidentirano u dnevniku rada prije uvođenja arhive punog teksta poruke:
                        </p>
                        <p className="text-[11px] leading-relaxed text-amber-900/90 whitespace-pre-wrap">
                          {item.legacyDetails || "Podaci o slanju pohranjeni su u dnevniku aktivnosti."}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Inline HTML prikaz poslanog e-maila */}
                  {showHtmlPreview && builtPreview && (
                    <div className="rounded-xl border border-border overflow-hidden bg-[#F8FAFC] p-2">
                      <iframe
                        title={`Pregled poslane obavijesti #${item.id}`}
                        srcDoc={builtPreview.html}
                        className="w-full h-[380px] border-0 rounded-lg bg-white"
                        sandbox="allow-same-origin"
                      />
                    </div>
                  )}

                  {/* Kome je poslano (primatelji) */}
                  <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleRecipients(item.id, defaultExpanded)}
                      className="w-full px-3.5 py-2 flex items-center justify-between text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        <span>
                          Primatelji (
                          {item.recipients.length > 0
                            ? item.recipients.length
                            : item.totalRecipients || item.sentCount}
                          )
                        </span>
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border bg-background p-2.5">
                        {item.recipients.length > 0 ? (
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {item.recipients.map((rec, rIdx) => {
                              const isFailed = rec.status === "failed"
                              return (
                                <div
                                  key={`${rec.email}-${rIdx}`}
                                  className={`flex items-start justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
                                    isFailed
                                      ? "border-red-200 bg-red-50/50"
                                      : "border-border/80 bg-[#FBF9F6]"
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="font-semibold text-foreground truncate">
                                        {rec.name}
                                      </span>
                                      {rec.functionsLabel && (
                                        <span className="text-[10px] px-1.5 py-0 rounded bg-amber-100/80 text-amber-900 border border-amber-200 font-medium">
                                          {rec.functionsLabel}
                                        </span>
                                      )}
                                    </div>
                                    <p className="font-mono text-[10px] text-muted-foreground truncate">
                                      {rec.email}
                                    </p>
                                    {rec.error && (
                                      <p className="text-[10px] text-red-700 mt-0.5">{rec.error}</p>
                                    )}
                                  </div>
                                  <span
                                    className={`inline-flex items-center gap-1 text-[10px] font-bold shrink-0 mt-0.5 ${
                                      isFailed ? "text-red-700" : "text-emerald-700"
                                    }`}
                                  >
                                    {isFailed ? (
                                      <>
                                        <XCircle className="h-3 w-3" /> Greška
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="h-3 w-3" /> Poslano
                                      </>
                                    )}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground px-1">
                            {item.legacyRecipientsSummary || "Popis primatelja zabilježen je skupno u dnevniku rada."}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
