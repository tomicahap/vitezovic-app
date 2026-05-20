"use client"

import { useState, useMemo } from "react"
import {
  Search, Plus, Calendar, Clock, MapPin, Users, Paperclip, Image as ImageIcon,
  ChevronLeft, ChevronRight, Loader2, Mic, X, ChevronDown, Youtube
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useLectures, Lecture } from "@/contexts/lectures-context"
import { useMembers } from "@/contexts/members-context"
import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"
import { formatDateLong } from "@/lib/utils"
import { LectureDetailDialog } from "./lecture-detail-dialog"
import { AddLectureDialog } from "./add-lecture-dialog"
import { ExternalLibrariesContent } from "./external-libraries-content"
import { LibraryContactLogsDialog } from "./library-contact-logs-dialog"
import { AddLibraryDialog } from "./add-library-dialog"
import { ExternalLibrary } from "@/types/external-library"
import { LecturesMap } from "./lectures-map-wrapper"

// ─── Types ────────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; color: string }> = {
  lecture:   { label: "Predavanje",     color: "border-purple-400 bg-purple-50 text-purple-700" },
  visit:     { label: "Gostovanje",     color: "border-blue-400 bg-blue-50 text-blue-700" },
  guest:     { label: "Gost predavač",  color: "border-emerald-400 bg-emerald-50 text-emerald-700" },
  workshop:  { label: "Radionica",      color: "border-orange-400 bg-orange-50 text-orange-700" },
  excursion: { label: "Izlet",          color: "border-teal-400 bg-teal-50 text-teal-700" },
}

const STATUS_META: Record<string, { label: string; dot: string }> = {
  scheduled: { label: "Zakazano",  dot: "bg-blue-500" },
  completed: { label: "Završeno",  dot: "bg-green-500" },
  cancelled: { label: "Otkazano",  dot: "bg-red-500" },
}

const PAGE_SIZE = 8

// Use the central formatDateLong from @/lib/utils instead of local Date objects
const formatDate = formatDateLong

// ─── Component ────────────────────────────────────────────────────────────────

