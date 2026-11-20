"use client"

import * as React from "react"
import {
  Archive,
  Search,
  RefreshCw,
  Download,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Users,
  UserCheck,
  Clock,
  FolderCheck,
  Save,
  ChevronLeft,
  ChevronRight,
  Lock,
  UserCog,
  Ban,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useActivityLog } from "@/contexts/activity-log-context"
import { getUserAccessRights } from "@/lib/inquiry-permissions"
import { formatDateDMY, formatDateTimeDMY } from "@/lib/utils"
import { inspectMemberDate } from "@/lib/date-validation"
import {
  ARCHIVE_CONTACT_RESULTS,
  getArchiveResultLabel,
  type ArchiveMemberItem,
} from "@/lib/archive-constants"
import {
  ArchiveMemberDataDialog,
  type ArchiveUpdatedMemberSummary,
} from "@/components/archive-member-data-dialog"
import { DateOrYearInput } from "@/components/ui/date-or-year-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"

type RowSaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; message: string }

function getResultSelectTone(value: string): string {
  const tone = ARCHIVE_CONTACT_RESULTS.find((o) => o.value === value)?.tone || "none"
  switch (tone) {
    case "emerald":
      return "border-emerald-300 bg-emerald-50/80 text-emerald-950 font-semibold"
    case "amber":
      return "border-amber-300 bg-amber-50/80 text-amber-950 font-semibold"
    case "blue":
      return "border-blue-300 bg-blue-50/80 text-blue-950 font-medium"
    case "red":
      return "border-red-300 bg-red-50/80 text-red-900 font-medium"
    case "slate":
      return "border-slate-300 bg-slate-50 text-slate-800"
    default:
      return "border-border bg-background text-foreground"
  }
}

function escapeCsvCell(val: unknown): string {
  const str = String(val ?? "")
  return `"${str.replace(/"/g, '""')}"`
}

