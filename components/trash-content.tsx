"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { DesktopHeaderNav } from "@/components/desktop-header-nav"
import { useAuth } from "@/contexts/auth-context"
import { useMembers } from "@/contexts/members-context"
import { useLectures } from "@/contexts/lectures-context"
import { useMeetings } from "@/contexts/meetings-context"
import { useProjects } from "@/contexts/projects-context"
import { useLibrary } from "@/contexts/library-context"
import { useContacts } from "@/contexts/contacts-context"
import { useLinks } from "@/contexts/links-context"
import { useActivityLog } from "@/contexts/activity-log-context"
import { useSettings } from "@/contexts/settings-context"
import { formatDateTimeDMY } from "@/lib/utils"
import {
  Trash2,
  RotateCcw,
  Search,
  Eye,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  Clock,
  User,
  Layers,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface TrashItemRow {
  id: number
  entity_type: string
  entity_table: string
  original_id: string
  parent_id: string | null
  title: string
  subtitle: string | null
  data_json: string
  related_json: string | null
  deleted_by_id: string | null
  deleted_by_name: string
  deleted_by_role: string | null
  deleted_by_email: string | null
  deleted_at: string
  status: "trashed" | "restored"
  restored_at: string | null
  restored_by_id: string | null
  restored_by_name: string | null
}

interface TrashCounts {
  trashed: number
  restored: number
  byType: Record<string, number>
}

const ROLE_LABELS: Record<string, { label: string; cls: string }> = {
  admin: { label: "Administrator", cls: "bg-red-100 text-red-800 border-red-200" },
  moderator: { label: "Moderator", cls: "bg-blue-100 text-blue-800 border-blue-200" },
  member: { label: "Član", cls: "bg-slate-100 text-slate-700 border-slate-200" },
}

const DEFAULT_TYPE_LABELS: Record<string, string> = {
  member: "Član društva",
  lecture: "Predavanje / događaj",
  meeting: "Sjednica",
  poll: "Glasovanje / anketa",
  project: "Projekt",
  research_inquiry: "Upit i istraživanje",
  library_book: "Knjiga (Knjižnica)",
  library_journal: "Časopis (Knjižnica)",
  external_library: "Vanjska knjižnica / ustanova",
  library_contact_log: "Kontakt s ustanovom",
  contact: "Kontakt (Adresar)",
  useful_link: "Koristan link",
  vault_item: "Trezor lozinki",
  mailcrawl_lead: "Donacijski kontakt (Mailcrawl)",
  drive_file: "Google Drive datoteka/mapa",
  gmail_message: "Inbox e-mail poruka",
  gmail_template: "Gmail predložak / skica",
  member_payment: "Uplata članarine",
  member_function: "Funkcija člana u društvu",
  project_record: "Bilješka / zapis projekta",
  project_contributor: "Doprinositelj projekta",
  attachment: "Prilog / dokument",
  meeting_agenda_item: "Točka dnevnog reda",
  personal_todo: "Osobni zadatak (To-Do)",
  activity_logs_batch: "Arhiva dnevnika aktivnosti",
}

function tryPrettyJson(raw: string | null): any {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export function TrashContent() {
  const { user } = useAuth()
  const { reloadMembers } = useMembers()
  const { refreshLectures } = useLectures()
  const { reload: reloadMeetings } = useMeetings()
  const { refreshProjects } = useProjects()
  const { refreshBooks, refreshJournals } = useLibrary()
  const { refreshContacts } = useContacts()
  const { refreshLinks } = useLinks()
  const { refreshLogs } = useActivityLog()
  const { refreshSettings } = useSettings()

  const [items, setItems] = useState<TrashItemRow[]>([])
  const [counts, setCounts] = useState<TrashCounts>({ trashed: 0, restored: 0, byType: {} })
  const [labels, setLabels] = useState<Record<string, string>>(DEFAULT_TYPE_LABELS)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [statusTab, setStatusTab] = useState<"trashed" | "restored" | "all">("trashed")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [deletedByFilter, setDeletedByFilter] = useState<string>("all")
  const [search, setSearch] = useState("")

  const [detailItem, setDetailItem] = useState<TrashItemRow | null>(null)
  const [restoreConfirmItem, setRestoreConfirmItem] = useState<TrashItemRow | null>(null)
  const [restoringId, setRestoringId] = useState<number | null>(null)

  const isAdmin = user?.role === "admin"

  const fetchTrash = useCallback(async () => {
    if (!isAdmin) return
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        status: statusTab,
        entityType: typeFilter,
      })
      const res = await fetch(`/api/trash?${params.toString()}`, {
        cache: "no-store",
        headers: {
          "x-user-role": user?.role || "",
          "x-user-id": String(user?.id || ""),
          "x-user-name": user?.name || "",
        },
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Greška pri učitavanju smeća.")
      }
      setItems(Array.isArray(data.items) ? data.items : [])
      if (data.counts) setCounts(data.counts)
      if (data.labels) setLabels({ ...DEFAULT_TYPE_LABELS, ...data.labels })
    } catch (err: any) {
      setError(err?.message || "Nije moguće učitati stavke iz smeća.")
    } finally {
      setIsLoading(false)
    }
  }, [isAdmin, statusTab, typeFilter, user?.id, user?.name, user?.role])

  useEffect(() => {
    fetchTrash()
  }, [fetchTrash])

  const uniqueDeletedByUsers = useMemo(() => {
    const names = new Set<string>()
    for (const item of items) {
      if (item.deleted_by_name) names.add(item.deleted_by_name)
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "hr"))
  }, [items])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (deletedByFilter !== "all" && item.deleted_by_name !== deletedByFilter) {
        return false
      }
      if (!q) return true
      const typeLabel = (labels[item.entity_type] || item.entity_type).toLowerCase()
      return (
        item.title.toLowerCase().includes(q) ||
        (item.subtitle || "").toLowerCase().includes(q) ||
        item.deleted_by_name.toLowerCase().includes(q) ||
        typeLabel.includes(q) ||
        item.data_json.toLowerCase().includes(q)
      )
    })
  }, [items, deletedByFilter, search, labels])

  const refreshContextForType = async (entityType: string) => {
    try {
      switch (entityType) {
        case "member":
        case "member_payment":
        case "member_function":
          await reloadMembers()
          break
        case "lecture":
          await refreshLectures()
          break
        case "meeting":
        case "meeting_agenda_item":
          await reloadMeetings()
          break
        case "project":
        case "project_record":
        case "project_contributor":
          await refreshProjects()
          break
        case "library_book":
          await refreshBooks()
          break
        case "library_journal":
          await refreshJournals()
          break
        case "contact":
          await refreshContacts()
          break
        case "useful_link":
          await refreshLinks()
          break
        case "attachment":
          await Promise.all([
            refreshLectures(),
            reloadMeetings(),
            refreshProjects(),
            refreshBooks(),
            refreshJournals(),
          ])
          break
        case "personal_todo":
          await Promise.all([reloadMembers(), refreshSettings()])
          break
        default:
          break
      }
      await refreshLogs()
    } catch (e) {
      console.warn("Context refresh warning after undelete:", e)
    }
  }

  const handleRestore = async (item: TrashItemRow) => {
    setRestoringId(item.id)
    setNotice(null)
    try {
      const res = await fetch("/api/trash", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": user?.role || "",
          "x-user-id": String(user?.id || ""),
          "x-user-name": user?.name || "",
        },
        body: JSON.stringify({
          action: "restore",
          id: item.id,
          actor: user
            ? { id: String(user.id), name: user.name, role: user.role, email: user.email }
            : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Vraćanje stavke nije uspjelo.")
      }
      setRestoreConfirmItem(null)
      setDetailItem(null)
      setNotice({
        type: "success",
        text: data.message || `Stavka "${item.title}" uspješno je vraćena iz smeća (Undelete).`,
      })
      await Promise.all([fetchTrash(), refreshContextForType(item.entity_type)])
    } catch (err: any) {
      setNotice({
        type: "error",
        text: err?.message || "Greška pri vraćanju stavke iz smeća.",
      })
    } finally {
      setRestoringId(null)
    }
  }

  if (!isAdmin) {
    return (
      <main className="flex-1 min-w-0 p-6 flex items-center justify-center">
        <Card className="max-w-md w-full border-red-200 bg-red-50/40">
          <CardContent className="p-8 text-center space-y-3">
            <ShieldAlert className="h-12 w-12 text-red-600 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Pristup odbijen</h2>
            <p className="text-sm text-muted-foreground">
              Smeće i evidenciju obrisanih stavki vidi jedino administrator sustava.
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="flex-1 min-w-0 overflow-auto pb-24">
      <DesktopHeaderNav activeItem="trash" showBar />

      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-red-500/10 text-red-600 border border-red-200 shrink-0">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight">
                  Smeće i evidencija brisanja
                </h1>
                <Badge className="bg-red-100 text-red-800 border-red-200">
                  Samo administrator
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Svaka stavka koju bilo koji korisnik obriše u sustavu pohranjuje se ovdje s potpunim tragom tko ju je obrisao i mogućnošću povratka (Undelete).
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchTrash}
            disabled={isLoading}
            className="gap-2 shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Osvježi
          </Button>
        </div>

        {/* Notice */}
        {notice && (
          <div
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
              notice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            <div className="flex items-center gap-2">
              {notice.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              )}
              <span>{notice.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Aktivno u smeću
                </p>
                <p className="text-3xl font-bold text-red-600 mt-1">{counts.trashed}</p>
              </div>
              <div className="p-3 rounded-xl bg-red-50 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Vraćeno u sustav (Undelete)
                </p>
                <p className="text-3xl font-bold text-emerald-600 mt-1">{counts.restored}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
                <RotateCcw className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Kategorija u smeću
                </p>
                <p className="text-3xl font-bold text-primary mt-1">
                  {Object.keys(counts.byType || {}).length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-primary/10 text-primary">
                <Layers className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs & Filters */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex rounded-lg bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setStatusTab("trashed")}
                  className={`rounded-md px-3.5 py-1.5 text-xs md:text-sm font-medium transition-all ${
                    statusTab === "trashed"
                      ? "bg-background shadow-sm font-bold text-red-600"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  U smeću ({counts.trashed})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusTab("restored")}
                  className={`rounded-md px-3.5 py-1.5 text-xs md:text-sm font-medium transition-all ${
                    statusTab === "restored"
                      ? "bg-background shadow-sm font-bold text-emerald-700"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Povijest vraćenih ({counts.restored})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusTab("all")}
                  className={`rounded-md px-3.5 py-1.5 text-xs md:text-sm font-medium transition-all ${
                    statusTab === "all"
                      ? "bg-background shadow-sm font-bold text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sve ({counts.trashed + counts.restored})
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pretraži po nazivu, korisniku ili sadržaju..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Sve kategorije" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Sve kategorije</SelectItem>
                  {Object.entries(labels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                      {counts.byType[key] ? ` (${counts.byType[key]})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={deletedByFilter} onValueChange={setDeletedByFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Svi korisnici" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi korisnici koji su brisali</SelectItem>
                  {uniqueDeletedByUsers.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
                {error}
              </div>
            ) : isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-3" />
                <p className="text-sm">Učitavanje stavki iz smeća...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-xl">
                <Trash2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="font-semibold text-muted-foreground">
                  {statusTab === "trashed"
                    ? "Smeće je trenutno prazno"
                    : "Nema zapisa koji odgovaraju odabranim filterima"}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1 max-w-md">
                  Sve stavke koje budu obrisane u bilo kojem dijelu aplikacije bit će trajno zabilježene ovdje dok ih administrator ne vrati.
                </p>
              </div>
            ) : (
              <>
                {/* Mobilni prikaz kartica */}
                <div className="md:hidden space-y-3">
                  {filteredItems.map((item) => {
                    const typeLabel = labels[item.entity_type] || item.entity_type
                    const roleInfo = ROLE_LABELS[(item.deleted_by_role || "").toLowerCase()] || {
                      label: item.deleted_by_role || "Korisnik",
                      cls: "bg-slate-100 text-slate-700 border-slate-200",
                    }
                    const isRestoring = restoringId === item.id
                    return (
                      <div key={`m-${item.id}`} className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px] font-semibold">
                              {typeLabel}
                            </Badge>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              ID: {item.original_id}
                            </span>
                          </div>
                          {item.status === "restored" ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] shrink-0">
                              Vraćeno
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px] shrink-0">
                              U smeću
                            </Badge>
                          )}
                        </div>

                        <div>
                          <p className="font-semibold text-sm text-foreground break-words">{item.title}</p>
                          {item.subtitle && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.subtitle}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground border-t border-border pt-2">
                          <span className="inline-flex items-center gap-1 font-medium text-foreground">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {item.deleted_by_name}
                          </span>
                          <Badge variant="outline" className={`text-[10px] ${roleInfo.cls}`}>
                            {roleInfo.label}
                          </Badge>
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] ml-auto">
                            <Clock className="h-3 w-3" />
                            {formatDateTimeDMY(item.deleted_at, "—")}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1.5 h-8 text-xs"
                            onClick={() => setDetailItem(item)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Detalji
                          </Button>
                          {item.status === "trashed" && (
                            <Button
                              size="sm"
                              className="flex-1 gap-1.5 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={isRestoring}
                              onClick={() => setRestoreConfirmItem(item)}
                            >
                              {isRestoring ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                              )}
                              Vrati (Undelete)
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop tablica */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Stavka i kategorija</TableHead>
                      <TableHead>Obrisao korisnik</TableHead>
                      <TableHead>Datum brisanja</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => {
                      const typeLabel = labels[item.entity_type] || item.entity_type
                      const roleInfo = ROLE_LABELS[(item.deleted_by_role || "").toLowerCase()] || {
                        label: item.deleted_by_role || "Korisnik",
                        cls: "bg-slate-100 text-slate-700 border-slate-200",
                      }
                      const isRestoring = restoringId === item.id

                      return (
                        <TableRow key={item.id} className="hover:bg-muted/20">
                          <TableCell className="max-w-md">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-[10px] font-semibold">
                                  {typeLabel}
                                </Badge>
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  ID: {item.original_id}
                                </span>
                              </div>
                              <p className="font-semibold text-sm text-foreground break-words">
                                {item.title}
                              </p>
                              {item.subtitle && (
                                <p className="text-xs text-muted-foreground truncate max-w-sm" title={item.subtitle}>
                                  {item.subtitle}
                                </p>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 font-medium text-sm">
                                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span>{item.deleted_by_name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="outline" className={`text-[10px] ${roleInfo.cls}`}>
                                  {roleInfo.label}
                                </Badge>
                                {item.deleted_by_email && (
                                  <span className="text-[11px] text-muted-foreground">
                                    {item.deleted_by_email}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              <span>{formatDateTimeDMY(item.deleted_at, "—")}</span>
                            </div>
                          </TableCell>

                          <TableCell>
                            {item.status === "restored" ? (
                              <div className="space-y-1">
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[11px]">
                                  Vraćeno u sustav
                                </Badge>
                                {item.restored_at && (
                                  <p className="text-[11px] text-muted-foreground">
                                    {formatDateTimeDMY(item.restored_at, "")}
                                    {item.restored_by_name ? ` • ${item.restored_by_name}` : ""}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 border-red-200 text-[11px]">
                                U smeću
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 h-8 text-xs"
                                onClick={() => setDetailItem(item)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Detalji
                              </Button>

                              {item.status === "trashed" && (
                                <Button
                                  size="sm"
                                  className="gap-1.5 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                  disabled={isRestoring}
                                  onClick={() => setRestoreConfirmItem(item)}
                                >
                                  {isRestoring ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  )}
                                  Vrati (Undelete)
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Details modal */}
      <Dialog open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
        <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span>{detailItem?.title}</span>
              {detailItem && (
                <Badge variant="outline">
                  {labels[detailItem.entity_type] || detailItem.entity_type}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {detailItem && (
                <>
                  Obrisao: <strong>{detailItem.deleted_by_name}</strong> (
                  {ROLE_LABELS[(detailItem.deleted_by_role || "").toLowerCase()]?.label ||
                    detailItem.deleted_by_role ||
                    "korisnik"}
                  ) dana <strong>{formatDateTimeDMY(detailItem.deleted_at, "—")}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {detailItem && (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl border bg-muted/30 p-3">
                <div>
                  <span className="text-muted-foreground block">Tablica / izvor</span>
                  <span className="font-mono font-semibold">{detailItem.entity_table}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Izvorni ID</span>
                  <span className="font-mono font-semibold">{detailItem.original_id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Matični ID</span>
                  <span className="font-mono font-semibold">{detailItem.parent_id || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Status</span>
                  <span className="font-semibold">
                    {detailItem.status === "restored" ? "Vraćeno" : "U smeću"}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Pohranjeni podaci obrisane stavke
                </h4>
                <pre className="rounded-xl border bg-slate-950 text-slate-100 p-4 overflow-x-auto text-[11px] leading-relaxed">
                  {JSON.stringify(tryPrettyJson(detailItem.data_json), null, 2)}
                </pre>
              </div>

              {detailItem.related_json && (
                <div>
                  <h4 className="font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Povezani zapisi (prisutnost, glasovi, dnevnici...)
                  </h4>
                  <pre className="rounded-xl border bg-slate-950 text-slate-100 p-4 overflow-x-auto text-[11px] leading-relaxed">
                    {JSON.stringify(tryPrettyJson(detailItem.related_json), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDetailItem(null)}>
              Zatvori
            </Button>
            {detailItem?.status === "trashed" && (
              <Button
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={restoringId === detailItem.id}
                onClick={() => handleRestore(detailItem)}
              >
                {restoringId === detailItem.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Vrati iz smeća (Undelete)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore confirmation modal */}
      <Dialog
        open={!!restoreConfirmItem}
        onOpenChange={(open) => !open && setRestoreConfirmItem(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-emerald-600" />
              Vraćanje stavke iz smeća
            </DialogTitle>
            <DialogDescription>
              Jeste li sigurni da želite vratiti stavku{" "}
              <strong>&ldquo;{restoreConfirmItem?.title}&rdquo;</strong> natrag u aktivni sustav?
            </DialogDescription>
          </DialogHeader>
          {restoreConfirmItem && (
            <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
              <p>
                <span className="text-muted-foreground">Kategorija:</span>{" "}
                <strong>{labels[restoreConfirmItem.entity_type] || restoreConfirmItem.entity_type}</strong>
              </p>
              <p>
                <span className="text-muted-foreground">Obrisao:</span>{" "}
                <strong>{restoreConfirmItem.deleted_by_name}</strong> ({formatDateTimeDMY(restoreConfirmItem.deleted_at, "—")})
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreConfirmItem(null)}>
              Odustani
            </Button>
            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!restoreConfirmItem || restoringId === restoreConfirmItem.id}
              onClick={() => restoreConfirmItem && handleRestore(restoreConfirmItem)}
            >
              {restoringId === restoreConfirmItem?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Potvrdi povrat (Undelete)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