export function LecturesContent() {
  const { lectures, isLoading } = useLectures()
  const { members } = useMembers()
  const { user } = useAuth()
  const canEdit = user?.role === "admin" || user?.accessRights?.lectures?.edit === true

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [yearFilter, setYearFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Lecture | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [activeTab, setActiveTab] = useState<'lectures' | 'libraries'>('lectures')
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [selectedLibrary, setSelectedLibrary] = useState<ExternalLibrary | null>(null)
  const [showAddLibrary, setShowAddLibrary] = useState(false)

  // Calendar State
  const [curDate, setCurDate] = useState(new Date())
  const curYear = curDate.getFullYear()
  const curMonth = curDate.getMonth()

  const years = useMemo(() => {
    const ys = new Set<string>()
    lectures.forEach(l => { const y = l.date?.slice(0, 4); if (y) ys.add(y) })
    return Array.from(ys).sort((a, b) => b.localeCompare(a))
  }, [lectures])

  const filtered = useMemo(() => lectures.filter(l => {
    const s = !search || l.title.toLowerCase().includes(search.toLowerCase()) ||
      (l.host ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (l.hosts || []).some(h => h.name.toLowerCase().includes(search.toLowerCase())) ||
      (l.location ?? "").toLowerCase().includes(search.toLowerCase())
    const t = typeFilter === "all" || l.type === typeFilter
    const st = statusFilter === "all" || l.status === statusFilter
    const y = yearFilter === "all" || l.date?.startsWith(yearFilter)
    return s && t && st && y
  }), [lectures, search, typeFilter, statusFilter, yearFilter])

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const hasFilters = search || typeFilter !== "all" || statusFilter !== "all" || yearFilter !== "all"

  // Stats
  const thisYear = new Date().getFullYear().toString()
  const stats = {
    total: lectures.length,
    thisYear: lectures.filter(l => l.date?.startsWith(thisYear)).length,
    upcoming: lectures.filter(l => l.status === "scheduled").length,
    avgAttendance: lectures.length > 0
      ? Math.round(lectures.reduce((s, l) => s + (l.attendee_ids?.length || 0), 0) / lectures.length)
      : 0,
  }

  const liveLecture = selected ? lectures.find(l => l.id === selected.id) ?? selected : null

  return (
    <main className="flex-1 overflow-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-8 py-4">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Pretraži predavanja i gostovanja..."
              className="border-border bg-card pl-10" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <div className="flex items-center gap-3">
            <div className="mr-8 flex rounded-lg bg-muted p-1">
              <button
                onClick={() => setActiveTab('lectures')}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${activeTab === 'lectures' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Predavanja
              </button>
              <button
                onClick={() => setActiveTab('libraries')}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${activeTab === 'libraries' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Knjižnice
              </button>
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setTypeFilter("all"); setStatusFilter("all"); setYearFilter("all"); setPage(1) }}
                className="gap-1.5 text-muted-foreground">
                <X className="h-3.5 w-3.5" /> Poništi filtere
              </Button>
            )}
            {canEdit && (
              <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" 
                onClick={() => activeTab === 'lectures' ? setShowAdd(true) : setShowAddLibrary(true)}>
                <Plus className="h-4 w-4" /> {activeTab === 'lectures' ? 'Novo predavanje' : 'Nova knjižnica'}
              </Button>
            )}
          </div>
        </div>
      </header>

      {activeTab === 'lectures' ? (
        <div className="p-8">
          {/* Title + stats */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h2 className="font-serif text-4xl font-bold">Predavanja i gostovanja</h2>
              <p className="mt-2 max-w-xl text-muted-foreground">
                Evidencija predavanja, gostujućih predavača i gostovanja društva.
              </p>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { value: stats.total, label: "Ukupno" },
                { value: stats.thisYear, label: "Ova godina" },
                { value: stats.upcoming, label: "Zakazano" },
                { value: stats.avgAttendance, label: "Prosj. prisutnost" },
              ].map(s => (
                <div key={s.label} className="rounded-lg border border-border bg-card p-4 text-center">
                  <p className="text-2xl font-bold text-accent">{s.value}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">VRSTA</label>
                <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1) }}>
                  <SelectTrigger className="w-44 border-border bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Sve vrste</SelectItem>
                    {Object.entries(TYPE_META).map(([v, { label }]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">STATUS</label>
                <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1) }}>
                  <SelectTrigger className="w-36 border-border bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Svi</SelectItem>
                    <SelectItem value="scheduled">Zakazano</SelectItem>
                    <SelectItem value="completed">Završeno</SelectItem>
                    <SelectItem value="cancelled">Otkazano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">GODINA</label>
                <Select value={yearFilter} onValueChange={v => { setYearFilter(v); setPage(1) }}>
                  <SelectTrigger className="w-32 border-border bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Sve godine</SelectItem>
                    {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto flex items-center gap-4">
                <div className="text-sm text-muted-foreground">{filtered.length} rezultata</div>
                <div className="flex bg-muted p-1 rounded-lg">
                  <button 
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Popis
                  </button>
                  <button 
                    onClick={() => setViewMode('map')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'map' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Karta
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="mb-4 h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Učitavanje…</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              {/* LEFT: List / Map */}
              <div className="lg:col-span-8 space-y-6">
                {viewMode === 'map' ? (
                  <LecturesMap lectures={filtered} onSelectLecture={setSelected} />
                ) : paged.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
                    <Mic className="mb-4 h-12 w-12 text-muted-foreground/30" />
                    <p className="text-lg font-semibold text-muted-foreground">{hasFilters ? "Nema rezultata" : "Još nema predavanja"}</p>
                  </div>
                ) : (
                  <div className="grid gap-5">
                    {paged.map(lecture => {
                      const typeMeta = TYPE_META[lecture.type] ?? { label: lecture.type, color: "border-border bg-card" }
                      const statusMeta = STATUS_META[lecture.status] ?? STATUS_META.scheduled
                      const attendees = (lecture.attendee_ids || []).slice(0, 4)
                        .map(id => members.find(m => m.id === id)).filter(Boolean)
                      const extra = Math.max(0, (lecture.attendee_ids || []).length - 4)

                      return (
                        <div key={lecture.id} onClick={() => setSelected(lecture)}
                          className="group cursor-pointer rounded-xl border border-border bg-card p-5 transition-all hover:border-accent/40 hover:shadow-md">
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <span className={`mb-2 inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${typeMeta.color}`}>
                                {typeMeta.label}
                              </span>
                              <h3 className="font-serif text-lg font-bold leading-tight group-hover:text-accent transition-colors">{lecture.title}</h3>
                              {((lecture.hosts && lecture.hosts.length > 0) || lecture.host) && (
                                <p className="mt-0.5 text-sm text-muted-foreground">
                                  Predavač: <span className="font-medium text-foreground">
                                    {lecture.hosts && lecture.hosts.length > 0 
                                      ? lecture.hosts.map(h => h.name).join(", ") 
                                      : lecture.host}
                                  </span>
                                </p>
                              )}
                            </div>
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
                              <span className="text-muted-foreground">{statusMeta.label}</span>
                            </span>
                          </div>

                          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{formatDate(lecture.date)}</span>
                            {lecture.start_time && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{lecture.start_time}{lecture.end_time && `–${lecture.end_time}`}</span>}
                            {lecture.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{lecture.location}</span>}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <div className="flex -space-x-2">
                                  {attendees.map((m: any) => (
                                    <Avatar key={m.id} className="h-7 w-7 border-2 border-card">
                                      <AvatarFallback className="bg-secondary text-[10px]">{m.initials}</AvatarFallback>
                                    </Avatar>
                                  ))}
                                  {extra > 0 && <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-secondary text-[10px] font-medium">+{extra}</div>}
                                </div>
                                {(lecture.attendee_ids || []).length > 0 && (
                                  <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-50 border-green-100/50 gap-1 px-2 py-0.5 h-6">
                                    <Users className="h-3 w-3" />
                                    <span className="text-[10px] font-bold">{lecture.attendee_ids.length}</span>
                                    <span className="text-[10px]">prisutnih</span>
                                  </Badge>
                                )}
                              </div>

                              {/* Attachments Indicators */}
                              {(lecture.attachments || []).length > 0 && (
                                <div className="flex items-center gap-2.5 border-l border-border pl-4">
                                  {((lecture.attachments || []).filter(a => a.fileType === 'image').length > 0) && (
                                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-100/50 gap-1 px-1.5 py-0.5 h-6">
                                      <ImageIcon className="h-3 w-3" />
                                      <span className="text-[10px] font-bold">{(lecture.attachments || []).filter(a => a.fileType === 'image').length}</span>
                                    </Badge>
                                  )}
                                  {((lecture.attachments || []).filter(a => a.fileType !== 'image').length > 0) && (
                                    <Badge variant="secondary" className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-100/50 gap-1 px-1.5 py-0.5 h-6">
                                      <Paperclip className="h-3 w-3" />
                                      <span className="text-[10px] font-bold">{(lecture.attachments || []).filter(a => a.fileType !== 'image').length}</span>
                                    </Badge>
                                  )}
                                  {lecture.youtube_url && (
                                    <Badge variant="secondary" className="bg-red-50 text-red-600 hover:bg-red-50 border-red-100/50 gap-1 px-1.5 py-0.5 h-6">
                                      <Youtube className="h-3 w-3" />
                                      <span className="text-[10px] font-bold">Video</span>
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Pagination */}
                {viewMode === 'list' && totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">Strana <span className="font-medium">{page}</span> od <span className="font-medium">{totalPages}</span></p>
                    <div className="flex items-center gap-1">
                      <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded p-2 hover:bg-secondary disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                      <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="rounded p-2 hover:bg-secondary disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT: Calendar Widget */}
              <div className="lg:col-span-4 space-y-6">
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-serif text-lg font-bold">
                      {new Date(curYear, curMonth).toLocaleDateString("hr-HR", { month: "long", year: "numeric" })}
                    </h3>
                    <div className="flex gap-1">
                      <button onClick={() => setCurDate(new Date(curYear, curMonth - 1, 1))} className="p-1 hover:bg-secondary rounded"><ChevronLeft className="h-4 w-4" /></button>
                      <button onClick={() => setCurDate(new Date(curYear, curMonth + 1, 1))} className="p-1 hover:bg-secondary rounded"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 mb-2">
                    {["P", "U", "S", "Č", "P", "S", "N"].map((d, i) => (
                      <div key={`${d}-${i}`} className="text-center text-[10px] font-bold text-muted-foreground uppercase">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-px bg-border border border-border rounded-lg overflow-hidden">
                    {Array.from({ length: 42 }).map((_, i) => {
                      const firstDay = new Date(curYear, curMonth, 1).getDay()
                      const offset = firstDay === 0 ? 6 : firstDay - 1
                      const date = new Date(curYear, curMonth, i - offset + 1)
                      const isCurrentMonth = date.getMonth() === curMonth
                      const isToday = date.toDateString() === new Date().toDateString()
                      
                      // Format local date manually to YYYY-MM-DD to avoid toISOString() UTC offset shift
                      const y = date.getFullYear()
                      const m = String(date.getMonth() + 1).padStart(2, '0')
                      const d = String(date.getDate()).padStart(2, '0')
                      const dateStr = `${y}-${m}-${d}`
                      
                      const dayLectures = lectures.filter(l => l.date === dateStr)

                      if (!isCurrentMonth && i >= 35 && date.getDate() < 7) return null
                      if (!isCurrentMonth && i < 7 && date.getDate() > 20) return (
                        <div key={i} className="bg-muted/5 h-10" />
                      )

                      return (
                        <div key={i} className={`h-12 bg-card relative p-1 group transition-colors ${!isCurrentMonth ? "opacity-20" : ""}`}>
                          <span className={`text-[10px] font-medium ${isToday ? "flex h-5 w-5 items-center justify-center bg-accent text-accent-foreground rounded-full" : "text-muted-foreground"}`}>
                            {date.getDate()}
                          </span>
                          <div className="mt-1 flex flex-wrap gap-0.5">
                            {dayLectures.map(l => (
                              <div key={l.id} title={l.title} onClick={() => setSelected(l)}
                                className={`h-1.5 w-1.5 rounded-full cursor-pointer hover:scale-125 transition-transform ${l.type === 'lecture' ? 'bg-purple-500' : l.type === 'visit' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                            ))}
                          </div>
                        </div>
                      )
                    }).filter(Boolean)}
                  </div>

                  <div className="mt-4 space-y-2 border-t border-border pt-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Legenda</p>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-purple-500" /> Predavanje</div>
                      <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" /> Gostovanje</div>
                      <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-500" /> Radionica</div>
                    </div>
                  </div>
                </div>

                {/* Tips / Info */}
                <div className="rounded-xl bg-accent/5 p-4 border border-accent/10">
                  <p className="text-xs text-muted-foreground italic">
                    Kliknite na točkicu u kalendaru za brzi pregled detalja predavanja na taj dan.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <ExternalLibrariesContent search={search} onSelect={setSelectedLibrary} />
      )}

      {liveLecture && <LectureDetailDialog lecture={liveLecture} onClose={() => setSelected(null)} />}
      {showAdd && <AddLectureDialog onClose={() => setShowAdd(false)} />}
      {selectedLibrary && <LibraryContactLogsDialog library={selectedLibrary} onClose={() => setSelectedLibrary(null)} />}
      {showAddLibrary && <AddLibraryDialog onClose={() => setShowAddLibrary(false)} />}
    </main>
  )
}