export function ArchiveContent() {
  const { user } = useAuth()
  const { addLog } = useActivityLog()
  const hasLoggedRef = React.useRef(false)

  const [items, setItems] = React.useState<ArchiveMemberItem[]>([])
  const [canEditServer, setCanEditServer] = React.useState<boolean>(false)
  const [loading, setLoading] = React.useState<boolean>(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [search, setSearch] = React.useState("")
  const [contactedFilter, setContactedFilter] = React.useState<"all" | "yes" | "no">("all")
  const [resultFilter, setResultFilter] = React.useState<string>("all")
  const [memberStatusFilter, setMemberStatusFilter] = React.useState<"all" | "living" | "deceased" | "do_not_contact">("all")
  const [pageSize, setPageSize] = React.useState<"25" | "50" | "100" | "all">("25")
  const [currentPage, setCurrentPage] = React.useState(1)

  // Lokalni draftovi za inline uređivanje (datum kontakta i napomena)
  const [dateDrafts, setDateDrafts] = React.useState<Record<number, string>>({})
  const [noteDrafts, setNoteDrafts] = React.useState<Record<number, string>>({})
  const [rowStates, setRowStates] = React.useState<Record<number, RowSaveState>>({})
  const [dataDialogMember, setDataDialogMember] = React.useState<{ id: number; name: string } | null>(null)

  const canEdit = React.useMemo(() => {
    if (!user) return false
    if (user.role === "admin" || user.role === "moderator") return true
    const ar = getUserAccessRights(user)
    return Boolean(ar?.archive?.edit || canEditServer)
  }, [user, canEditServer])

  const loadArchive = React.useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch("/api/archive", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setLoadError(data.error || "Nije moguće učitati podatke arhive.")
        return
      }
      const fetched: ArchiveMemberItem[] = Array.isArray(data.items) ? data.items : []
      setItems(fetched)
      setCanEditServer(Boolean(data.canEdit))
      const initialDates: Record<number, string> = {}
      const initialNotes: Record<number, string> = {}
      for (const it of fetched) {
        initialDates[it.memberId] = it.contactedAt || ""
        initialNotes[it.memberId] = it.note || ""
      }
      setDateDrafts(initialDates)
      setNoteDrafts(initialNotes)
    } catch (err: any) {
      setLoadError(err?.message || "Greška pri povezivanju s poslužiteljem.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadArchive()
  }, [loadArchive])

  React.useEffect(() => {
    if (user && !hasLoggedRef.current) {
      hasLoggedRef.current = true
      addLog({
        userId: user.id.toString(),
        userName: user.name,
        userRole: user.role,
        action: "Pregled arhiva",
        details: `Korisnik ${user.name} je otvorio pregled modula Arhiv`,
      })
    }
  }, [user?.id])

  const saveRowPatch = React.useCallback(
    async (
      item: ArchiveMemberItem,
      overrides: Partial<Pick<ArchiveMemberItem, "contacted" | "contactedAt" | "contactResult" | "note">>
    ) => {
      if (!canEdit) return
      const memberId = item.memberId
      const payload = {
        memberId,
        contacted: overrides.contacted !== undefined ? overrides.contacted : item.contacted,
        contactedAt:
          overrides.contactedAt !== undefined
            ? overrides.contactedAt
            : dateDrafts[memberId] ?? item.contactedAt,
        contactResult:
          overrides.contactResult !== undefined ? overrides.contactResult : item.contactResult,
        note: overrides.note !== undefined ? overrides.note : noteDrafts[memberId] ?? item.note,
      }

      setRowStates((prev) => ({ ...prev, [memberId]: { status: "saving" } }))
      try {
        const res = await fetch("/api/archive", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok || !data.success) {
          setRowStates((prev) => ({
            ...prev,
            [memberId]: { status: "error", message: data.error || "Greška pri spremanju." },
          }))
          return
        }

        const saved = data.item
        setItems((prev) =>
          prev.map((row) =>
            row.memberId === memberId
              ? {
                  ...row,
                  contacted: Boolean(saved.contacted),
                  contactedAt: saved.contactedAt || "",
                  contactResult: saved.contactResult || "",
                  note: saved.note || "",
                  updatedByName: saved.updatedByName || "",
                  updatedAt: saved.updatedAt || "",
                }
              : row
          )
        )
        setDateDrafts((prev) => ({ ...prev, [memberId]: saved.contactedAt || "" }))
        setNoteDrafts((prev) => ({ ...prev, [memberId]: saved.note || "" }))
        setRowStates((prev) => ({ ...prev, [memberId]: { status: "saved" } }))
        setTimeout(() => {
          setRowStates((prev) => {
            if (prev[memberId]?.status !== "saved") return prev
            return { ...prev, [memberId]: { status: "idle" } }
          })
        }, 2500)
      } catch (err: any) {
        setRowStates((prev) => ({
          ...prev,
          [memberId]: { status: "error", message: err?.message || "Greška mreže pri spremanju." },
        }))
      }
    },
    [canEdit, dateDrafts, noteDrafts]
  )

  const handleToggleContacted = (item: ArchiveMemberItem, checked: boolean) => {
    if (!canEdit) return
    if (item.doNotContact && checked) return
    const currentDraftDate = (dateDrafts[item.memberId] ?? item.contactedAt ?? "").trim()
    const nextDate = checked && !currentDraftDate ? formatDateDMY(new Date(), "") : currentDraftDate
    if (checked && !currentDraftDate) {
      setDateDrafts((prev) => ({ ...prev, [item.memberId]: nextDate }))
    }
    saveRowPatch(item, { contacted: checked, contactedAt: nextDate })
  }

  const handleDateChange = (item: ArchiveMemberItem, nextDate: string) => {
    if (!canEdit || item.doNotContact) return
    const memberId = item.memberId
    setDateDrafts((prev) => ({ ...prev, [memberId]: nextDate }))

    const trimmed = nextDate.trim()
    if (trimmed === "" && item.contactedAt !== "") {
      saveRowPatch(item, { contactedAt: "" })
      return
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const inspected = inspectMemberDate(trimmed)
      if (inspected.isoDate && trimmed !== item.contactedAt) {
        saveRowPatch(item, {
          contacted: true,
          contactedAt: trimmed,
        })
      }
    }
  }

  const handleResultChange = (item: ArchiveMemberItem, nextResult: string) => {
    if (!canEdit || item.doNotContact) return
    const shouldAutoContact = Boolean(nextResult) && !item.contacted
    const currentDraftDate = (dateDrafts[item.memberId] ?? item.contactedAt ?? "").trim()
    const nextDate =
      shouldAutoContact && !currentDraftDate ? formatDateDMY(new Date(), "") : currentDraftDate
    if (shouldAutoContact && !currentDraftDate) {
      setDateDrafts((prev) => ({ ...prev, [item.memberId]: nextDate }))
    }
    saveRowPatch(item, {
      contacted: shouldAutoContact ? true : item.contacted,
      contactedAt: nextDate,
      contactResult: nextResult,
    })
  }

  const handleSaveNote = (item: ArchiveMemberItem, force = false) => {
    if (!canEdit) return
    const draftNote = (noteDrafts[item.memberId] ?? item.note ?? "").trim()
    const savedNote = (item.note || "").trim()
    if (!force && draftNote === savedNote) return
    saveRowPatch(item, { note: draftNote })
  }

  const stats = React.useMemo(() => {
    const total = items.length
    const contacted = items.filter((i) => i.contacted).length
    const notContacted = total - contacted
    const agreed = items.filter((i) => i.contactResult === "grada_dogovorena").length
    const collected = items.filter((i) => i.contactResult === "grada_preuzeta").length
    const deceased = items.filter((i) => i.deceased).length
    const doNotContact = items.filter((i) => i.doNotContact).length
    return {
      total,
      contacted,
      contactedPct: total > 0 ? Math.round((contacted / total) * 100) : 0,
      notContacted,
      agreed,
      collected,
      deceased,
      doNotContact,
    }
  }, [items])

  const filteredItems = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (contactedFilter === "yes" && !item.contacted) return false
      if (contactedFilter === "no" && item.contacted) return false
      if (resultFilter !== "all") {
        if (resultFilter === "agreed_or_collected") {
          if (item.contactResult !== "grada_dogovorena" && item.contactResult !== "grada_preuzeta") {
            return false
          }
        } else if (resultFilter === "empty") {
          if (item.contactResult) return false
        } else if (item.contactResult !== resultFilter) {
          return false
        }
      }
      if (memberStatusFilter === "living" && item.deceased) return false
      if (memberStatusFilter === "deceased" && !item.deceased) return false
      if (memberStatusFilter === "do_not_contact" && !item.doNotContact) return false
      if (!q) return true

      const resultLabel = getArchiveResultLabel(item.contactResult).toLowerCase()
      return (
        item.name.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.phone.toLowerCase().includes(q) ||
        item.landlinePhone.toLowerCase().includes(q) ||
        item.address.toLowerCase().includes(q) ||
        item.note.toLowerCase().includes(q) ||
        item.doNotContactNote.toLowerCase().includes(q) ||
        resultLabel.includes(q)
      )
    })
  }, [items, search, contactedFilter, resultFilter, memberStatusFilter])

  React.useEffect(() => {
    setCurrentPage(1)
  }, [search, contactedFilter, resultFilter, memberStatusFilter, pageSize])

  const numericPageSize = pageSize === "all" ? Math.max(1, filteredItems.length) : Number(pageSize)
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / numericPageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedItems = React.useMemo(() => {
    if (pageSize === "all") return filteredItems
    const start = (safePage - 1) * numericPageSize
    return filteredItems.slice(start, start + numericPageSize)
  }, [filteredItems, pageSize, safePage, numericPageSize])

  const handleExportCsv = () => {
    const headers = [
      "Ime i prezime",
      "Status života",
      "Datum smrti",
      "Zabrana kontakta",
      "Napomena zabrane kontakta",
      "E-mail",
      "Mobitel",
      "Fiksni telefon",
      "Adresa",
      "Kontaktiran",
      "Kada je kontaktiran",
      "Rezultat kontakta",
      "Napomena",
      "Zadnji uredio",
      "Vrijeme izmjene",
    ]
    const rows = filteredItems.map((it) => [
      it.name,
      it.deceased ? "Preminuo/la" : "Živući član",
      it.deceased && it.deathDate ? formatDateDMY(it.deathDate, it.deathDate) : "",
      it.doNotContact ? "Da (Ne kontaktirati)" : "Ne",
      it.doNotContact ? it.doNotContactNote || "Na izričitu napomenu član je zatražio da ga se ne kontaktira" : "",
      it.email,
      it.phone,
      it.landlinePhone,
      it.address,
      it.contacted ? "Da" : "Ne",
      it.contactedAt ? formatDateDMY(it.contactedAt, it.contactedAt) : "",
      it.contactResult ? getArchiveResultLabel(it.contactResult) : "",
      it.note,
      it.updatedByName,
      it.updatedAt ? formatDateTimeDMY(it.updatedAt, "") : "",
    ])
    const csvContent =
      "\uFEFF" +
      [headers.map(escapeCsvCell).join(";"), ...rows.map((r) => r.map(escapeCsvCell).join(";"))].join(
        "\r\n"
      )
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    const todayIso = new Date().toISOString().slice(0, 10)
    link.download = `arhiv-evidencija-kontakata-${todayIso}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleMemberDataSaved = React.useCallback((updated: ArchiveUpdatedMemberSummary) => {
    setItems((prev) =>
      prev
        .map((row) =>
          row.memberId === updated.memberId
            ? {
                ...row,
                name: updated.name,
                email: updated.email,
                phone: updated.phone,
                landlinePhone: updated.landlinePhone,
                address: updated.address,
              }
            : row
        )
        .sort((a, b) => a.name.localeCompare(b.name, "hr"))
    )
  }, [])

  const renderMemberIdentity = (item: ArchiveMemberItem) => (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-sm text-[#1B2B36]">{item.name}</span>
        {item.deceased && (
          <Badge
            variant="outline"
            className="text-[10px] py-0 px-1.5 bg-slate-100 text-slate-700 border-slate-300 font-semibold"
          >
            † Preminuo/la{item.deathDate ? ` (${formatDateDMY(item.deathDate, item.deathDate)})` : ""}
          </Badge>
        )}
        {item.doNotContact && (
          <Badge
            variant="outline"
            className="text-[10px] py-0 px-1.5 bg-red-600 text-white border-red-700 font-bold gap-1"
            title="Na izričitu napomenu član je zatražio da ga se ne kontaktira"
          >
            <Ban className="h-2.5 w-2.5 shrink-0" />
            Ne kontaktirati
          </Badge>
        )}
      </div>
      {item.doNotContact && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-900 space-y-0.5">
          <p className="font-bold">
            Na izričitu napomenu član je zatražio da ga se ne kontaktira.
          </p>
          {(item.doNotContactDate || item.doNotContactNote) && (
            <p className="text-[10px] text-red-800">
              {item.doNotContactDate ? `Zahtjev: ${item.doNotContactDate}` : ""}
              {item.doNotContactDate && item.doNotContactNote ? " • " : ""}
              {item.doNotContactNote || ""}
            </p>
          )}
        </div>
      )}
      {canEdit && (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDataDialogMember({ id: item.memberId, name: item.name })}
            className="h-7 px-2.5 text-[11px] font-bold gap-1 border-[#CEA369]/70 bg-[#FBF9F6] text-[#1B2B36] hover:bg-[#FEFCE8]"
          >
            <UserCog className="h-3.5 w-3.5 text-[#CEA369]" />
            DOPUNI PODATKE
          </Button>
        </div>
      )}
    </div>
  )

  const renderContactDetails = (item: ArchiveMemberItem) => {
    const hasAny = item.email || item.phone || item.landlinePhone || item.address
    if (!hasAny) {
      return (
        <div className="space-y-1">
          {item.doNotContact && (
            <div className="text-[11px] font-bold text-red-700 flex items-center gap-1">
              <Ban className="h-3 w-3 shrink-0" />
              Kontaktiranje zabranjeno
            </div>
          )}
          <span className="text-xs text-muted-foreground italic">Nema upisanih kontakata</span>
        </div>
      )
    }
    if (item.doNotContact) {
      return (
        <div className="space-y-1 text-xs">
          <div className="text-[11px] font-bold text-red-700 flex items-center gap-1">
            <Ban className="h-3 w-3 shrink-0" />
            Zabrana kontakta (zahtjev člana)
          </div>
          {item.email && (
            <div className="flex items-center gap-1.5 text-muted-foreground line-through break-all select-none">
              <Mail className="h-3 w-3 shrink-0" />
              <span>{item.email}</span>
            </div>
          )}
          {item.phone && (
            <div className="flex items-center gap-1.5 text-muted-foreground line-through font-mono text-[11px] select-none">
              <Phone className="h-3 w-3 shrink-0" />
              <span>{item.phone}</span>
            </div>
          )}
          {item.landlinePhone && (
            <div className="flex items-center gap-1.5 text-muted-foreground line-through font-mono text-[11px] select-none">
              <Phone className="h-3 w-3 shrink-0" />
              <span>Fiksni: {item.landlinePhone}</span>
            </div>
          )}
          {item.address && (
            <div className="flex items-start gap-1.5 text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
              <span className="leading-snug">{item.address}</span>
            </div>
          )}
        </div>
      )
    }
    return (
      <div className="space-y-1 text-xs">
        {item.email && (
          <a
            href={`mailto:${item.email}`}
            className="flex items-center gap-1.5 text-[#1F77C5] hover:underline break-all"
          >
            <Mail className="h-3 w-3 shrink-0" />
            <span>{item.email}</span>
          </a>
        )}
        {item.phone && (
          <a
            href={`tel:${item.phone}`}
            className="flex items-center gap-1.5 text-foreground hover:underline font-mono text-[11px]"
          >
            <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span>{item.phone}</span>
          </a>
        )}
        {item.landlinePhone && (
          <a
            href={`tel:${item.landlinePhone}`}
            className="flex items-center gap-1.5 text-muted-foreground hover:underline font-mono text-[11px]"
          >
            <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span>Fiksni: {item.landlinePhone}</span>
          </a>
        )}
        {item.address && (
          <div className="flex items-start gap-1.5 text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
            <span className="leading-snug">{item.address}</span>
          </div>
        )}
      </div>
    )
  }

  const renderRowStatus = (item: ArchiveMemberItem) => {
    const st = rowStates[item.memberId]
    return (
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px]">
        <div className="min-h-[16px] flex items-center gap-1">
          {st?.status === "saving" && (
            <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
              <Loader2 className="h-3 w-3 animate-spin" /> Spremanje...
            </span>
          )}
          {st?.status === "saved" && (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
              <CheckCircle2 className="h-3 w-3" /> Spremljeno
            </span>
          )}
          {st?.status === "error" && (
            <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
              <AlertCircle className="h-3 w-3" /> {st.message}
            </span>
          )}
          {(!st || st.status === "idle") && item.updatedAt && (
            <span className="text-muted-foreground font-mono">
              {item.updatedByName ? `${item.updatedByName} • ` : ""}
              {formatDateTimeDMY(item.updatedAt, "")}
            </span>
          )}
        </div>
      </div>
    )
  }

  const renderNoteEditor = (item: ArchiveMemberItem) => {
    const draftValue = noteDrafts[item.memberId] ?? item.note ?? ""
    const isDirty = draftValue.trim() !== (item.note || "").trim()
    const isSaving = rowStates[item.memberId]?.status === "saving"

    return (
      <div className="space-y-1">
        <div className="flex items-start gap-1.5">
          <Textarea
            value={draftValue}
            onChange={(e) =>
              setNoteDrafts((prev) => ({ ...prev, [item.memberId]: e.target.value }))
            }
            onBlur={() => handleSaveNote(item)}
            disabled={!canEdit}
            rows={2}
            placeholder="Građa dogovorena / preuzeta / tko i kada treba preuzeti..."
            className="min-h-[54px] text-xs leading-snug bg-background resize-y"
          />
          {canEdit && isDirty && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isSaving}
              onClick={() => handleSaveNote(item, true)}
              className="h-8 px-2 text-[11px] shrink-0 border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              title="Spremi napomenu"
            >
              <Save className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        {renderRowStatus(item)}
      </div>
    )
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-20">
      <div className="mx-auto max-w-[1440px] space-y-6">
        {/* Zaglavlje modula */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1B2B36] text-[#F2EFE9] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                <Archive className="h-3 w-3 text-[#CEA369]" />
                Arhiv društva
              </span>
            </div>
            <h2 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-primary">
              Arhiv — Evidencija kontaktiranja i prikupljanja građe
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Inline popis svih članova društva (uključujući i preminule radi kontakta s obitelji/nasljednicima) s osnovnim kontakt podacima i praćenjem prikupljanja arhivske građe.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadArchive}
              disabled={loading}
              className="gap-1.5 bg-card"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Osvježi
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={filteredItems.length === 0}
              className="gap-1.5 bg-card"
            >
              <Download className="h-3.5 w-3.5 text-[#CEA369]" />
              Izvezi CSV ({filteredItems.length})
            </Button>
          </div>
        </div>

        {/* Read-only traka za korisnike s pravom samo pogleda */}
        {!canEdit && !loading && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-950 flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-700 shrink-0" />
            <span>
              Imate pristup samo za pregled (Pogled). Za unos i uređivanje statusa kontakta i napomena potrebno je pravo uređivanja modula Arhiv.
            </span>
          </div>
        )}

        {/* KPI kartice s brzim filtriranjem */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => {
              setContactedFilter("all")
              setResultFilter("all")
              setMemberStatusFilter("all")
            }}
            className={`text-left rounded-2xl border p-4 transition-all bg-card hover:shadow-md ${
              contactedFilter === "all" && resultFilter === "all" && memberStatusFilter === "all"
                ? "border-[#CEA369] ring-1 ring-[#CEA369]/40"
                : "border-border"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Ukupno članova</span>
              <Users className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold font-mono text-primary">{stats.total}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Uključujući preminule</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setContactedFilter("yes")
              setResultFilter("all")
              setMemberStatusFilter("all")
            }}
            className={`text-left rounded-2xl border p-4 transition-all bg-card hover:shadow-md ${
              contactedFilter === "yes" ? "border-emerald-400 ring-1 ring-emerald-400/50" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Kontaktirani</span>
              <UserCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold font-mono text-emerald-700">{stats.contacted}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{stats.contactedPct}% obrađeno</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setContactedFilter("no")
              setResultFilter("all")
              setMemberStatusFilter("all")
            }}
            className={`text-left rounded-2xl border p-4 transition-all bg-card hover:shadow-md ${
              contactedFilter === "no" ? "border-amber-400 ring-1 ring-amber-400/50" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Nekontaktirani</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold font-mono text-amber-700">{stats.notContacted}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Čeka kontakt</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setContactedFilter("all")
              setResultFilter("agreed_or_collected")
              setMemberStatusFilter("all")
            }}
            className={`text-left rounded-2xl border p-4 transition-all bg-card hover:shadow-md ${
              resultFilter === "agreed_or_collected"
                ? "border-emerald-400 ring-1 ring-emerald-400/50"
                : "border-border"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Dogovoreno / Preuzeto</span>
              <FolderCheck className="h-4 w-4 text-emerald-700" />
            </div>
            <p className="text-2xl font-bold font-mono text-primary">
              {stats.agreed + stats.collected}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {stats.agreed} dogovoreno • {stats.collected} preuzeto
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setContactedFilter("all")
              setResultFilter("all")
              setMemberStatusFilter("deceased")
            }}
            className={`text-left rounded-2xl border p-4 transition-all bg-card hover:shadow-md col-span-2 sm:col-span-1 ${
              memberStatusFilter === "deceased"
                ? "border-slate-500 ring-1 ring-slate-400/60"
                : "border-border"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Preminuli članovi (†)</span>
              <Archive className="h-4 w-4 text-slate-600" />
            </div>
            <p className="text-2xl font-bold font-mono text-slate-700">{stats.deceased}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Kontaktiranje obitelji</p>
          </button>
        </div>

        {/* Traka za pretragu i filtriranje */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_auto] gap-2.5 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pretraži po imenu, prezimenu, e-mailu, telefonu, adresi ili napomeni..."
                className="pl-9 h-9 text-xs bg-background"
              />
            </div>

            <select
              value={contactedFilter}
              onChange={(e) => setContactedFilter(e.target.value as any)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium"
            >
              <option value="all">Kontaktiran: Svi</option>
              <option value="yes">Samo kontaktirani (Da)</option>
              <option value="no">Samo nekontaktirani (Ne)</option>
            </select>

            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium"
            >
              <option value="all">Rezultat: Svi</option>
              <option value="agreed_or_collected">Dogovoreno ili preuzeto</option>
              <option value="empty">Bez unesenog rezultata</option>
              {ARCHIVE_CONTACT_RESULTS.filter((o) => o.value).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={memberStatusFilter}
              onChange={(e) => setMemberStatusFilter(e.target.value as any)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium"
            >
              <option value="all">Članovi: Svi (uklj. umrle)</option>
              <option value="living">Samo živući članovi</option>
              <option value="deceased">Samo preminuli (†)</option>
              <option value="do_not_contact">Ne kontaktirati ({stats.doNotContact})</option>
            </select>

            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value as any)}
              className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-mono"
              title="Broj redaka po stranici"
            >
              <option value="25">25 / str.</option>
              <option value="50">50 / str.</option>
              <option value="100">100 / str.</option>
              <option value="all">Prikaži sve</option>
            </select>
          </div>
        </div>

        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-16 flex flex-col items-center justify-center gap-3 text-xs text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-[#CEA369]" />
            <span>Učitavanje popisa članova u modulu Arhiv...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card py-14 px-4 text-center space-y-2">
            <Archive className="h-8 w-8 mx-auto text-muted-foreground/60" />
            <h3 className="text-base font-semibold">Nema pronađenih članova</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Promijenite pojam pretrage ili očistite filtre kako biste vidjeli sve članove u arhivskoj evidenciji.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop inline tablica */}
            <div className="hidden lg:block rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-[#FBF9F6] text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="p-3.5 w-[200px]">Ime i prezime</th>
                      <th className="p-3.5 w-[240px]">Kontakt podaci</th>
                      <th className="p-3.5 w-[105px] text-center">Kontaktiran</th>
                      <th className="p-3.5 w-[165px]">Kada je kontaktiran</th>
                      <th className="p-3.5 w-[235px]">Rezultat kontakta</th>
                      <th className="p-3.5 min-w-[270px]">Napomena (dogovor / preuzimanje)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedItems.map((item) => {
                      const draftDate = dateDrafts[item.memberId] ?? item.contactedAt ?? ""
                      const contactDisabled = !canEdit || item.doNotContact
                      const toggleDisabled = !canEdit || (item.doNotContact && !item.contacted)
                      return (
                        <tr
                          key={item.memberId}
                          className={`align-top transition-colors ${
                            item.doNotContact
                              ? "bg-red-50/45 hover:bg-red-50/70"
                              : item.contactResult === "grada_preuzeta"
                              ? "bg-emerald-50/25 hover:bg-emerald-50/45"
                              : item.contacted
                              ? "bg-[#FEFCE8]/25 hover:bg-[#FEFCE8]/45"
                              : "hover:bg-muted/25"
                          }`}
                        >
                          <td className="p-3.5">{renderMemberIdentity(item)}</td>
                          <td className="p-3.5">{renderContactDetails(item)}</td>
                          <td className="p-3.5 text-center">
                            {item.doNotContact && !item.contacted ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800 cursor-help"
                                title="Na izričitu napomenu član je zatražio da ga se ne kontaktira"
                              >
                                <Ban className="h-2.5 w-2.5 shrink-0" />
                                Zabranjeno
                              </span>
                            ) : (
                              <div className="inline-flex flex-col items-center gap-1 pt-1">
                                <Checkbox
                                  checked={item.contacted}
                                  disabled={toggleDisabled}
                                  onCheckedChange={(checked) =>
                                    handleToggleContacted(item, checked === true)
                                  }
                                  aria-label={`Kontaktiran — ${item.name}`}
                                />
                                <span
                                  className={`text-[10px] font-bold ${
                                    item.contacted ? "text-emerald-700" : "text-muted-foreground"
                                  }`}
                                >
                                  {item.contacted ? "Da" : "Ne"}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="p-3.5">
                            <DateOrYearInput
                              value={draftDate}
                              onChange={(val) => handleDateChange(item, val)}
                              disabled={contactDisabled}
                              allowYearOnly={false}
                              placeholder="DD/MM/YYYY"
                              inputClassName="h-8 text-xs font-mono"
                            />
                          </td>
                          <td className="p-3.5">
                            <select
                              value={item.contactResult}
                              disabled={contactDisabled}
                              onChange={(e) => handleResultChange(item, e.target.value)}
                              className={`h-8 w-full rounded-lg border px-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 ${getResultSelectTone(
                                item.contactResult
                              )}`}
                            >
                              {ARCHIVE_CONTACT_RESULTS.map((opt) => (
                                <option key={opt.value || "empty"} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3.5">{renderNoteEditor(item)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobilne i tablet inline kartice */}
            <div className="lg:hidden space-y-3">
              {paginatedItems.map((item) => {
                const draftDate = dateDrafts[item.memberId] ?? item.contactedAt ?? ""
                const contactDisabled = !canEdit || item.doNotContact
                const toggleDisabled = !canEdit || (item.doNotContact && !item.contacted)
                return (
                  <div
                    key={item.memberId}
                    className={`rounded-2xl border p-4 bg-card shadow-xs space-y-3 ${
                      item.doNotContact
                        ? "border-red-300 bg-red-50/45"
                        : item.contactResult === "grada_preuzeta"
                        ? "border-emerald-300 bg-emerald-50/20"
                        : item.contacted
                        ? "border-[#CEA369]/60"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {renderMemberIdentity(item)}
                      {item.doNotContact && !item.contacted ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-800 shrink-0"
                          title="Na izričitu napomenu član je zatražio da ga se ne kontaktira"
                        >
                          <Ban className="h-3 w-3 shrink-0" />
                          Zabranjeno
                        </span>
                      ) : (
                        <label className="inline-flex items-center gap-2 rounded-full border border-border bg-[#FBF9F6] px-2.5 py-1 text-xs font-semibold shrink-0 cursor-pointer">
                          <Checkbox
                            checked={item.contacted}
                            disabled={toggleDisabled}
                            onCheckedChange={(checked) => handleToggleContacted(item, checked === true)}
                          />
                          <span>{item.contacted ? "Kontaktiran" : "Nije kontaktiran"}</span>
                        </label>
                      )}
                    </div>

                    <div className="rounded-xl border border-border/70 bg-[#FBF9F6] p-3">
                      {renderContactDetails(item)}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                          Kada je kontaktiran
                        </span>
                        <DateOrYearInput
                          value={draftDate}
                          onChange={(val) => handleDateChange(item, val)}
                          disabled={contactDisabled}
                          allowYearOnly={false}
                          placeholder="DD/MM/YYYY"
                          inputClassName="h-9 text-xs font-mono"
                        />
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                          Rezultat kontakta
                        </span>
                        <select
                          value={item.contactResult}
                          disabled={contactDisabled}
                          onChange={(e) => handleResultChange(item, e.target.value)}
                          className={`h-9 w-full rounded-lg border px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 ${getResultSelectTone(
                            item.contactResult
                          )}`}
                        >
                          {ARCHIVE_CONTACT_RESULTS.map((opt) => (
                            <option key={opt.value || "empty"} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                        Napomena (dogovor, preuzimanje, tko i kada)
                      </span>
                      {renderNoteEditor(item)}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Paginacija */}
            {pageSize !== "all" && totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-xs">
                <span className="text-muted-foreground font-mono">
                  Stranica {safePage} od {totalPages} • Prikazano {paginatedItems.length} od{" "}
                  {filteredItems.length} članova
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="h-8 gap-1"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Prethodna
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 gap-1"
                  >
                    Sljedeća <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ArchiveMemberDataDialog
        memberId={dataDialogMember?.id ?? null}
        memberName={dataDialogMember?.name}
        open={Boolean(dataDialogMember)}
        onOpenChange={(open) => {
          if (!open) setDataDialogMember(null)
        }}
        onSaved={handleMemberDataSaved}
      />
    </main>
  )
}
