"use client"

import { useState, useRef, useEffect } from "react"
import {
  X, Calendar, Clock, MapPin, Users, FileText, Paperclip,
  Plus, Trash2, Check, Image, File, FileType2, Download,
  Printer, Save, Edit3, Search, ChevronRight, ZoomIn, BarChart3
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useMeetings, Meeting } from "@/contexts/meetings-context"
import { useMembers } from "@/contexts/members-context"
import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"
import { TimeInput24h } from "@/components/ui/time-input-24h"

import { generateId } from "@/lib/utils"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Zakazana", cls: "bg-blue-100 text-blue-700" },
  completed: { label: "Završena", cls: "bg-green-100 text-green-700" },
  cancelled: { label: "Otkazana", cls: "bg-red-100 text-red-700" },
}

function calcDuration(start?: string, end?: string): string {
  if (!start || !end) return ""
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) return ""
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ""}` : `${m}min`
}

function formatBytes(bytes?: number): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ fileType }: { fileType: string }) {
  if (fileType === "image") return <Image className="h-5 w-5 text-blue-500" />
  if (fileType === "pdf") return <FileType2 className="h-5 w-5 text-red-500" />
  return <File className="h-5 w-5 text-indigo-500" />
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <button
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </button>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 max-w-xs truncate text-sm text-white/70">
        {name}
      </div>
      <img
        src={url}
        alt={name}
        onClick={e => e.stopPropagation()}
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
      />
      <a
        href={url}
        download
        onClick={e => e.stopPropagation()}
        className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
      >
        <Download className="h-4 w-4" /> Preuzmi
      </a>
    </div>
  )
}

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = "details" | "attendance" | "attachments" | "polls"

interface MeetingDetailDialogProps {
  meeting: Meeting
  onClose: () => void
}

export function MeetingDetailDialog({ meeting: initialMeeting, onClose }: MeetingDetailDialogProps) {
  const { updateMeeting, deleteMeeting } = useMeetings()
  const { members } = useMembers()
  const { user } = useAuth()
  const { settings } = useSettings()

  const isAdmin = user?.role === "admin" || user?.role === "moderator"

  const [meeting, setMeeting] = useState<Meeting>(initialMeeting)
  const [activeTab, setActiveTab] = useState<Tab>("details")
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [newAgendaText, setNewAgendaText] = useState("")
  const [addingAgenda, setAddingAgenda] = useState(false)
  const [attendeeSearch, setAttendeeSearch] = useState("")
  const [lightboxImg, setLightboxImg] = useState<{ url: string; name: string } | null>(null)
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)
  const [meetingPolls, setMeetingPolls] = useState<any[]>([])
  const [meetingVotes, setMeetingVotes] = useState<Record<number, any[]>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMeeting(initialMeeting)
    setIsDirty(false)
  }, [initialMeeting])

  function patch(updates: Partial<Meeting>) {
    setMeeting(prev => ({ ...prev, ...updates }))
    setIsDirty(true)
  }

  async function handleSave() {
    setIsSaving(true)
    await updateMeeting(meeting.id, meeting)
    setIsSaving(false)
    setIsDirty(false)
  }

  async function handleDelete() {
    if (!confirm("Sigurno želiš obrisati ovu sjednicu?")) return
    await deleteMeeting(meeting.id)
    onClose()
  }

  useEffect(() => {
    if (activeTab === 'polls') {
      fetchMeetingPolls()
    }
  }, [activeTab, meeting.id])

  const fetchMeetingPolls = async () => {
    try {
      const response = await fetch(`/api/polls`)
      if (response.ok) {
        const allPolls = await response.json()
        const linked = allPolls.filter((p: any) => p.meeting_id === meeting.id)
        setMeetingPolls(linked)
        // Fetch votes for each linked poll
        linked.forEach((p: any) => fetchPollVotes(p.id))
      }
    } catch (error) {
      console.error("Failed to fetch meeting polls:", error)
    }
  }

  const fetchPollVotes = async (pollId: number) => {
    try {
      const response = await fetch(`/api/polls/vote?poll_id=${pollId}`)
      if (response.ok) {
        const votes = await response.json()
        setMeetingVotes(prev => ({ ...prev, [pollId]: votes }))
      }
    } catch (error) {
      console.error("Failed to fetch poll votes:", error)
    }
  }

  // ─── Attendance ───────────────────────────────────────────────────────────

  function toggleAttendee(memberId: number) {
    const current = meeting.attendee_ids || []
    const next = current.includes(memberId)
      ? current.filter(id => id !== memberId)
      : [...current, memberId]
    patch({ attendee_ids: next })
  }

  const activeMembers = members.filter(
    m => m.status === "active" || m.status === "pending" || (meeting.attendee_ids || []).includes(m.id)
  )

  const filteredMembers = attendeeSearch.trim()
    ? activeMembers.filter(m =>
        m.name.toLowerCase().includes(attendeeSearch.toLowerCase()) ||
        m.email.toLowerCase().includes(attendeeSearch.toLowerCase())
      )
    : activeMembers

  // Group by first letter of surname
  const groupedMembers = filteredMembers.reduce<Record<string, typeof filteredMembers>>((acc, m) => {
    const parts = m.name.trim().split(/\s+/)
    const letter = (parts[parts.length - 1]?.[0] ?? m.name[0] ?? "?").toUpperCase()
    acc[letter] = acc[letter] ?? []
    acc[letter].push(m)
    return acc
  }, {})
  const sortedLetters = Object.keys(groupedMembers).sort()

  // ─── Attachments ──────────────────────────────────────────────────────────

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/meetings/upload", { method: "POST", body: form })
      if (res.ok) {
        const { url, name, fileType, size } = await res.json()
        patch({ attachments: [...(meeting.attachments || []), { id: generateId(), name, url, fileType, size }] })
      } else {
        const err = await res.json()
        alert(err.error || "Greška pri uploadu")
      }
    } catch { alert("Greška pri uploadu datoteke.") }
    finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function removeAttachment(id: string) {
    patch({ attachments: meeting.attachments.filter(a => a.id !== id) })
  }

  // ─── Agenda ───────────────────────────────────────────────────────────────

  function handleAddAgendaItem() {
    if (!newAgendaText.trim()) return
    const item = { id: generateId(), text: newAgendaText.trim(), done: false }
    patch({ agenda: [...(meeting.agenda || []), item] })
    setNewAgendaText("")
    setAddingAgenda(false)
  }

  function toggleAgendaDone(id: string) {
    patch({
      agenda: meeting.agenda.map(item =>
        item.id === id ? { ...item, done: !item.done } : item
      )
    })
  }

  function removeAgendaItem(id: string) {
    patch({ agenda: meeting.agenda.filter(item => item.id !== id) })
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  const attendeeCount = (meeting.attendee_ids || []).length
  const statusMeta = STATUS_LABELS[meeting.status] || STATUS_LABELS.scheduled
  const duration = calcDuration(meeting.start_time, meeting.end_time)

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "details", label: "Detalji i zapisnik", icon: FileText },
    { id: "attendance", label: `Prisutnost (${attendeeCount})`, icon: Users },
    { id: "attachments", label: `Prilozi (${(meeting.attachments || []).length})`, icon: Paperclip },
    { id: "polls", label: "Glasanja", icon: BarChart3 },
  ]

  return (
    <>
      {lightboxImg && <Lightbox url={lightboxImg.url} name={lightboxImg.name} onClose={() => setLightboxImg(null)} />}

      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-background shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div className="flex-1 pr-4">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-accent bg-accent/10 text-accent text-xs">
                {meeting.type}
              </Badge>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusMeta.cls}`}>
                {statusMeta.label}
              </span>
            </div>
            <h2 className="font-serif text-2xl font-bold leading-tight">{meeting.title}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(meeting.date).toLocaleDateString("hr-HR", { day: "2-digit", month: "long", year: "numeric" })}
              </span>
              {meeting.start_time && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {meeting.start_time}{meeting.end_time && `–${meeting.end_time}`}
                  {duration && <span className="text-muted-foreground/60 ml-1">({duration})</span>}
                </span>
              )}
              {meeting.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {meeting.location}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary" title="Ispis">
              <Printer className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-3 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-accent text-accent"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Tab: Detalji ───────────────────────────────────────────────── */}
          {activeTab === "details" && (
            <div className="space-y-6 p-6">
              {meeting.youtube_url && (
                <div className="rounded-xl border border-red-100 bg-red-50/40 p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.107C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.388.511a3.002 3.002 0 0 0-2.11 2.107C0 8.053 0 12 0 12s0 3.947.502 5.837a3.003 3.003 0 0 0 2.11 2.107C4.495 20.455 12 20.455 12 20.455s7.505 0 9.388-.511a3.002 3.002 0 0 0 2.11-2.107C24 15.947 24 12 24 12s0-3.947-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Video snimka sjednice</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">Snimka sastanka je dostupna na YouTubeu</p>
                    </div>
                  </div>
                  <a
                    href={meeting.youtube_url}
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
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Naslov</label>
                    <input value={meeting.title} onChange={e => patch({ title: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Vrsta</label>
                    <select value={meeting.type} onChange={e => patch({ type: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent">
                      {settings.meetingTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Datum</label>
                    <input type="date" value={meeting.date} onChange={e => patch({ date: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                  </div>
                  <div className="relative">
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Lokacija</label>
                    <input value={meeting.location ?? ""} onChange={e => patch({ location: e.target.value })}
                      onFocus={() => settings.meetingLocations.length > 0 && setShowLocationDropdown(true)}
                      onBlur={() => setTimeout(() => setShowLocationDropdown(false), 150)}
                      placeholder="Upišite ili odaberite..."
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                    {showLocationDropdown && settings.meetingLocations.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-background shadow-lg">
                        {settings.meetingLocations.map(loc => (
                          <button key={loc} type="button" onMouseDown={() => { patch({ location: loc }); setShowLocationDropdown(false) }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />{loc}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Početak</label>
                    <TimeInput24h 
                      value={meeting.start_time ?? ""} 
                      onChange={v => patch({ start_time: v })} 
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Završetak</label>
                    <TimeInput24h 
                      value={meeting.end_time ?? ""} 
                      onChange={v => patch({ end_time: v })} 
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</label>
                    <select value={meeting.status} onChange={e => patch({ status: e.target.value as Meeting["status"] })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent">
                      <option value="scheduled">Zakazana</option>
                      <option value="completed">Završena</option>
                      <option value="cancelled">Otkazana</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Voditelj sastanka</label>
                    <input list="members-list-detail" value={meeting.chairperson ?? ""} onChange={e => patch({ chairperson: e.target.value })}
                      placeholder="Odaberi ili upiši..."
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Zapisničar</label>
                    <input list="members-list-detail" value={meeting.minute_taker ?? ""} onChange={e => patch({ minute_taker: e.target.value })}
                      placeholder="Odaberi ili upiši..."
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">YouTube Link (Snimka sjednice)</label>
                    <input value={meeting.youtube_url ?? ""} onChange={e => patch({ youtube_url: e.target.value })}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                  </div>
                  <datalist id="members-list-detail">
                    {members.map(m => (
                      <option key={m.id} value={m.name} />
                    ))}
                  </datalist>
                </div>
              )}

              {!isAdmin && (meeting.chairperson || meeting.minute_taker) && (
                <div className="grid grid-cols-2 gap-4 rounded-lg bg-secondary/30 p-4">
                  {meeting.chairperson && (
                    <div>
                      <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Voditelj sastanka</label>
                      <p className="text-sm font-medium">{meeting.chairperson}</p>
                    </div>
                  )}
                  {meeting.minute_taker && (
                    <div>
                      <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Zapisničar</label>
                      <p className="text-sm font-medium">{meeting.minute_taker}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Agenda */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Dnevni red
                  </label>
                  {isAdmin && (
                    <button onClick={() => setAddingAgenda(true)}
                      className="flex items-center gap-1 text-xs text-accent hover:underline">
                      <Plus className="h-3 w-3" /> Dodaj stavku
                    </button>
                  )}
                </div>

                {addingAgenda && (
                  <div className="mb-2 flex gap-2">
                    <input autoFocus value={newAgendaText} onChange={e => setNewAgendaText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleAddAgendaItem(); if (e.key === "Escape") { setAddingAgenda(false); setNewAgendaText("") } }}
                      placeholder="Unesi stavku dnevnog reda..."
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                    <Button size="sm" onClick={handleAddAgendaItem} disabled={!newAgendaText.trim()}>Dodaj</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setAddingAgenda(false); setNewAgendaText("") }}>✕</Button>
                  </div>
                )}

                {(meeting.agenda || []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border py-6 text-center">
                    <p className="text-sm text-muted-foreground italic">Dnevni red nije definiran.</p>
                  </div>
                ) : (
                  <ol className="space-y-1.5">
                    {meeting.agenda.map((item, idx) => (
                      <li key={item.id} className={`flex items-start gap-2 rounded-lg px-3 py-2 ${item.done ? "opacity-50" : "bg-secondary/30"}`}>
                        {isAdmin ? (
                          <button onClick={() => toggleAgendaDone(item.id)}
                            className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${item.done ? "border-accent bg-accent" : "border-muted-foreground/40"}`}>
                            {item.done && <Check className="h-2.5 w-2.5 text-accent-foreground" />}
                          </button>
                        ) : (
                          <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent mt-1.5" />
                        )}
                        <span className={`flex-1 text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>
                          <span className="mr-1.5 text-xs font-medium text-muted-foreground">{idx + 1}.</span>
                          {item.text}
                        </span>
                        {isAdmin && (
                          <button onClick={() => removeAgendaItem(item.id)}
                            className="flex-shrink-0 rounded p-0.5 text-muted-foreground hover:text-red-600">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* Minutes */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Zapisnik</label>
                </div>
                {isAdmin ? (
                  <textarea value={meeting.minutes ?? ""} onChange={e => patch({ minutes: e.target.value })}
                    rows={10} placeholder="Upiši tekst zapisnika ovdje..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent resize-none" />
                ) : (
                  <div className="min-h-[120px] rounded-lg border border-border bg-secondary/30 p-4 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {meeting.minutes || <span className="italic">Bez zapisnika.</span>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tab: Prisutnost ────────────────────────────────────────────── */}
          {activeTab === "attendance" && (
            <div className="flex flex-col h-full bg-secondary/5">
              {/* Top Summary Bar */}
              <div className="border-b border-border bg-background p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Popis prisutnih</h3>
                    <p className="text-xs text-muted-foreground">
                      {attendeeCount} od {activeMembers.length} članova je prisutno
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-700 shadow-sm border border-green-200">
                      {attendeeCount} PRISUTNO
                    </span>
                  </div>
                </div>

                {/* VISIBLE LIST OF PRESENT MEMBERS - AS REQUESTED */}
                <div className="mb-6 rounded-xl border border-accent/20 bg-accent/5 p-4">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-accent">Brzi pregled prisutnih:</p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                    {meeting.attendee_ids && meeting.attendee_ids.length > 0 ? (
                      meeting.attendee_ids.map(id => {
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

                {/* Progress bar */}
                <div className="mb-4 h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-accent shadow-sm transition-all"
                    style={{ width: `${activeMembers.length ? (attendeeCount / activeMembers.length) * 100 : 0}%` }} />
                </div>

                {/* Search & Bulk */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input value={attendeeSearch} onChange={e => setAttendeeSearch(e.target.value)}
                      placeholder="Pretraži listu za odabir..."
                      className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => patch({ attendee_ids: activeMembers.map(m => m.id) })} className="text-[10px] font-bold uppercase tracking-wider text-accent">
                        ODABERI SVE
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => patch({ attendee_ids: [] })} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        PONIŠTI
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Grouped member list */}
              <div className="flex-1 overflow-y-auto p-6 pt-2">
                {activeMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic text-center py-12">Nema aktivnih članova u sustavu.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    {sortedLetters.map(letter => (
                      <div key={letter} className="col-span-1 md:col-span-2">
                        <div className="sticky top-0 z-10 -mx-6 mb-2 bg-secondary/30 px-6 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground backdrop-blur-sm">
                          {letter}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                          {groupedMembers[letter].map(member => {
                            const present = (meeting.attendee_ids || []).includes(member.id)
                            return (
                              <button key={member.id} onClick={() => isAdmin && toggleAttendee(member.id)}
                                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all ${
                                  present ? "border-accent bg-accent/10 shadow-sm" : "border-border/50 bg-background hover:border-accent/30 hover:bg-secondary/20"
                                } ${!isAdmin ? "cursor-default" : "cursor-pointer"}`}>
                                <Avatar className="h-8 w-8 flex-shrink-0 border border-border">
                                  <AvatarFallback className={`text-xs ${present ? "bg-accent text-accent-foreground" : "bg-muted"}`}>
                                    {member.initials}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="truncate text-xs font-semibold">{member.name}</p>
                                  <p className="truncate text-[10px] text-muted-foreground">{member.email}</p>
                                </div>
                                <div className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
                                  present ? "border-accent bg-accent text-white" : "border-muted-foreground/30"
                                }`}>
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

          {/* ── Tab: Prilozi ───────────────────────────────────────────────── */}
          {activeTab === "attachments" && (
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Priložene datoteke</p>
                  <p className="text-xs text-muted-foreground">Slike, PDF i Word dokumenti</p>
                </div>
                {isAdmin && (
                  <Button variant="outline" size="sm" className="gap-2"
                    onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}>
                    {uploadingFile ? <span className="animate-pulse">Uploading…</span> : <><Plus className="h-4 w-4" /> Dodaj datoteku</>}
                  </Button>
                )}
                <input ref={fileInputRef} type="file" className="hidden"
                  accept="image/*,.pdf,.doc,.docx" onChange={handleFileUpload} />
              </div>

              {(meeting.attachments || []).length === 0 ? (
                <div className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12 text-center hover:border-accent transition-colors"
                  onClick={() => isAdmin && fileInputRef.current?.click()}>
                  <Paperclip className="mb-3 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    {isAdmin ? "Klikni ili povuci datoteku ovdje" : "Još nema priloženih datoteka"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/60">Slike, PDF, Word • maks. 20 MB</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Image grid */}
                  {meeting.attachments.some(a => a.fileType === "image") && (
                    <div className="mb-4 grid grid-cols-3 gap-2">
                      {meeting.attachments.filter(a => a.fileType === "image").map(att => (
                        <div key={att.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary">
                          <img src={att.url} alt={att.name}
                            className="h-full w-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                            onClick={() => setLightboxImg({ url: att.url, name: att.name })} />
                          <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                            <button onClick={() => setLightboxImg({ url: att.url, name: att.name })}
                              className="rounded-full bg-white/90 p-1.5">
                              <ZoomIn className="h-3.5 w-3.5" />
                            </button>
                            {isAdmin && (
                              <button onClick={() => removeAttachment(att.id)}
                                className="rounded-full bg-red-500 p-1.5 text-white">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="absolute bottom-0 inset-x-0 truncate bg-black/60 px-2 py-1 text-[10px] text-white opacity-0 group-hover:opacity-100">
                            {att.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Document list */}
                  {meeting.attachments.filter(a => a.fileType !== "image").map(att => (
                    <div key={att.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                      <FileIcon fileType={att.fileType} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{att.name}</p>
                        {att.size && <p className="text-xs text-muted-foreground">{formatBytes(att.size)}</p>}
                      </div>
                      <a href={att.url} target="_blank" rel="noopener noreferrer" download
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Preuzmi">
                        <Download className="h-4 w-4" />
                      </a>
                      {isAdmin && (
                        <button onClick={() => removeAttachment(att.id)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Glasanja ─────────────────────────────────────────────── */}
          {activeTab === "polls" && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-lg font-bold">Rezultati glasanja</h3>
                  <p className="text-xs text-muted-foreground">Prikaz provedenih anketa povezanih uz ovu sjednicu</p>
                </div>
              </div>

              {meetingPolls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl">
                  <BarChart3 className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground italic">Nema glasanja povezanih uz ovu sjednicu.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {meetingPolls.map(poll => (
                    <div key={poll.id} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold underline underline-offset-4 decoration-accent/30">{poll.title}</h4>
                        <Badge variant="outline">{poll.status === 'active' ? 'Aktivno' : 'Arhivirano'}</Badge>
                      </div>
                      
                      <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
                        <div className="space-y-4">
                          {poll.options.map((option: string, idx: number) => {
                            const votes = meetingVotes[poll.id] || []
                            const count = votes.filter(v => v.option_index === idx).length
                            const total = votes.length
                            const percent = total > 0 ? (count / total) * 100 : 0
                            return (
                              <div key={idx} className="space-y-1.5">
                                <div className="flex justify-between text-sm">
                                  <span>{option}</span>
                                  <span className="font-bold">{count} ({percent.toFixed(0)}%)</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                                  <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <div className="rounded-lg bg-secondary/30 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                            <Users className="h-3 w-3" /> Tko je glasao
                          </p>
                          <div className="max-h-40 overflow-auto space-y-1">
                            {(meetingVotes[poll.id] || []).map(v => (
                              <div key={v.id} className="flex justify-between text-xs py-1 border-b border-white/50">
                                <span className="font-medium">{v.member_name}</span>
                                <span className="text-muted-foreground italic">{poll.options[v.option_index]}</span>
                              </div>
                            ))}
                            {(meetingVotes[poll.id] || []).length === 0 && (
                              <p className="text-xs text-muted-foreground italic">Nema glasova.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          {isAdmin ? (
            <Button variant="outline" size="sm"
              className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
              onClick={handleDelete}>
              <Trash2 className="h-4 w-4" /> Obriši sjednicu
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Zatvori</Button>
            {isDirty && (
              <Button size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4" />
                {isSaving ? "Spremanje…" : "Spremi promjene"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
