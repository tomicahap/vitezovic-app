"use client"

import { useState, useMemo, useRef } from "react"
import {
  Search, Plus, FolderKanban, X, ChevronLeft, ChevronRight, Loader2,
  CheckCircle, Clock, AlertCircle, Trash2, Save, Users, Calendar,
  Target, Paperclip, Check, Edit3, MoreHorizontal, ZoomIn, Download, Upload, File,
  FileText, StickyNote, History, PlusCircle, ExternalLink, Mail, UserPlus,
  ArrowUpDown, ChevronUp, ChevronDown, Image as ImageIcon
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useProjects, Project, ProjectGoal } from "@/contexts/projects-context"
import { useAuth } from "@/contexts/auth-context"
import { useMembers } from "@/contexts/members-context"
import { useSettings } from "@/contexts/settings-context"
import { generateId } from "@/lib/utils"
import { ProjectContributor } from "@/contexts/projects-context"
import { Linkify } from "./linkify"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; icon: any; cls: string }> = {
  active:    { label: "Aktivno",   icon: CheckCircle, cls: "bg-green-50 text-green-700 border-green-200" },
  paused:    { label: "Pauzirano", icon: Clock,       cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  completed: { label: "Završeno",  icon: CheckCircle, cls: "bg-blue-50 text-blue-700 border-blue-200" },
  cancelled: { label: "Otkazano",  icon: AlertCircle, cls: "bg-red-50 text-red-700 border-red-200" },
}

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  high:   { label: "Visok",   cls: "bg-red-100 text-red-700 border-red-200" },
  medium: { label: "Srednji", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  low:    { label: "Nizak",   cls: "bg-green-100 text-green-700 border-green-200" },
}

const PAGE_SIZE = 8

// ─── Project Detail Panel ─────────────────────────────────────────────────────

function ProjectDetailPanel({ project: initial, onClose }: { project: Project; onClose: () => void }) {
  const { updateProject, deleteProject } = useProjects()
  const { members } = useMembers()
  const { user } = useAuth()
  const canEdit = user?.role === "admin" || user?.role === "moderator" || user?.accessRights?.projects?.edit === true
  const fileRef = useRef<HTMLInputElement>(null)

  const [project, setProject] = useState<Project>(initial)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [tab, setTab] = useState<"info" | "goals" | "team" | "attachments" | "records" | "contributors">("info")
  const [newGoal, setNewGoal] = useState("")
  const [teamSearch, setTeamSearch] = useState("")
  const [uploading, setUploading] = useState(false)
  const [showAddRecord, setShowAddRecord] = useState(false)
  const [showAddContributor, setShowAddContributor] = useState(false)
  const [newContributorData, setNewContributorData] = useState<Record<string, any>>({})
  const [contributorSort, setContributorSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: '', dir: 'asc' })
  const [contributorSearch, setContributorSearch] = useState("")
  const { settings } = useSettings()

  const activeTemplate = settings.projectContributorTemplates.find(t => t.id === project.contributor_template_id)

  function patch(u: Partial<Project>) { setProject(p => ({ ...p, ...u })); setIsDirty(true) }

  async function handleSave() {
    setIsSaving(true)
    await updateProject(project.id, project)
    setIsSaving(false)
    setIsDirty(false)
  }

  async function handleDelete() {
    if (!confirm("Obriši ovaj projekt?")) return
    await deleteProject(project.id)
    onClose()
  }

  function addGoal() {
    if (!newGoal.trim()) return
    const goal: ProjectGoal = { id: generateId(), text: newGoal.trim(), done: false }
    patch({ goals: [...project.goals, goal] })
    setNewGoal("")
  }

  function toggleGoal(id: string) {
    patch({ goals: project.goals.map(g => g.id === id ? { ...g, done: !g.done } : g) })
  }
  function removeGoal(id: string) { patch({ goals: project.goals.filter(g => g.id !== id) }) }

  function toggleMember(memberId: number) {
    const ids = project.member_ids || []
    patch({ member_ids: ids.includes(memberId) ? ids.filter(x => x !== memberId) : [...ids, memberId] })
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData(); form.append("file", file)
      const res = await fetch("/api/meetings/upload", { method: "POST", body: form })
      if (res.ok) {
        const { url, name, fileType } = await res.json()
        patch({ attachments: [...(project.attachments || []), { id: generateId(), name, url, fileType }] })
      }
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = "" }
  }

  const doneGoals = project.goals.filter(g => g.done).length
  const totalGoals = project.goals.length
  const goalProgress = totalGoals > 0 ? Math.round((doneGoals / totalGoals) * 100) : project.progress
  const filteredMembers = useMemo(() => {
    const list = teamSearch
      ? members.filter(m => m.name.toLowerCase().includes(teamSearch.toLowerCase()))
      : members.filter(m => m.status === "active" || (project.member_ids || []).includes(m.id))
    
    // Sort selected members to the top
    return [...list].sort((a, b) => {
      const aIn = (project.member_ids || []).includes(a.id)
      const bIn = (project.member_ids || []).includes(b.id)
      if (aIn && !bIn) return -1
      if (!aIn && bIn) return 1
      return 0
    })
  }, [members, teamSearch, project.member_ids])

  const statusMeta = STATUS_META[project.status] || STATUS_META.active
  const StatusIcon = statusMeta.icon

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-5xl flex-col bg-background shadow-2xl">
        {/* Header */}
        <div className="border-b border-border px-6 py-5">
          <div className="mb-2 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusMeta.cls}`}>
              <StatusIcon className="h-3 w-3" />{statusMeta.label}
            </span>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${PRIORITY_META[project.priority]?.cls}`}>
              {PRIORITY_META[project.priority]?.label} prioritet
            </span>
          </div>
          {canEdit ? (
            <input value={project.title} onChange={e => patch({ title: e.target.value })}
              className="w-full bg-transparent font-serif text-2xl font-bold focus:outline-none" />
          ) : (
            <h2 className="font-serif text-2xl font-bold">{project.title}</h2>
          )}
          {/* Progress bar */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Napredak</span>
              <span className="font-medium">{goalProgress}%</span>
            </div>
            <Progress value={goalProgress} className="h-2" />
          </div>
          <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          {[
            { id: "info", label: "Informacije" },
            { id: "goals", label: `Ciljevi (${doneGoals}/${totalGoals})` },
            { id: "team", label: `Tim (${(project.member_ids || []).length})` },
            { id: "contributors", label: `Doprinositelji (${(project.contributors || []).length})` },
            { id: "records", label: `Zapisnici (${(project.records || []).length})` },
            { id: "attachments", label: `Prilozi (${(project.attachments || []).length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`border-b-2 px-3 py-3 text-xs font-medium transition-colors ${tab === t.id ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "info" && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Opis projekta</label>
                {canEdit ? (
                  <textarea value={project.description ?? ""} onChange={e => patch({ description: e.target.value })}
                    rows={4} className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {project.description ? <Linkify text={project.description} /> : "Bez opisa."}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</label>
                  {canEdit ? (
                    <select value={project.status} onChange={e => patch({ status: e.target.value as Project["status"] })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent">
                      <option value="active">Aktivno</option>
                      <option value="paused">Pauzirano</option>
                      <option value="completed">Završeno</option>
                      <option value="cancelled">Otkazano</option>
                    </select>
                  ) : <p className="text-sm">{statusMeta.label}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Prioritet</label>
                  {canEdit ? (
                    <select value={project.priority} onChange={e => patch({ priority: e.target.value as Project["priority"] })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent">
                      <option value="high">Visok</option>
                      <option value="medium">Srednji</option>
                      <option value="low">Nizak</option>
                    </select>
                  ) : <p className="text-sm">{PRIORITY_META[project.priority]?.label}</p>}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Link na projekt (prikazuje se na prvoj stranici)</label>
                {canEdit ? (
                  <div className="relative">
                    <input value={project.project_url ?? ""} onChange={e => patch({ project_url: e.target.value })}
                      placeholder="https://www.rodoslovlje.hr/projekti/..."
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                    <ExternalLink className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-50" />
                  </div>
                ) : project.project_url ? (
                  <a href={project.project_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                    {project.project_url} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">Nema postavljenog linka.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Datum početka</label>
                  {canEdit ? (
                    <input type="date" value={project.start_date ?? ""} onChange={e => patch({ start_date: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                  ) : <p className="text-sm">{project.start_date ? new Date(project.start_date).toLocaleDateString("hr-HR") : "—"}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Rok završetka</label>
                  {canEdit ? (
                    <input type="date" value={project.end_date ?? ""} onChange={e => patch({ end_date: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                  ) : <p className="text-sm">{project.end_date ? new Date(project.end_date).toLocaleDateString("hr-HR") : "—"}</p>}
                </div>
                {canEdit && (
                  <div className="col-span-2">
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Ručno postavi napredak (%)</label>
                    <input type="number" min={0} max={100} value={project.progress} onChange={e => patch({ progress: parseInt(e.target.value) || 0 })}
                      className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Voditelj projekta</label>
                {canEdit ? (
                  <input value={project.lead_member_name ?? ""} onChange={e => patch({ lead_member_name: e.target.value })}
                    placeholder="Ime voditelja..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                ) : <p className="text-sm">{project.lead_member_name || "—"}</p>}
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Bilješke</label>
                {canEdit ? (
                  <textarea value={project.notes ?? ""} onChange={e => patch({ notes: e.target.value })} rows={4}
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {project.notes ? <Linkify text={project.notes} /> : "Nema bilješki."}
                  </p>
                )}
              </div>
              {canEdit && (
                <div className="pt-4 border-t border-border">
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Šablona doprinositelja</label>
                  <select 
                    value={project.contributor_template_id || ""} 
                    onChange={e => patch({ contributor_template_id: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="">Bez šablone (zadano)</option>
                    {settings.projectContributorTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-muted-foreground italic">Određuje koja polja će se prikazivati u popisu doprinositelja.</p>
                </div>
              )}
            </div>
          )}

          {tab === "goals" && (
            <div className="space-y-3">
              <div className="mb-4 flex items-center gap-3 text-sm">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${goalProgress}%` }} />
                </div>
                <span className="font-medium text-accent">{doneGoals}/{totalGoals}</span>
              </div>
              {project.goals.map(goal => (
                <div key={goal.id} className={`flex items-start gap-3 rounded-lg border p-3 transition-all ${goal.done ? "border-border/50 bg-secondary/20 opacity-70" : "border-border bg-card"}`}>
                  <button onClick={() => canEdit && toggleGoal(goal.id)}
                    className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${goal.done ? "border-accent bg-accent" : "border-muted-foreground/30"}`}>
                    {goal.done && <Check className="h-2.5 w-2.5 text-accent-foreground" />}
                  </button>
                  <p className={`flex-1 text-sm leading-relaxed ${goal.done ? "line-through text-muted-foreground" : ""}`}>{goal.text}</p>
                  {canEdit && <button onClick={() => removeGoal(goal.id)} className="text-muted-foreground/40 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>}
                </div>
              ))}
              {canEdit && (
                <div className="flex gap-2">
                  <input value={newGoal} onChange={e => setNewGoal(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addGoal()}
                    placeholder="Dodaj novi cilj / zadatak..."
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                  <Button size="sm" onClick={addGoal} disabled={!newGoal.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {tab === "team" && (
            <div className="space-y-3">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input value={teamSearch} onChange={e => setTeamSearch(e.target.value)} placeholder="Pretraži članove..."
                  className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
              </div>
              {filteredMembers.map(m => {
                const isIn = (project.member_ids || []).includes(m.id)
                return (
                  <button key={m.id} onClick={() => canEdit && toggleMember(m.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${isIn ? "border-accent/40 bg-accent/5" : "border-border hover:bg-secondary/30"} ${!canEdit ? "cursor-default" : ""}`}>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={`text-xs ${isIn ? "bg-accent text-accent-foreground" : "bg-secondary"}`}>{m.initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0"><p className="truncate text-sm font-medium">{m.name}</p></div>
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${isIn ? "border-accent bg-accent" : "border-muted-foreground/30"}`}>
                      {isIn && <Check className="h-2.5 w-2.5 text-accent-foreground" />}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {tab === "records" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Zapisnici i evidencije</h3>
                  <p className="text-xs text-muted-foreground">Povijest sastanaka, terenskih nalaza i bilješki.</p>
                </div>
                {canEdit && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowAddRecord(!showAddRecord)}>
                    {showAddRecord ? <X className="h-4 w-4" /> : <><PlusCircle className="h-4 w-4" />Novi zapis</>}
                  </Button>
                )}
              </div>

              {showAddRecord && (
                <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                       <label className="text-[10px] font-medium uppercase text-muted-foreground mb-1 block">Naslov zapisa</label>
                       <Input value={newRecord.title} onChange={e => setNewRecord(r => ({ ...r, title: e.target.value }))} placeholder="npr. Sastanak o izvorima..." className="bg-background" />
                    </div>
                    <div>
                       <label className="text-[10px] font-medium uppercase text-muted-foreground mb-1 block">Datum</label>
                       <Input type="date" value={newRecord.date} onChange={e => setNewRecord(r => ({ ...r, date: e.target.value }))} className="bg-background" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium uppercase text-muted-foreground mb-1 block">Sadržaj / Zapisnik</label>
                    <textarea value={newRecord.content} onChange={e => setNewRecord(r => ({ ...r, content: e.target.value }))} rows={4}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowAddRecord(false)}>Odustani</Button>
                    <Button size="sm" onClick={() => {
                       if (!newRecord.title || !newRecord.content) return
                       patch({ records: [...(project.records || []), { ...newRecord, id: generateId() }] })
                       setNewRecord({ title: "", content: "", date: new Date().toISOString().split("T")[0] })
                       setShowAddRecord(false)
                    }}>Spremi zapis</Button>
                  </div>
                </div>
              )}

              {(project.records || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12 text-center">
                  <History className="mb-3 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Nema unesenih zapisnika.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {[...(project.records || [])].sort((a,b) => b.date.localeCompare(a.date)).map(record => (
                    <div key={record.id} className="relative rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-accent" />
                          <span className="text-xs font-semibold text-muted-foreground">{new Date(record.date).toLocaleDateString("hr-HR")}</span>
                        </div>
                        {canEdit && (
                          <button onClick={() => patch({ records: project.records?.filter(r => r.id !== record.id) })}
                            className="text-muted-foreground/30 hover:text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <h4 className="font-bold mb-1">{record.title}</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{record.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "contributors" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Doprinositelji projekta</h3>
                  <p className="text-xs text-muted-foreground">
                    {activeTemplate ? `Struktura: ${activeTemplate.name}` : "Osobe koje su sudjelovale u projektu."}
                  </p>
                </div>
                <div className="flex-1 max-w-xs ml-4">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                      placeholder="Pretraži..." 
                      className="pl-8 h-8 text-xs bg-background"
                      value={contributorSearch}
                      onChange={e => setContributorSearch(e.target.value)}
                    />
                  </div>
                </div>
                {canEdit && (
                  <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => setShowAddContributor(!showAddContributor)}>
                    {showAddContributor ? <X className="h-4 w-4" /> : <><UserPlus className="h-4 w-4" />Dodaj osobu</>}
                  </Button>
                )}
              </div>

              {showAddContributor && (
                <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-2 gap-3">
                    {activeTemplate ? (
                      activeTemplate.fields.sort((a, b) => a.order - b.order).map(f => (
                        <div key={f.id} className={f.type === 'text' ? "col-span-2" : "col-span-1"}>
                           <label className="text-[10px] font-medium uppercase text-muted-foreground mb-1 block">{f.name}</label>
                           <Input 
                             type={f.type === 'url' ? 'text' : f.type}
                             value={newContributorData[f.id] || ""} 
                             onChange={e => setNewContributorData(prev => ({ ...prev, [f.id]: e.target.value }))} 
                             placeholder={`Unesite ${f.name.toLowerCase()}...`}
                             className="bg-background" 
                           />
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 text-sm text-muted-foreground text-center py-4 bg-background rounded border border-dashed">
                        Molimo prvo odaberite šablonu u tabu "Informacije".
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowAddContributor(false)}>Odustani</Button>
                    <Button size="sm" disabled={!activeTemplate} onClick={() => {
                       patch({ contributors: [...(project.contributors || []), { id: generateId(), data: newContributorData }] })
                       setNewContributorData({})
                       setShowAddContributor(false)
                    }}>Dodaj na popis</Button>
                  </div>
                </div>
              )}

              {(project.contributors || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12 text-center">
                  <Users className="mb-3 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Nema unesenih doprinositelja.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full text-left text-sm border-collapse min-w-[600px]">
                    <thead className="bg-muted/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        {activeTemplate ? (
                          activeTemplate.fields.sort((a, b) => a.order - b.order).map(f => (
                            <th key={f.id} className="px-4 py-3 cursor-pointer hover:bg-muted transition-colors" 
                                onClick={() => setContributorSort(s => ({ key: f.id, dir: s.key === f.id && s.dir === 'asc' ? 'desc' : 'asc' }))}>
                              <div className="flex items-center gap-1">
                                {f.name}
                                {contributorSort.key === f.id ? (
                                  contributorSort.dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                              </div>
                            </th>
                          ))
                        ) : (
                          <th className="px-4 py-3">Podaci (Nema šablone)</th>
                        )}
                        {canEdit && <th className="px-4 py-3 text-right">Akcije</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[...(project.contributors || [])]
                        .filter(c => {
                          if (!contributorSearch) return true
                          return Object.values(c.data || {}).some(val => 
                            String(val).toLowerCase().includes(contributorSearch.toLowerCase())
                          )
                        })
                        .sort((a, b) => {
                          if (!contributorSort.key) return 0
                          const valA = String(a.data?.[contributorSort.key] || "").toLowerCase()
                          const valB = String(b.data?.[contributorSort.key] || "").toLowerCase()
                          return contributorSort.dir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
                        }).map(contributor => (
                        <tr key={contributor.id} className="hover:bg-muted/30 transition-colors">
                          {activeTemplate ? (
                            activeTemplate.fields.map(f => (
                              <td key={f.id} className="px-4 py-3">
                                {f.type === 'url' && contributor.data?.[f.id] ? (
                                  <a href={contributor.data[f.id]} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center gap-1">
                                    {contributor.data[f.id].replace(/^https?:\/\//, '')} <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : f.type === 'email' && contributor.data?.[f.id] ? (
                                  <a href={`mailto:${contributor.data[f.id]}`} className="text-accent hover:underline flex items-center gap-1">
                                    {contributor.data[f.id]} <Mail className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <span className="font-medium">{contributor.data?.[f.id] || "—"}</span>
                                )}
                              </td>
                            ))
                          ) : (
                            <td className="px-4 py-3 text-muted-foreground italic">Podaci su skriveni jer šablona nije odabrana.</td>
                          )}
                          {canEdit && (
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => patch({ contributors: project.contributors?.filter(c => c.id !== contributor.id) })}
                                className="text-muted-foreground/30 hover:text-red-500 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "attachments" && (
            <div className="space-y-3">
              {canEdit && (
                <div className="mb-4 flex justify-end">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? "Uploading…" : <><Upload className="h-4 w-4" />Dodaj prilog</>}
                  </Button>
                  <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={handleFileUpload} />
                </div>
              )}
              {(project.attachments || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12 text-center">
                  <Paperclip className="mb-3 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Nema priloženih datoteka</p>
                </div>
              ) : project.attachments.map(att => (
                <div key={att.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                  <File className="h-5 w-5 text-muted-foreground" />
                  <p className="flex-1 min-w-0 truncate text-sm font-medium">{att.name}</p>
                  <a href={att.url} download className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"><Download className="h-4 w-4" /></a>
                  {canEdit && <button onClick={() => patch({ attachments: project.attachments.filter(a => a.id !== att.id) })} className="rounded-lg p-1.5 text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                </div>
              ))}
            </div>
          )}
        </div>

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
    </>
  )
}

// ─── Add Dialog ───────────────────────────────────────────────────────────────

function AddProjectDialog({ onClose }: { onClose: () => void }) {
  const { addProject } = useProjects()
  const { user } = useAuth()
  const [form, setForm] = useState({ title: "", description: "", status: "active" as Project["status"], priority: "medium" as Project["priority"], start_date: new Date().toISOString().split("T")[0], end_date: "", project_url: "" })
  const [submitting, setSubmitting] = useState(false)
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div><h2 className="font-serif text-xl font-bold">Novi projekt</h2><p className="text-sm text-muted-foreground">Dodaj novo istraživanje ili projekt</p></div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Naziv projekta *</label>
            <input autoFocus value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="npr. Istraživanje roda Horvat..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Opis</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Link na projekt</label>
            <div className="relative">
              <input value={form.project_url} onChange={e => setForm(p => ({ ...p, project_url: e.target.value }))}
                placeholder="https://..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
              <ExternalLink className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                <option value="active">Aktivno</option>
                <option value="paused">Pauzirano</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Prioritet</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as any }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                <option value="high">Visok</option>
                <option value="medium">Srednji</option>
                <option value="low">Nizak</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Datum početka</label>
              <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Rok završetka</label>
              <input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>Odustani</Button>
            <Button className="gap-2 bg-primary text-primary-foreground" disabled={submitting || !form.title.trim()} onClick={async () => {
              setSubmitting(true)
              await addProject({ title: form.title.trim(), description: form.description || undefined, status: form.status, priority: form.priority, progress: 0, start_date: form.start_date || undefined, end_date: form.end_date || undefined, project_url: form.project_url || undefined, member_ids: [], goals: [], attachments: [], records: [], created_by: user?.name })
              setSubmitting(false); onClose()
            }}>
              <Plus className="h-4 w-4" />{submitting ? "Spremanje…" : "Dodaj projekt"}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ProjectsContent() {
  const { projects, isLoading } = useProjects()
  const { user } = useAuth()
  const canEdit = user?.role === "admin" || user?.role === "moderator" || user?.accessRights?.projects?.edit === true

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Project | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const filtered = useMemo(() => projects.filter(p => {
    const s = !search || p.title.toLowerCase().includes(search.toLowerCase()) || (p.description ?? "").toLowerCase().includes(search.toLowerCase())
    const st = statusFilter === "all" || p.status === statusFilter
    const pr = priorityFilter === "all" || p.priority === priorityFilter
    return s && st && pr
  }), [projects, search, statusFilter, priorityFilter])

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === "active").length,
    completed: projects.filter(p => p.status === "completed").length,
    members: new Set(projects.flatMap(p => p.member_ids)).size,
  }

  const liveProject = selected ? projects.find(p => p.id === selected.id) ?? selected : null

  return (
    <main className="flex-1 overflow-auto">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-8 py-4">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Pretraži projekte..." className="border-border bg-card pl-10" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <div className="flex items-center gap-3">
            {(search || statusFilter !== "all" || priorityFilter !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setPriorityFilter("all"); setPage(1) }} className="gap-1.5 text-muted-foreground">
                <X className="h-3.5 w-3.5" /> Poništi
              </Button>
            )}
            {canEdit && (
              <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4" /> Novi projekt
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="p-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="font-serif text-4xl font-bold">Projekti i istraživanja</h2>
            <p className="mt-2 text-muted-foreground">Aktivni i arhivirani projekti rodoslovnog istraživanja.</p>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { value: stats.total, label: "Ukupno" },
              { value: stats.active, label: "Aktivnih" },
              { value: stats.completed, label: "Završenih" },
              { value: stats.members, label: "Istraživača" },
            ].map(s => (
              <div key={s.label} className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-accent">{s.value}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">STATUS</label>
              <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1) }}>
                <SelectTrigger className="w-36 border-border bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi statusi</SelectItem>
                  <SelectItem value="active">Aktivno</SelectItem>
                  <SelectItem value="paused">Pauzirano</SelectItem>
                  <SelectItem value="completed">Završeno</SelectItem>
                  <SelectItem value="cancelled">Otkazano</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">PRIORITET</label>
              <Select value={priorityFilter} onValueChange={v => { setPriorityFilter(v); setPage(1) }}>
                <SelectTrigger className="w-32 border-border bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi</SelectItem>
                  <SelectItem value="high">Visok</SelectItem>
                  <SelectItem value="medium">Srednji</SelectItem>
                  <SelectItem value="low">Nizak</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto text-sm text-muted-foreground">{filtered.length} projekata</div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Učitavanje projekata…</p>
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
            <FolderKanban className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-lg font-semibold text-muted-foreground">Nema projekata</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {paged.map(project => {
              const statusMeta = STATUS_META[project.status] || STATUS_META.active
              const StatusIcon = statusMeta.icon
              const doneGoals = project.goals.filter(g => g.done).length
              const goalProgress = project.goals.length > 0 ? Math.round((doneGoals / project.goals.length) * 100) : project.progress
              const teamAvatars = (project.member_ids || []).slice(0, 4)
              const extra = Math.max(0, (project.member_ids || []).length - 4)
              return (
                <div key={project.id} onClick={() => setSelected(project)}
                  className="group cursor-pointer rounded-xl border border-border bg-card p-6 transition-all hover:border-accent/40 hover:shadow-md">
                  <div className="mb-3 flex items-start gap-2">
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusMeta.cls}`}>
                          <StatusIcon className="h-3 w-3" />{statusMeta.label}
                        </span>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${PRIORITY_META[project.priority]?.cls}`}>
                          {PRIORITY_META[project.priority]?.label}
                        </span>
                      </div>
                      <h3 className="font-serif text-xl font-bold leading-tight group-hover:text-accent transition-colors">{project.title}</h3>
                      {project.project_url && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-accent/80 hover:text-accent font-medium transition-colors"
                          onClick={(e) => { e.stopPropagation(); window.open(project.project_url, '_blank') }}>
                          <ExternalLink className="h-3 w-3" />
                          <span className="truncate max-w-[200px]">{project.project_url.replace(/^https?:\/\//, '')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {project.description && <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{project.description}</p>}

                  <div className="mb-4">
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Napredak</span>
                      <span className="font-medium">{goalProgress}%</span>
                    </div>
                    <Progress value={goalProgress} className="h-2" />
                    {project.goals.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{doneGoals}/{project.goals.length} ciljeva</p>}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {project.end_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(project.end_date).toLocaleDateString("hr-HR", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex -space-x-2">
                          {teamAvatars.map(id => (
                            <Avatar key={id} className="h-7 w-7 border-2 border-card shadow-sm">
                              <AvatarFallback className="bg-secondary text-[10px]">{String(id).slice(-2)}</AvatarFallback>
                            </Avatar>
                          ))}
                          {extra > 0 && <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-secondary text-[10px] font-medium">+{extra}</div>}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-50 border-green-100/50 gap-1.5 px-2.5 py-1 h-7">
                            <Users className="h-3.5 w-3.5" />
                            <span className="text-xs font-bold">{(project.member_ids || []).length}</span>
                          </Badge>

                          {/* Attachments Indicators */}
                          {(project.attachments || []).length > 0 && (
                            <div className="flex items-center gap-2 border-l border-border pl-2">
                              {(project.attachments || []).filter(a => a.fileType === 'image').length > 0 && (
                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-100/50 gap-1.5 px-2 py-1 h-7">
                                  <ImageIcon className="h-3.5 w-3.5" />
                                  <span className="text-xs font-bold">{(project.attachments || []).filter(a => a.fileType === 'image').length}</span>
                                </Badge>
                              )}
                              {(project.attachments || []).filter(a => a.fileType !== 'image').length > 0 && (
                                <Badge variant="secondary" className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-100/50 gap-1.5 px-2 py-1 h-7">
                                  <Paperclip className="h-3.5 w-3.5" />
                                  <span className="text-xs font-bold">{(project.attachments || []).filter(a => a.fileType !== 'image').length}</span>
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-1">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded p-2 hover:bg-secondary disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)} className={`h-8 w-8 rounded text-sm ${page === p ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>{p}</button>
            ))}
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="rounded p-2 hover:bg-secondary disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      {liveProject && <ProjectDetailPanel project={liveProject} onClose={() => setSelected(null)} />}
      {showAdd && <AddProjectDialog onClose={() => setShowAdd(false)} />}
    </main>
  )
}