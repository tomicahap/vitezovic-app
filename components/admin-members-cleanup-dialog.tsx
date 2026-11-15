"use client"

import * as React from "react"
import {
  AlertTriangle,
  CalendarPlus,
  CalendarX2,
  CheckCircle2,
  Eraser,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useMembers } from "@/contexts/members-context"
import { useAuth } from "@/contexts/auth-context"
import { getMemberDateIssues, inspectMemberDate } from "@/lib/date-validation"
import { formatDateDMY } from "@/lib/utils"

interface AdminMembersCleanupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedMemberIds: number[]
}

type TableFilter = "all" | "issues" | "with_payments" | "missing_join"

export function AdminMembersCleanupDialog({
  open,
  onOpenChange,
  selectedMemberIds,
}: AdminMembersCleanupDialogProps) {
  const { members, bulkCleanupMembers, batchUpdateMemberDates } = useMembers()
  const { user } = useAuth()

  const [scope, setScope] = React.useState<"all" | "selected">("all")
  const [tableFilter, setTableFilter] = React.useState<TableFilter>("issues")
  const [search, setSearch] = React.useState("")
  const [busyAction, setBusyAction] = React.useState<string | null>(null)
  const [confirmMode, setConfirmMode] = React.useState<
    "clear-payments" | "clear-join-dates" | "clear-both" | "normalize-dates" | "fill-missing-join-date-2007" | null
  >(null)
  const [notice, setNotice] = React.useState<{ type: "ok" | "err"; text: string } | null>(null)

  // Inline edits map: memberId -> { joinDate, birthDate, clearPayments }
  const [drafts, setDrafts] = React.useState<
    Record<number, { joinDate?: string; birthDate?: string; clearPayments?: boolean }>
  >({})

  React.useEffect(() => {
    if (open) {
      setDrafts({})
      setNotice(null)
      setConfirmMode(null)
      setScope(selectedMemberIds.length > 0 ? "selected" : "all")
    }
  }, [open, selectedMemberIds.length])

  if (!open || user?.role !== "admin") return null

  const targetIds = scope === "selected" && selectedMemberIds.length > 0 ? selectedMemberIds : undefined
  const targetCount = targetIds ? targetIds.length : members.length
  const targetMembers = targetIds ? members.filter((m) => targetIds.includes(m.id)) : members
  const targetMissingJoinCount = targetMembers.filter((m) => !m.joinDate || !m.joinDate.trim()).length

  const membersWithIssuesCount = members.filter((m) => getMemberDateIssues(m).length > 0).length
  const membersWithPaymentsCount = members.filter((m) => (m.payments || []).length > 0).length
  const membersMissingJoinCount = members.filter((m) => !m.joinDate || !m.joinDate.trim()).length

  const filteredList = members.filter((m) => {
    const matchSearch =
      !search.trim() ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.membershipNumber || "").toLowerCase().includes(search.toLowerCase())
    if (!matchSearch) return false

    if (tableFilter === "issues") return getMemberDateIssues(m).length > 0
    if (tableFilter === "with_payments") return (m.payments || []).length > 0
    if (tableFilter === "missing_join") return !m.joinDate || !m.joinDate.trim()
    return true
  })

  const runBulkAction = async (
    mode: "clear-payments" | "clear-join-dates" | "clear-both" | "normalize-dates" | "fill-missing-join-date-2007"
  ) => {
    setBusyAction(mode)
    setNotice(null)
    try {
      const updated = await bulkCleanupMembers(mode, targetIds)
      setConfirmMode(null)
      setDrafts({})
      const labels: Record<typeof mode, string> = {
        "clear-payments": "Sve uplate su uspješno obrisane",
        "clear-join-dates": "Svi datumi upisa su uspješno obrisani",
        "clear-both": "Svi datumi upisa i uplate su uspješno obrisani",
        "normalize-dates": "Prepoznatljivi datumi su pretvoreni u ispravan format",
        "fill-missing-join-date-2007": "Datum upisa 01/01/2007 upisan je članovima bez datuma učlanjenja",
      }
      setNotice({ type: "ok", text: `${labels[mode]} (ažurirano članova: ${updated}).` })
    } catch (err: any) {
      setNotice({ type: "err", text: err?.message || "Greška pri izvršavanju akcije." })
    } finally {
      setBusyAction(null)
    }
  }

  const dirtyEntries = Object.entries(drafts).filter(
    ([, d]) => d.joinDate !== undefined || d.birthDate !== undefined || d.clearPayments
  )

  const saveInlineChanges = async () => {
    if (dirtyEntries.length === 0) return
    setBusyAction("save-inline")
    setNotice(null)
    try {
      const payload = dirtyEntries.map(([id, d]) => ({
        id: Number(id),
        ...d,
      }))
      const updated = await batchUpdateMemberDates(payload)
      setDrafts({})
      setNotice({ type: "ok", text: `Spremljene izmjene za ${updated} članova.` })
    } catch (err: any) {
      setNotice({ type: "err", text: err?.message || "Greška pri spremanju izmjena." })
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 md:p-6 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border bg-amber-50/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-xl font-bold text-foreground">
                  Admin alat za čišćenje datuma i uplata
                </h2>
                <Badge className="bg-amber-600 text-white text-[10px] uppercase">
                  Samo Administrator · Privremeno
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Brzo brisanje datuma upisa i krivih uplata te detekcija i ispravak neispravnih formata datuma.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5">
          {notice && (
            <div
              className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
                notice.type === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {notice.type === "ok" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              <span>{notice.text}</span>
            </div>
          )}

          {/* Scope + Bulk Actions */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Masovne radnje (Bulk)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Odaberite opseg i pokrenite čišćenje. Članovi bez datuma i uplata zadržavaju status „Aktivan”.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setScope("all")}
                  className={`rounded-md px-3 py-1 font-semibold transition-colors ${
                    scope === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Svi članovi ({members.length})
                </button>
                <button
                  type="button"
                  disabled={selectedMemberIds.length === 0}
                  onClick={() => setScope("selected")}
                  className={`rounded-md px-3 py-1 font-semibold transition-colors disabled:opacity-40 ${
                    scope === "selected" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Samo označeni ({selectedMemberIds.length})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              <Button
                type="button"
                variant="outline"
                disabled={!!busyAction || targetCount === 0}
                onClick={() => setConfirmMode("clear-payments")}
                className="justify-start gap-2 border-red-200 bg-red-50/60 text-red-700 hover:bg-red-100 hover:text-red-800"
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                <span className="truncate">Obriši SVE uplate ({targetCount})</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={!!busyAction || targetCount === 0}
                onClick={() => setConfirmMode("clear-join-dates")}
                className="justify-start gap-2 border-amber-200 bg-amber-50/60 text-amber-800 hover:bg-amber-100"
              >
                <CalendarX2 className="h-4 w-4 shrink-0" />
                <span className="truncate">Obriši datume upisa ({targetCount})</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={!!busyAction || targetCount === 0}
                onClick={() => setConfirmMode("clear-both")}
                className="justify-start gap-2 border-red-300 bg-red-100/70 text-red-800 hover:bg-red-200"
              >
                <Eraser className="h-4 w-4 shrink-0" />
                <span className="truncate">Obriši OBOJE (Reset)</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={!!busyAction || targetCount === 0}
                onClick={() => setConfirmMode("normalize-dates")}
                className="justify-start gap-2 border-blue-200 bg-blue-50/60 text-blue-800 hover:bg-blue-100"
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                <span className="truncate">Pretvori valjane datume u ISO</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={!!busyAction || targetMissingJoinCount === 0}
                onClick={() => setConfirmMode("fill-missing-join-date-2007")}
                className="justify-start gap-2 border-emerald-200 bg-emerald-50/60 text-emerald-800 hover:bg-emerald-100"
                title="Svim članovima u odabranom opsegu koji nemaju datum upisa postavlja 01/01/2007"
              >
                <CalendarPlus className="h-4 w-4 shrink-0" />
                <span className="truncate">Upiši 01/01/2007 praznima ({targetMissingJoinCount})</span>
              </Button>
            </div>

            {confirmMode && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-red-300 bg-red-50 p-3.5">
                <div className="text-sm text-red-900">
                  <strong>Potvrda:</strong>{" "}
                  {confirmMode === "clear-payments" &&
                    `Trajno obrisati SVE uplate za ${targetCount} članova?`}
                  {confirmMode === "clear-join-dates" &&
                    `Obrisati datum upisa za ${targetCount} članova?`}
                  {confirmMode === "clear-both" &&
                    `Trajno obrisati sve uplate I datume upisa za ${targetCount} članova?`}
                  {confirmMode === "normalize-dates" &&
                    `Automatski pretvoriti prepoznatljive datume (DD.MM.YYYY / DD/MM/YYYY) u standardni YYYY-MM-DD za ${targetCount} članova?`}
                  {confirmMode === "fill-missing-join-date-2007" &&
                    `Upisati datum učlanjenja 01/01/2007 za svih ${targetMissingJoinCount} članova koji trenutno nemaju datum učlanjenja?`}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmMode(null)}
                    disabled={!!busyAction}
                  >
                    Odustani
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className={
                      confirmMode === "normalize-dates"
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : confirmMode === "fill-missing-join-date-2007"
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-red-600 text-white hover:bg-red-700"
                    }
                    disabled={!!busyAction}
                    onClick={() => runBulkAction(confirmMode)}
                  >
                    {busyAction === confirmMode ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Potvrdi i izvrši
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Inline Editor Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: "issues" as TableFilter, label: `⚠ Krivi formati (${membersWithIssuesCount})` },
                  { id: "with_payments" as TableFilter, label: `S uplatama (${membersWithPaymentsCount})` },
                  { id: "missing_join" as TableFilter, label: `Bez datuma upisa (${membersMissingJoinCount})` },
                  { id: "all" as TableFilter, label: `Svi (${members.length})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTableFilter(f.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      tableFilter === f.id
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-background text-muted-foreground border border-border hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filtriraj po imenu ili mat. broju..."
                  className="h-8 pl-8 text-xs bg-background"
                />
              </div>
            </div>

            <div className="max-h-[42vh] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-muted border-b border-border">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-muted-foreground">
                      Član
                    </th>
                    <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-muted-foreground">
                      Datum upisa (ispravak / brisanje)
                    </th>
                    <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-muted-foreground">
                      Datum rođenja
                    </th>
                    <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-muted-foreground">
                      Uplate
                    </th>
                    <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-muted-foreground">
                      Detektirani problemi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                        Nema članova za odabrani filter.
                      </td>
                    </tr>
                  ) : (
                    filteredList.map((m) => {
                      const issues = getMemberDateIssues(m)
                      const draft = drafts[m.id] || {}
                      const joinInspection = inspectMemberDate(m.joinDate)
                      const birthInspection = inspectMemberDate(m.birthDate)

                      const joinVal = draft.joinDate !== undefined ? draft.joinDate : (joinInspection.isoDate || "")
                      const birthVal = draft.birthDate !== undefined ? draft.birthDate : (birthInspection.isoDate || "")
                      const paymentsCleared = draft.clearPayments === true
                      const paymentCount = paymentsCleared ? 0 : (m.payments || []).length

                      return (
                        <tr key={m.id} className={issues.length > 0 ? "bg-amber-50/30" : ""}>
                          <td className="px-3 py-2.5 align-top">
                            <div className="font-semibold text-foreground">{m.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              Matica: {m.registryNumber || "—"} · Prijavnica: {m.membershipNumber || "—"}
                            </div>
                          </td>

                          <td className="px-3 py-2.5 align-top">
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="date"
                                value={joinVal}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [m.id]: { ...prev[m.id], joinDate: e.target.value },
                                  }))
                                }
                                className="h-7 w-36 text-xs"
                              />
                              {(m.joinDate || draft.joinDate) && (
                                <button
                                  type="button"
                                  title="Obriši datum upisa"
                                  onClick={() =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [m.id]: { ...prev[m.id], joinDate: "" },
                                    }))
                                  }
                                  className="rounded p-1 text-red-500 hover:bg-red-50"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {((!(m.joinDate || draft.joinDate) || joinInspection.status === "invalid" || joinInspection.status === "convertible") && draft.joinDate !== "2007-01-01") && (
                                <button
                                  type="button"
                                  title="Postavi datum učlanjenja na 01/01/2007"
                                  onClick={() =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [m.id]: { ...prev[m.id], joinDate: "2007-01-01" },
                                    }))
                                  }
                                  className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 whitespace-nowrap"
                                >
                                  01/01/2007
                                </button>
                              )}
                            </div>
                            {(joinInspection.status === "invalid" || joinInspection.status === "convertible") && (
                              <div className="mt-1 text-[10px] text-amber-700 font-mono">
                                U bazi: &quot;{m.joinDate}&quot;
                              </div>
                            )}
                          </td>

                          <td className="px-3 py-2.5 align-top">
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="date"
                                value={birthVal}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [m.id]: { ...prev[m.id], birthDate: e.target.value },
                                  }))
                                }
                                className="h-7 w-36 text-xs"
                              />
                              {(m.birthDate || draft.birthDate) && (
                                <button
                                  type="button"
                                  title="Obriši datum rođenja"
                                  onClick={() =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [m.id]: { ...prev[m.id], birthDate: "" },
                                    }))
                                  }
                                  className="rounded p-1 text-red-500 hover:bg-red-50"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            {(birthInspection.status === "invalid" || birthInspection.status === "convertible") && (
                              <div className="mt-1 text-[10px] text-amber-700 font-mono">
                                U bazi: &quot;{m.birthDate}&quot;
                              </div>
                            )}
                          </td>

                          <td className="px-3 py-2.5 align-top">
                            {paymentCount > 0 ? (
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {paymentCount} ({formatDateDMY(m.datum_zadnje_uplate, "—")})
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [m.id]: { ...prev[m.id], clearPayments: true },
                                    }))
                                  }
                                  className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-red-100"
                                >
                                  Obriši
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                {paymentsCleared ? "Bit će obrisano" : "Nema"}
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-2.5 align-top">
                            {issues.length === 0 ? (
                              <span className="text-emerald-700 font-medium">✓ Uredno</span>
                            ) : (
                              <div className="space-y-1">
                                {issues.map((iss, idx) => (
                                  <div
                                    key={idx}
                                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium mr-1 ${
                                      iss.status === "invalid"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-amber-100 text-amber-800"
                                    }`}
                                    title={iss.reason}
                                  >
                                    <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                                    {iss.label}: &quot;{iss.raw}&quot;
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-6 py-4">
          <div className="text-xs text-muted-foreground">
            {dirtyEntries.length > 0 ? (
              <span className="font-semibold text-amber-700">
                Imate {dirtyEntries.length} nespremljenih izmjena u tablici.
              </span>
            ) : (
              "Sve izmjene su spremljene."
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Zatvori
            </Button>
            {dirtyEntries.length > 0 && (
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={busyAction === "save-inline"}
                onClick={saveInlineChanges}
              >
                {busyAction === "save-inline" ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Spremi izmjene ({dirtyEntries.length})
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
