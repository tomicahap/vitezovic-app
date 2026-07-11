"use client"

import { useState, useRef, useEffect } from "react"
import {
  X, Calendar, Clock, MapPin, Users, Paperclip, Plus,
  Trash2, Check, Image, File, FileType2, Download, Save, Search, ZoomIn, User, Youtube, ExternalLink
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useLectures, Lecture } from "@/contexts/lectures-context"
import { useMembers } from "@/contexts/members-context"
import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"
import { TimeInput24h } from "@/components/ui/time-input-24h"
import { Linkify } from "./linkify"
import { SendNotificationDialog } from "./send-notification-dialog"

import { generateId, formatDateLong } from "@/lib/utils"

const TYPE_LABELS: Record<string, string> = {
  lecture: "Predavanje",
  visit: "Gostovanje",
  guest: "Gost predavač",
  workshop: "Radionica",
  excursion: "Izlet / ekskurzija",
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Zakazano", cls: "bg-blue-100 text-blue-700" },
  completed: { label: "Završeno", cls: "bg-green-100 text-green-700" },
  cancelled: { label: "Otkazano", cls: "bg-red-100 text-red-700" },
}

function Lightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90" onClick={onClose}>
      <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white" onClick={onClose}><X className="h-5 w-5" /></button>
      <img src={url} alt={name} onClick={e => e.stopPropagation()} className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl" />
    </div>
  )
}

type Tab = "details" | "attendance" | "attachments"

