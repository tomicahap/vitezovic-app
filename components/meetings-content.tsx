"use client"

import { useState, useMemo } from "react"
import {
  Search,
  Calendar,
  Plus,
  Filter,
  Clock,
  MapPin,
  Users,
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CalendarDays,
  X,
  BarChart3,
  Image as ImageIcon,
  Paperclip,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMeetings, Meeting } from "@/contexts/meetings-context"
import { useMembers } from "@/contexts/members-context"
import { useAuth } from "@/contexts/auth-context"
import { formatDateLong } from "@/lib/utils"
import { MeetingDetailDialog } from "./meeting-detail-dialog"
import { AddMeetingDialog } from "./add-meeting-dialog"
import { PollsList } from "./polls-list"
import { AddPollDialog } from "./add-poll-dialog"

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MEETING_TYPE_LABELS: Record<string, string> = {
  general: "Opća sjednica",
  board: "Sjednica uprave",
  committee: "Posebni odbor",
  workshop: "Radionica",
  emergency: "Izvanredna sjednica",
}

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  scheduled: { label: "Zakazana", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  completed: { label: "Završena", bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  cancelled: { label: "Otkazana", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || STATUS_META.scheduled
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.bg} ${meta.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  )
}

function calcDuration(start?: string, end?: string): string {
  if (!start || !end) return ""
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  const mins = eh * 60 + em - (sh * 60 + sm)
  if (mins <= 0) return ""
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ""}` : `${m}min`
}

// Use the central formatDateLong from @/lib/utils instead of local Date objects
const formatDate = formatDateLong

const PAGE_SIZE = 8

// ─── Component ────────────────────────────────────────────────────────────────

export function MeetingsContent() {
  const { meetings, isLoading } = useMeetings()
  const { members } = useMembers()
  const { user } = useAuth()
  const canEdit = user?.role === "admin" || user?.accessRights?.meetings?.edit === true
  const isAdmin = user?.role === "admin"
  const canViewPolls = isAdmin || user?.accessRights?.polls?.view !== false
  const canEditPolls = isAdmin || user?.accessRights?.polls?.edit === true

  // ── Filters
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
  const [yearFilter, setYearFilter] = useState("all")
  const [page, setPage] = useState(1)

  // ── Dialogs
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showAddPollDialog, setShowAddPollDialog] = useState(false)
  const [activeTab, setActiveTab] = useState<"meetings" | "polls">("meetings")
  const [pollsKey, setPollsKey] = useState(0)

  // ── Available years
  const years = useMemo(() => {
    const ys = new Set<string>()
    meetings.forEach(m => {
      const y = m.date?.slice(0, 4)
      if (y) ys.add(y)
    })
    return Array.from(ys).sort((a, b) => b.localeCompare(a))
  }, [meetings])

  // ── Filtered meetings
  const filtered = useMemo(() => {
    return meetings.filter(m => {
      const matchSearch =
        !search ||
        m.title.toLowerCase().includes(search.toLowerCase()) ||
        (m.location ?? "").toLowerCase().includes(search.toLowerCase())
      const matchType = typeFilter === "all" || m.type === typeFilter
      const matchStatus = statusFilter === "all" || m.status === statusFilter
      const matchYear = yearFilter === "all" || m.date?.startsWith(yearFilter)
      return matchSearch && matchType && matchStatus && matchYear
    })
  }, [meetings, search, typeFilter, statusFilter, yearFilter])

  // ── Stats
  const totalMeetings = meetings.length
  const scheduledCount = meetings.filter(m => m.status === "scheduled").length
  const thisYear = new Date().getFullYear().toString()
  const thisYearCount = meetings.filter(m => m.date?.startsWith(thisYear)).length
  const avgAttendance =
    meetings.length > 0
      ? Math.round(
          meetings.reduce((sum, m) => sum + (m.attendee_ids?.length || 0), 0) / meetings.length
        )
      : 0

  // ── Next upcoming meeting (first scheduled, soonest date)
  const nextMeeting = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return meetings
      .filter(m => m.status === "scheduled" && m.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0]
  }, [meetings])

  // ── Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function clearFilters() {
    setSearch("")
    setTypeFilter("all")
    setStatusFilter("all")
    setYearFilter("all")
    setPage(1)
  }

  const hasFilters =
    search || typeFilter !== "all" || statusFilter !== "all" || yearFilter !== "all"

  // ── Open detail (always get latest from list in case it was updated)
  function openMeeting(meeting: Meeting) {
    setSelectedMeeting(meeting)
  }

  // ── Refresh selected meeting when list updates
  const liveMeeting = useMemo(() => {
    if (!selectedMeeting) return null
    return meetings.find(m => m.id === selectedMeeting.id) ?? selectedMeeting
  }, [selectedMeeting, meetings])

  return (
    <main className="flex-1 overflow-auto">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-8 py-4">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pretraži sjednice po naslovu ili lokaciji..."
              className="border-border bg-card pl-10"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <div className="flex items-center gap-3">
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
                <X className="h-3.5 w-3.5" /> Poništi filtere
              </Button>
            )}

            {canEdit && activeTab === "meetings" && (
              <Button
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="h-4 w-4" />
                Nova sjednica
              </Button>
            )}
            {canEditPolls && activeTab === "polls" && (
              <Button
                className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => setShowAddPollDialog(true)}
              >
                <Plus className="h-4 w-4" />
                Novo glasovanje
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* ── Page title + Stats ─────────────────────────────────────────── */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="font-serif text-4xl font-bold">Sjednice i Glasovanje</h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Upravljajte sjednicama društva, zapisnicima i sustavom glasovanja (ankete).
            </p>
            <div className="mt-4 flex gap-4 border-b">
              <button 
                className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 ${activeTab === 'meetings' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('meetings')}
              >
                Popis sjednica
              </button>
              {canViewPolls && (
                <button 
                  className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 ${activeTab === 'polls' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setActiveTab('polls')}
                >
                  Glasovanja (Ankete)
                </button>
              )}
            </div>
          </div>

          {activeTab === 'meetings' && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { value: totalMeetings, label: "Ukupno" },
                { value: thisYearCount, label: "Ova godina" },
                { value: scheduledCount, label: "Zakazane" },
                { value: avgAttendance, label: "Prosj. prisutnost" },
              ].map(stat => (
                <div key={stat.label} className="rounded-lg border border-border bg-card p-4 text-center">
                  <p className="text-2xl font-bold text-accent">{stat.value}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Next meeting banner ────────────────────────────────────────── */}
        {nextMeeting && (
          <div
            className="mb-6 flex cursor-pointer items-center gap-4 rounded-xl border border-accent/30 bg-accent/5 px-5 py-4 hover:border-accent/50 transition-colors"
            onClick={() => openMeeting(nextMeeting)}
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                Sljedeća zakazana sjednica
              </p>
              <p className="font-semibold">{nextMeeting.title}</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(nextMeeting.date)}
                {nextMeeting.start_time && ` u ${nextMeeting.start_time}`}
                {nextMeeting.location && ` · ${nextMeeting.location}`}
              </p>
            </div>
            {(nextMeeting.next_meeting_agenda || []).length > 0 && (
              <Badge variant="outline" className="border-accent bg-accent/10 text-accent">
                {nextMeeting.next_meeting_agenda.length} toč. dnevnog reda
              </Badge>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        )}

        {activeTab === 'polls' && canViewPolls && (
          <PollsList key={pollsKey} rotateKey={pollsKey} />
        )}

        {activeTab === 'meetings' && (
          <>
          {/* ── Filters ─────────────────────────────────────────────────────── */}
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                VRSTA
              </label>
              <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1) }}>
                <SelectTrigger className="w-44 border-border bg-background">
                  <SelectValue placeholder="Sve vrste" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Sve vrste</SelectItem>
                  {Object.entries(MEETING_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                STATUS
              </label>
              <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1) }}>
                <SelectTrigger className="w-36 border-border bg-background">
                  <SelectValue placeholder="Svi statusi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi statusi</SelectItem>
                  <SelectItem value="scheduled">Zakazana</SelectItem>
                  <SelectItem value="completed">Završena</SelectItem>
                  <SelectItem value="cancelled">Otkazana</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                GODINA
              </label>
              <Select value={yearFilter} onValueChange={v => { setYearFilter(v); setPage(1) }}>
                <SelectTrigger className="w-32 border-border bg-background">
                  <SelectValue placeholder="Sve godine" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Sve godine</SelectItem>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto text-sm text-muted-foreground">
              {filtered.length === 0
                ? "Nema rezultata"
                : `${filtered.length} ${filtered.length === 1 ? "sjednica" : filtered.length < 5 ? "sjednice" : "sjednica"}`}
            </div>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Učitavanje sjednica…</p>
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
            <Calendar className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-lg font-semibold text-muted-foreground">
              {hasFilters ? "Nema sjednica koje odgovaraju filterima" : "Još nema sjednica"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasFilters ? (
                <button onClick={clearFilters} className="text-accent underline-offset-2 hover:underline">
                  Poništi filtere
                </button>
              ) : isAdmin ? (
                <button
                  onClick={() => setShowAddDialog(true)}
                  className="text-accent underline-offset-2 hover:underline"
                >
                  Zakaži prvu sjednicu
                </button>
              ) : null}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {paged.map(meeting => {
              const duration = calcDuration(meeting.start_time, meeting.end_time)
              const attendeeNames = (meeting.attendee_ids || [])
                .slice(0, 4)
                .map(id => members.find(m => m.id === id))
                .filter(Boolean)
              const extraAttendees = Math.max(0, (meeting.attendee_ids || []).length - 4)
              const hasNextMeeting = !!meeting.next_meeting_date
              const nextAgendaCount = (meeting.next_meeting_agenda || []).length

              return (
                <div
                  key={meeting.id}
                  onClick={() => openMeeting(meeting)}
                  className="group cursor-pointer rounded-xl border border-border bg-card p-5 transition-all hover:border-accent/40 hover:shadow-md"
                >
                  {/* Top */}
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <Badge
                        variant="outline"
                        className="mb-2 border-accent/40 bg-accent/5 text-accent text-[10px]"
                      >
                        {MEETING_TYPE_LABELS[meeting.type] ?? meeting.type}
                      </Badge>
                      <h3 className="font-serif text-lg font-bold leading-tight group-hover:text-accent transition-colors">
                        {meeting.title}
                      </h3>
                    </div>
                    <StatusBadge status={meeting.status} />
                  </div>

                  {/* Meta */}
                  <div className="mb-3 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(meeting.date)}
                      </span>
                      {meeting.start_time && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {meeting.start_time}
                          {meeting.end_time && `–${meeting.end_time}`}
                          {duration && (
                            <span className="text-muted-foreground/60">({duration})</span>
                          )}
                        </span>
                      )}
                    </div>
                    {meeting.location && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        {meeting.location}
                      </div>
                    )}
                  </div>

                  {/* Minutes preview */}
                  {meeting.minutes && (
                    <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                      {meeting.minutes}
                    </p>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    {/* Attendees & Attachments */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {attendeeNames.map((m: any) => (
                            <Avatar key={m.id} className="h-7 w-7 border-2 border-card shadow-sm">
                              <AvatarFallback className="bg-secondary text-[10px]">
                                {m.initials}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {extraAttendees > 0 && (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-secondary text-[10px] font-medium">
                              +{extraAttendees}
                            </div>
                          )}
                        </div>
                        {(meeting.attendee_ids || []).length > 0 && (
                          <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-50 border-green-100/50 gap-1.5 px-2.5 py-1 h-7">
                            <Users className="h-3.5 w-3.5" />
                            <span className="text-xs font-bold">{meeting.attendee_ids.length}</span>
                          </Badge>
                        )}
                      </div>

                      {/* Indicators */}
                      {(meeting.attachments || []).length > 0 && (
                        <div className="flex items-center gap-2 border-l border-border pl-2">
                          {((meeting.attachments || []).filter((a: any) => a.fileType === 'image').length > 0) && (
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-100/50 gap-1.5 px-2 py-1 h-7">
                              <ImageIcon className="h-3.5 w-3.5" />
                              <span className="text-xs font-bold">{(meeting.attachments || []).filter((a: any) => a.fileType === 'image').length}</span>
                            </Badge>
                          )}
                          {(meeting.attachments || []).filter(a => a.fileType !== 'image').length > 0 && (
                            <Badge variant="secondary" className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-100/50 gap-1.5 px-2 py-1 h-7">
                              <Paperclip className="h-3.5 w-3.5" />
                              <span className="text-xs font-bold">{(meeting.attachments || []).filter(a => a.fileType !== 'image').length}</span>
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>


                    {/* Right badges */}
                    <div className="flex items-center gap-2">
                      {(meeting.attachments || []).length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="h-3.5 w-3.5" />
                          {meeting.attachments.length}
                        </span>
                      )}
                      {hasNextMeeting && (
                        <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                          <CalendarDays className="h-3 w-3" />
                          Sljedeća zakazana
                          {nextAgendaCount > 0 && ` · ${nextAgendaCount} toč.`}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Pagination ──────────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Prikazano{" "}
              <span className="font-medium text-foreground">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}
              </span>{" "}
              od{" "}
              <span className="font-medium text-foreground">{filtered.length}</span> sjednica
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="rounded p-2 hover:bg-secondary disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && typeof arr[idx - 1] === "number" && (p as number) - (arr[idx - 1] as number) > 1) {
                    acc.push("...")
                  }
                  acc.push(p)
                  return acc
                }, [])
                .map((p, idx) =>
                  p === "..." ? (
                    <span key={`dots-${idx}`} className="px-2 text-muted-foreground">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={`h-8 w-8 rounded text-sm ${
                        page === p
                          ? "bg-primary text-primary-foreground font-medium"
                          : "hover:bg-secondary"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="rounded p-2 hover:bg-secondary disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        </>
      )}
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      {liveMeeting && (
        <MeetingDetailDialog
          meeting={liveMeeting}
          onClose={() => setSelectedMeeting(null)}
        />
      )}
      {showAddDialog && (
        <AddMeetingDialog
          onClose={() => setShowAddDialog(false)}
        />
      )}
      {showAddPollDialog && (
        <AddPollDialog
          onClose={() => setShowAddPollDialog(false)}
          onPollAdded={() => setPollsKey(prev => prev + 1)}
        />
      )}
    </main>
  )
}