export function LectureDetailDialog({ lecture: initial, onClose }: { lecture: Lecture; onClose: () => void }) {
  const { updateLecture, deleteLecture } = useLectures()
  const { members } = useMembers()
  const { user } = useAuth()
  const { settings } = useSettings()
  const [lecture, setLecture] = useState<Lecture>(initial)
  const isSuperAdmin = user?.role === "admin"
  const isAdmin = user?.role === "admin" || user?.role === "moderator"
  const canNotify = isAdmin || getAccessRight('lectures').notify
  const isCompleted = lecture.status === "completed"
  const canEdit = isAdmin
  const [tab, setTab] = useState<Tab>("details")
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [attendeeSearch, setAttendeeSearch] = useState("")
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null)
  const [showLocDrop, setShowLocDrop] = useState(false)
  const [hostSearch, setHostSearch] = useState("")
  const [showHostDrop, setShowHostDrop] = useState(false)
  const [showNotifyDialog, setShowNotifyDialog] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLecture(initial); setIsDirty(false) }, [initial])

  function patch(updates: Partial<Lecture>) {
    setLecture(prev => ({ ...prev, ...updates }))
    setIsDirty(true)
  }

  async function handleSave() {
    setIsSaving(true)
    await updateLecture(lecture.id, lecture)
    setIsSaving(false)
    setIsDirty(false)
  }

  async function handleDelete() {
    if (!confirm("Sigurno želiš obrisati ovo predavanje/gostovanje?")) return
    await deleteLecture(lecture.id)
    onClose()
  }

  // Attendance
  const activeMembers = members.filter(m => m.status === "active" || (lecture.attendee_ids || []).includes(m.id))
  const filteredMembers = attendeeSearch.trim()
    ? activeMembers.filter(m => m.name.toLowerCase().includes(attendeeSearch.toLowerCase()))
    : activeMembers

  const grouped = filteredMembers.reduce<Record<string, typeof filteredMembers>>((acc, m) => {
    const parts = m.name.trim().split(/\s+/)
    const letter = (parts[parts.length - 1]?.[0] ?? m.name[0] ?? "?").toUpperCase()
    acc[letter] = acc[letter] ?? []
    acc[letter].push(m)
    return acc
  }, {})

  function toggleAttendee(id: number) {
    const curr = lecture.attendee_ids || []
    patch({ attendee_ids: curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id] })
  }

  // Attachments
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const newAttachments = [...(lecture.attachments || [])]
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const form = new FormData()
        form.append("file", file)
        const res = await fetch("/api/meetings/upload", { method: "POST", body: form })
        if (res.ok) {
          const { url, name, fileType, size } = await res.json()
          newAttachments.push({ id: generateId(), name, url, fileType, size })
        }
      }
      patch({ attachments: newAttachments })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const count = (lecture.attendee_ids || []).length
  const attachCount = (lecture.attachments || []).length
  const statusMeta = STATUS_LABELS[lecture.status] || STATUS_LABELS.scheduled

  const tabs: { id: Tab; label: string }[] = [
    { id: "details", label: "Detalji" },
    { id: "attendance", label: `Prisutnost (${count})` },
    { id: "attachments", label: `Prilozi (${attachCount})` },
  ]

  return (
    <>
      {lightbox && <Lightbox url={lightbox.url} name={lightbox.name} onClose={() => setLightbox(null)} />}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-background shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div className="flex-1 pr-4">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-accent bg-accent/10 text-accent text-xs">
                {TYPE_LABELS[lecture.type] ?? lecture.type}
              </Badge>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusMeta.cls}`}>{statusMeta.label}</span>
            </div>
            {canEdit ? (
              <input value={lecture.title} onChange={e => patch({ title: e.target.value })}
                className="w-full bg-transparent font-serif text-2xl font-bold leading-tight outline-none placeholder:text-muted-foreground/50 border-b border-transparent focus:border-border transition-colors"
                placeholder="Naslov..." />
            ) : (
              <h2 className="font-serif text-2xl font-bold leading-tight">{lecture.title}</h2>
            )}
            
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />
                {formatDateLong(lecture.date)}</span>
              {lecture.start_time && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{lecture.start_time}{lecture.end_time && `–${lecture.end_time}`}</span>}
              {lecture.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{lecture.location}</span>}
              {((lecture.hosts && lecture.hosts.length > 0) || lecture.host) && (
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {lecture.hosts && lecture.hosts.length > 0 
                    ? lecture.hosts.map(h => h.name).join(", ") 
                    : lecture.host}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canNotify && (
              <button 
                onClick={() => setShowNotifyDialog(true)} 
                className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors mr-2" 
                title="Pošalji obavijest tijelima društva"
              >
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Obavijesti</span>
              </button>
            )}
            <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`border-b-2 px-3 py-3 text-xs font-medium transition-colors ${tab === t.id ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {tab === "details" && (
            <div className="space-y-5 p-6">
              {lecture.youtube_url && (
                <div className="rounded-xl border border-red-100 bg-red-50/40 p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.107C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.388.511a3.002 3.002 0 0 0-2.11 2.107C0 8.053 0 12 0 12s0 3.947.502 5.837a3.003 3.003 0 0 0 2.11 2.107C4.495 20.455 12 20.455 12 20.455s7.505 0 9.388-.511a3.002 3.002 0 0 0 2.11 2.107C24 15.947 24 12 24 12s0-3.947-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Video snimka predavanja</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">Snimka predavanja je dostupna na YouTubeu</p>
                    </div>
                  </div>
                  <a
                    href={lecture.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition-colors shadow-sm shrink-0"
                  >
                    Gledaj snimku
                  </a>
                </div>
              )}
              {isAdmin && (
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Naslov", key: "title", type: "text" },
                    { label: "Datum", key: "date", type: "date" },
                    { label: "Početak", key: "start_time", type: "time" },
                    { label: "Završetak", key: "end_time", type: "time" },
                  ].map(({ label, key, type, placeholder }) => (
                    <div key={key}>
                      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
                    <div className="relative">
                      {type === "time" ? (
                        <TimeInput24h 
                          value={(lecture as any)[key] ?? ""} 
                          onChange={v => patch({ [key]: v } as any)} 
                        />
                      ) : (
                        <input type={type} value={(lecture as any)[key] ?? ""} onChange={e => patch({ [key]: e.target.value } as any)}
                          disabled={!canEdit}
                          placeholder={placeholder}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60" />
                      )}
                    </div>
                    </div>
                  ))}

                  <div className="col-span-2">
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">YouTube link predavanja</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input value={lecture.youtube_url ?? ""} onChange={e => patch({ youtube_url: e.target.value })}
                          disabled={!canEdit}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60" />
                        <Youtube className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-600 opacity-50" />
                      </div>
                      {lecture.youtube_url && (
                        <a href={lecture.youtube_url} target="_blank" rel="noopener noreferrer" 
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 space-y-2">
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Predavači / gosti</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(lecture.hosts || []).map((h, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 py-1 px-2">
                          {h.name}
                          {canEdit && (
                            <button onClick={() => patch({ hosts: (lecture.hosts || []).filter((_, idx) => idx !== i) })} className="hover:text-red-500">
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </Badge>
                      ))}
                      {!(lecture.hosts && lecture.hosts.length > 0) && !lecture.host && (
                        <span className="text-xs text-muted-foreground italic">Nema upisanih predavača.</span>
                      )}
                      {lecture.host && !(lecture.hosts && lecture.hosts.length > 0) && (
                        <Badge variant="outline" className="opacity-70">{lecture.host} (stari zapis)</Badge>
                      )}
                    </div>
                    
                    {canEdit && (
                      <div className="relative">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <input 
                              value={hostSearch} 
                              onChange={e => { setHostSearch(e.target.value); setShowHostDrop(true) }}
                              onFocus={() => setShowHostDrop(true)}
                              placeholder="Pretraži članove ili upiši ime..."
                              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && hostSearch.trim()) {
                                  e.preventDefault();
                                  patch({ hosts: [...(lecture.hosts || []), { name: hostSearch.trim() }] });
                                  setHostSearch("");
                                  setShowHostDrop(false);
                                }
                              }}
                            />
                          </div>
                          <Button 
                            type="button" 
                            variant="secondary" 
                            size="sm"
                            disabled={!hostSearch.trim()}
                            onClick={() => {
                              patch({ hosts: [...(lecture.hosts || []), { name: hostSearch.trim() }] });
                              setHostSearch("");
                              setShowHostDrop(false);
                            }}
                          >
                            Dodaj ručno
                          </Button>
                        </div>
                        
                        {showHostDrop && hostSearch.trim() && (
                          <div className="absolute z-[60] mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-background shadow-xl">
                            {members
                              .filter(m => m.name.toLowerCase().includes(hostSearch.toLowerCase()))
                              .slice(0, 5)
                              .map(m => (
                                <button
                                  key={m.id}
                                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary"
                                  onClick={() => {
                                    patch({ hosts: [...(lecture.hosts || []), { name: m.name, memberId: m.id }] });
                                    setHostSearch("");
                                    setShowHostDrop(false);
                                  }}
                                >
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-[8px]">{m.initials}</AvatarFallback>
                                  </Avatar>
                                  <span>{m.name}</span>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Vrsta</label>
                    <select value={lecture.type} onChange={e => patch({ type: e.target.value })}
                      disabled={!canEdit}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60">
                      {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</label>
                    <select value={lecture.status} onChange={e => patch({ status: e.target.value as Lecture["status"] })}
                      disabled={!canEdit}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60">
                      <option value="scheduled">Zakazano</option>
                      <option value="completed">Završeno</option>
                      <option value="cancelled">Otkazano</option>
                    </select>
                  </div>

                  <div className="relative col-span-2">
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Lokacija</label>
                    <input value={lecture.location ?? ""} onChange={e => patch({ location: e.target.value })}
                      disabled={!canEdit}
                      onFocus={() => canEdit && settings.meetingLocations.length > 0 && setShowLocDrop(true)}
                      onBlur={() => setTimeout(() => setShowLocDrop(false), 150)}
                      placeholder="Upišite ili odaberite..."
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60" />
                    {showLocDrop && settings.meetingLocations.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-background shadow-lg">
                        {settings.meetingLocations.map(loc => (
                          <button key={loc} type="button" onMouseDown={() => { patch({ location: loc }); setShowLocDrop(false) }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />{loc}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Opis / bilješke</label>
                {canEdit ? (
                  <textarea value={lecture.description ?? ""} onChange={e => patch({ description: e.target.value })}
                    rows={8} placeholder="Sažetak sadržaja, napomene..."
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60" />
                ) : (
                  <div className="min-h-[120px] whitespace-pre-wrap rounded-lg border border-border bg-secondary/30 p-4 text-sm leading-relaxed text-muted-foreground">
                    {lecture.description ? <Linkify text={lecture.description} /> : <span className="italic">Bez opisa.</span>}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "attendance" && (
            <div className="flex flex-col h-full bg-secondary/5">
              <div className="border-b border-border bg-background p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Popis prisutnih</h3>
                    <p className="text-xs text-muted-foreground">{count} od {activeMembers.length} prisutno</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-700 shadow-sm border border-green-200">{count} PRISUTNO</span>
                  </div>
                </div>

                <div className="mb-6 rounded-xl border border-accent/20 bg-accent/5 p-4">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-accent">Brzi pregled prisutnih:</p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                    {lecture.attendee_ids && lecture.attendee_ids.length > 0 ? (
                      lecture.attendee_ids.map(id => {
                        const m = members.find(mem => mem.id === id)
                        if (!m) return null
                        return (
                          <Badge key={id} variant="secondary" className="bg-white border-accent/20 text-foreground py-1 px-2.5 gap-2 shadow-sm">
                            <Avatar className="h-4 w-4">
                              <AvatarFallback className="bg-accent text-[8px] text-accent-foreground">{m.initials}</AvatarFallback>
                            </Avatar>
                            {m.name}
                          </Badge>
                        )
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Nema evidentiranih prisutnih.</p>
                    )}
                  </div>
                </div>

                <div className="mb-4 h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-accent transition-all shadow-sm" style={{ width: `${activeMembers.length ? (count / activeMembers.length) * 100 : 0}%` }} />
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input value={attendeeSearch} onChange={e => setAttendeeSearch(e.target.value)} placeholder="Pretraži za odabir..."
                      className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => canEdit && patch({ attendee_ids: activeMembers.map(m => m.id) })}
                        disabled={!canEdit}
                        className="text-[10px] font-bold uppercase tracking-wider text-accent">ODABERI SVE</Button>
                      <Button variant="ghost" size="sm" onClick={() => canEdit && patch({ attendee_ids: [] })}
                        disabled={!canEdit}
                        className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">PONIŠTI</Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 pt-2">
                {activeMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic text-center py-12">Nema aktivnih članova u sustavu.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    {Object.keys(grouped).sort().map(letter => (
                      <div key={letter} className="col-span-1 md:col-span-2">
                        <div className="sticky top-0 z-10 -mx-6 mb-2 bg-secondary/30 px-6 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground backdrop-blur-sm">{letter}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                          {grouped[letter].map(member => {
                            const present = (lecture.attendee_ids || []).includes(member.id)
                            return (
                              <button key={member.id} onClick={() => canEdit && toggleAttendee(member.id)}
                                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all ${present ? "border-accent bg-accent/10 shadow-sm" : "border-border/50 bg-background hover:border-accent/30 hover:bg-secondary/20"} ${!canEdit ? "cursor-default opacity-80" : "cursor-pointer"}`}>
                                <Avatar className="h-8 w-8 border border-border">
                                  <AvatarFallback className={`text-xs ${present ? "bg-accent text-accent-foreground" : "bg-muted"}`}>{member.initials}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="truncate text-xs font-semibold">{member.name}</p>
                                  <p className="truncate text-[10px] text-muted-foreground">{member.email}</p>
                                </div>
                                <div className={`flex h-4 w-4 items-center justify-center rounded-full border ${present ? "border-accent bg-accent text-white" : "border-muted-foreground/30"}`}>
                                  {present && <Check className="h-2.5 w-2.5" />}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "attachments" && (
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold">Priložene datoteke</p>
                {canEdit && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? "Uploading…" : <><Plus className="h-4 w-4" />Dodaj</>}
                  </Button>
                )}
                <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" multiple onChange={handleFileUpload} />
              </div>
              {attachCount === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12 text-center"
                  onClick={() => canEdit && fileRef.current?.click()}>
                  <Paperclip className="mb-3 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">{canEdit ? "Klikni za dodavanje datoteke" : "Nema priloženih datoteka"}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(lecture.attachments || []).filter(a => a.fileType === "image").length > 0 && (
                    <div className="mb-4 grid grid-cols-3 gap-2">
                      {(lecture.attachments || []).filter(a => a.fileType === "image").map(att => (
                        <div key={att.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary">
                          <img src={att.url} alt={att.name} className="h-full w-full object-cover cursor-pointer" onClick={() => setLightbox({ url: att.url, name: att.name })} />
                          <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                            <button onClick={() => setLightbox({ url: att.url, name: att.name })} className="rounded-full bg-white/90 p-1.5"><ZoomIn className="h-3.5 w-3.5" /></button>
                            {canEdit && <button onClick={() => patch({ attachments: (lecture.attachments || []).filter(a => a.id !== att.id) })} className="rounded-full bg-red-500 p-1.5 text-white"><Trash2 className="h-3.5 w-3.5" /></button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {(lecture.attachments || []).filter(a => a.fileType !== "image").map(att => (
                    <div key={att.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                      <File className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{att.name}</p>
                      </div>
                      <a href={att.url} download className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"><Download className="h-4 w-4" /></a>
                      {canEdit && <button onClick={() => patch({ attachments: (lecture.attachments || []).filter(a => a.id !== att.id) })} className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          {canEdit ? (
            <Button variant="outline" size="sm" className="gap-2 text-red-600 hover:bg-red-50" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" /> Obriši
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Zatvori</Button>
            {isDirty && (
              <Button size="sm" className="gap-2" onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4" />{isSaving ? "Spremanje…" : "Spremi"}
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <SendNotificationDialog 
        isOpen={showNotifyDialog} 
        onClose={() => setShowNotifyDialog(false)} 
        type="lecture" 
        item={{
          title: lecture.title,
          date: new Date(lecture.date).toLocaleDateString("hr-HR", { day: "2-digit", month: "2-digit", year: "numeric" }),
          time: lecture.start_time || '',
          location: lecture.location || '',
          host: typeof lecture.hosts === 'string' ? JSON.parse(lecture.hosts).join(', ') : (lecture.hosts?.map(h => h.name).join(', ') || lecture.host || '')
        }} 
      />
    </>
  )
}
