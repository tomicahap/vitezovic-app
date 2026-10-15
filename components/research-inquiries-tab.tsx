"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { 
  Search, Plus, X, Loader2, CheckCircle, Clock, AlertCircle, Trash2, 
  Save, Calendar, Paperclip, ExternalLink, User, Mail, Phone, 
  FileText, ArrowUpDown, ChevronLeft, ChevronRight, Edit3, ShieldAlert,
  Download, Upload, CheckSquare, Sparkles, Filter
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/contexts/auth-context"
import { useMembers } from "@/contexts/members-context"
import { generateId } from "@/lib/utils"

export interface ResearchInquiry {
  id: number
  requester_name: string
  requester_contact?: string
  inquiry_date: string
  subject: string
  inquiry_text: string
  assigned_to_id?: number | null
  assigned_to_name?: string | null
  assigned_date?: string | null
  researcher_response?: string | null
  actions_taken?: string | null
  collected_documents?: string | null
  research_result?: string | null
  status: "active" | "pending" | "completed" | "rejected"
  priority: "low" | "normal" | "high" | "urgent"
  external_link?: string | null
  attachments: Array<{ id: string; name: string; url: string; fileType: string; size?: number }>
  notes?: string | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; cls: string }> = {
  active: { label: "U radu (Aktivno)", icon: Clock, cls: "bg-amber-50 text-amber-800 border-amber-300" },
  pending: { label: "Na čekanju", icon: AlertCircle, cls: "bg-blue-50 text-blue-800 border-blue-300" },
  completed: { label: "Završeno", icon: CheckCircle, cls: "bg-emerald-50 text-emerald-800 border-emerald-300" },
  rejected: { label: "Odbijeno", icon: X, cls: "bg-rose-50 text-rose-800 border-rose-300" }
}

const PRIORITY_CONFIG: Record<string, { label: string; cls: string }> = {
  low: { label: "Nizak", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  normal: { label: "Uobičajen", cls: "bg-slate-100 text-slate-800 border-slate-300" },
  high: { label: "Visok", cls: "bg-orange-100 text-orange-800 border-orange-300" },
  urgent: { label: "Hitan", cls: "bg-red-100 text-red-800 border-red-300 font-bold" }
}

export function ResearchInquiriesTab() {
  const { user } = useAuth()
  const { members } = useMembers()

  const canView = user?.role === "admin" || user?.role === "moderator" || user?.accessRights?.research_inquiries?.view !== false
  const canEdit = user?.role === "admin" || user?.role === "moderator" || user?.accessRights?.research_inquiries?.edit === true

  const [inquiries, setInquiries] = useState<ResearchInquiry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [selectedInquiry, setSelectedInquiry] = useState<ResearchInquiry | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)

  const fetchInquiries = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/projects/inquiries")
      if (res.ok) {
        const data = await res.json()
        setInquiries(data.inquiries || [])
      }
    } catch (e) {
      console.error("Greška pri dohvatu upita:", e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchInquiries()
  }, [])

  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inq) => {
      const q = search.toLowerCase()
      const matchesSearch =
        !search ||
        inq.subject.toLowerCase().includes(q) ||
        inq.requester_name.toLowerCase().includes(q) ||
        (inq.assigned_to_name && inq.assigned_to_name.toLowerCase().includes(q)) ||
        (inq.inquiry_text && inq.inquiry_text.toLowerCase().includes(q)) ||
        (inq.research_result && inq.research_result.toLowerCase().includes(q))

      const matchesStatus = statusFilter === "all" || inq.status === statusFilter
      const matchesPriority = priorityFilter === "all" || inq.priority === priorityFilter

      return matchesSearch && matchesStatus && matchesPriority
    })
  }, [inquiries, search, statusFilter, priorityFilter])

  const stats = useMemo(() => {
    return {
      total: inquiries.length,
      active: inquiries.filter((i) => i.status === "active").length,
      completed: inquiries.filter((i) => i.status === "completed").length,
      pending: inquiries.filter((i) => i.status === "pending").length
    }
  }, [inquiries])

  if (!canView) {
    return (
      <div className="p-8 text-center bg-card rounded-2xl border border-border my-6">
        <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
        <h3 className="font-serif text-xl font-bold text-primary">Pristup ograničen</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Nemate ovlasti za pregled evidencije rodoslovnih upita i istraživanja.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-amber-50/40 border border-amber-200/60 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-amber-300 bg-amber-100/50 text-amber-900 font-bold uppercase text-[10px]">
              Rodoslovna istraživanja
            </Badge>
          </div>
          <h2 className="font-serif text-2xl font-bold text-primary mt-1">Upiti i rodoslovna istraživanja</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Evidencija pristiglih upita građana, dodijeljenih istraživača, prikupljenih dokumenata i rezultata.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-2">
            <div className="bg-white border border-border rounded-xl px-3 py-1.5 text-center shadow-sm">
              <span className="block text-xs text-muted-foreground uppercase font-bold">Ukupno</span>
              <span className="font-serif text-lg font-bold text-primary leading-tight">{stats.total}</span>
            </div>
            <div className="bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-center shadow-sm">
              <span className="block text-xs text-amber-700 uppercase font-bold">U radu</span>
              <span className="font-serif text-lg font-bold text-amber-700 leading-tight">{stats.active}</span>
            </div>
            <div className="bg-white border border-emerald-200 rounded-xl px-3 py-1.5 text-center shadow-sm">
              <span className="block text-xs text-emerald-700 uppercase font-bold">Završeno</span>
              <span className="font-serif text-lg font-bold text-emerald-700 leading-tight">{stats.completed}</span>
            </div>
          </div>

          {canEdit && (
            <Button
              onClick={() => setShowAddDialog(true)}
              className="rounded-full gap-2 shadow-md hover:scale-105 transition-all bg-primary"
            >
              <Plus className="h-4 w-4" /> Novi upit
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap items-center gap-3 justify-between">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pretraži po podnositelju, temi, istraživaču ili tekstu..."
            className="pl-9 bg-background border-border rounded-full h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 rounded-full bg-background border-border text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Svi statusi</SelectItem>
              <SelectItem value="active">U radu (Aktivno)</SelectItem>
              <SelectItem value="pending">Na čekanju</SelectItem>
              <SelectItem value="completed">Završeno</SelectItem>
              <SelectItem value="rejected">Odbijeno</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-32 h-9 rounded-full bg-background border-border text-xs">
              <SelectValue placeholder="Prioritet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Svi prioriteti</SelectItem>
              <SelectItem value="low">Nizak</SelectItem>
              <SelectItem value="normal">Uobičajen</SelectItem>
              <SelectItem value="high">Visok</SelectItem>
              <SelectItem value="urgent">Hitan</SelectItem>
            </SelectContent>
          </Select>

          {(search || statusFilter !== "all" || priorityFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("")
                setStatusFilter("all")
                setPriorityFilter("all")
              }}
              className="rounded-full text-xs text-muted-foreground h-9 gap-1"
            >
              <X className="h-3.5 w-3.5" /> Poništi
            </Button>
          )}
        </div>
      </div>

      {/* List of Inquiries */}
      {isLoading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Učitavanje upita i istraživanja...</p>
        </div>
      ) : filteredInquiries.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-2xl bg-muted/10">
          <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
          <h4 className="font-serif text-lg font-bold text-primary">Nema pronađenih upita</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Trenutno nema upisa koji odgovaraju odabranim kriterijima.
          </p>
          {canEdit && (
            <Button onClick={() => setShowAddDialog(true)} variant="outline" size="sm" className="mt-4 rounded-full">
              <Plus className="h-3.5 w-3.5 mr-1" /> Unesi prvi upit
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInquiries.map((inq) => {
            const statusMeta = STATUS_CONFIG[inq.status] || STATUS_CONFIG.active
            const StatusIcon = statusMeta.icon
            const priorityMeta = PRIORITY_CONFIG[inq.priority] || PRIORITY_CONFIG.normal

            return (
              <div
                key={inq.id}
                onClick={() => setSelectedInquiry(inq)}
                className="group relative bg-card border border-border hover:border-amber-400/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusMeta.cls}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusMeta.label}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${priorityMeta.cls}`}>
                      {priorityMeta.label}
                    </span>
                  </div>

                  <h3 className="font-serif text-lg font-bold text-primary group-hover:text-amber-700 transition-colors line-clamp-2 leading-snug mb-1">
                    {inq.subject}
                  </h3>

                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-3">
                    <User className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <span className="font-medium text-foreground">{inq.requester_name}</span>
                    <span>•</span>
                    <span>{new Date(inq.inquiry_date).toLocaleDateString("en-GB")}</span>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mb-4 bg-muted/30 p-2.5 rounded-xl border border-border/50">
                    {inq.inquiry_text}
                  </p>
                </div>

                <div className="border-t border-border/60 pt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Zadužen:</span>
                    <span className="font-semibold text-primary truncate max-w-[160px]">
                      {inq.assigned_to_name || "Nije dodijeljeno"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <div className="flex items-center gap-2">
                      {inq.attachments && inq.attachments.length > 0 && (
                        <span className="flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          <Paperclip className="h-3 w-3" /> {inq.attachments.length}
                        </span>
                      )}
                      {inq.external_link && (
                        <span className="flex items-center gap-1 text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200" title="Vanjska dokumentacija">
                          <ExternalLink className="h-3 w-3" /> Link
                        </span>
                      )}
                    </div>

                    <span className="text-accent group-hover:translate-x-0.5 transition-transform font-bold text-xs">
                      Pregledaj detalje →
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Dialogs */}
      {selectedInquiry && (
        <InquiryDetailModal
          inquiry={selectedInquiry}
          canEdit={canEdit}
          members={members}
          onClose={() => setSelectedInquiry(null)}
          onRefresh={() => {
            fetchInquiries()
            setSelectedInquiry(null)
          }}
        />
      )}

      {showAddDialog && (
        <InquiryAddModal
          members={members}
          onClose={() => setShowAddDialog(false)}
          onSuccess={() => {
            fetchInquiries()
            setShowAddDialog(false)
          }}
        />
      )}
    </div>
  )
}

function InquiryAddModal({
  members,
  onClose,
  onSuccess
}: {
  members: any[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    requester_name: "",
    requester_contact: "",
    inquiry_date: new Date().toISOString().slice(0, 10),
    subject: "",
    inquiry_text: "",
    assigned_to_id: "" as any,
    assigned_date: "",
    priority: "normal",
    status: "active",
    external_link: "",
    notes: ""
  })
  const [attachments, setAttachments] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const uploaded = [...attachments]
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const form = new FormData()
        form.append("file", file)
        const res = await fetch("/api/meetings/upload", { method: "POST", body: form })
        if (res.ok) {
          const data = await res.json()
          uploaded.push({ id: generateId(), name: data.name, url: data.url, fileType: data.fileType, size: data.size })
        }
      }
      setAttachments(uploaded)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.requester_name || !formData.subject || !formData.inquiry_text) {
      alert("Molimo unesite ime podnositelja, predmet i tekst upita.")
      return
    }

    setIsSubmitting(true)
    try {
      const assignedMember = members.find((m) => m.id === Number(formData.assigned_to_id))
      const payload = {
        action: "add",
        ...formData,
        assigned_to_id: formData.assigned_to_id ? Number(formData.assigned_to_id) : null,
        assigned_to_name: assignedMember ? assignedMember.name : null,
        attachments
      }

      const res = await fetch("/api/projects/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        onSuccess()
      } else {
        const err = await res.json()
        alert(err.error || "Greška pri spremanju.")
      }
    } catch (e) {
      console.error(e)
      alert("Greška pri spremanju.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-background border border-border rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-serif text-2xl font-bold text-primary">Novi upit za istraživanje</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Unesite pristigli upit građana ili institucije</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Podnositelj upita (Ime i prezime / Ustanova) *
              </label>
              <Input
                required
                placeholder="npr. Marko Horvat"
                value={formData.requester_name}
                onChange={(e) => setFormData({ ...formData, requester_name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Kontakt podnositelja (E-mail / Telefon)
              </label>
              <Input
                placeholder="npr. marko@email.com, 091 123 4567"
                value={formData.requester_contact}
                onChange={(e) => setFormData({ ...formData, requester_contact: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Datum upita *
              </label>
              <Input
                type="date"
                required
                value={formData.inquiry_date}
                onChange={(e) => setFormData({ ...formData, inquiry_date: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Status
              </label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">U radu (Aktivno)</SelectItem>
                  <SelectItem value="pending">Na čekanju</SelectItem>
                  <SelectItem value="completed">Završeno</SelectItem>
                  <SelectItem value="rejected">Odbijeno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Prioritet
              </label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Nizak</SelectItem>
                  <SelectItem value="normal">Uobičajen</SelectItem>
                  <SelectItem value="high">Visok</SelectItem>
                  <SelectItem value="urgent">Hitan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              Predmet / Tema istraživanja *
            </label>
            <Input
              required
              placeholder="npr. Rodoslovno stablo obitelji Car - Crikvenica i Vinodol"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              Tekst i detalji upita *
            </label>
            <textarea
              required
              rows={4}
              placeholder="Ovdje detaljno upišite što je točno podnositelj zatražio, poznata imena, godine, župe i mjesta..."
              className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={formData.inquiry_text}
              onChange={(e) => setFormData({ ...formData, inquiry_text: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Dodijeli istraživaču (Član društva)
              </label>
              <Select
                value={formData.assigned_to_id ? String(formData.assigned_to_id) : "unassigned"}
                onValueChange={(v) => setFormData({ ...formData, assigned_to_id: v === "unassigned" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Odaberi istraživača..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">-- Nije dodijeljeno --</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Poveznica na vanjsku dokumentaciju (URL)
              </label>
              <Input
                placeholder="https://drive.google.com/... ili arhivska baza"
                value={formData.external_link}
                onChange={(e) => setFormData({ ...formData, external_link: e.target.value })}
              />
            </div>
          </div>

          {/* Attachments */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Priloženi dokumenti i fotografije ({attachments.length})
              </label>
              <input type="file" ref={fileRef} multiple className="hidden" onChange={handleFileUpload} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="h-8 rounded-full text-xs"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                Prenesi datoteke
              </Button>
            </div>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-muted/50 border border-border px-2.5 py-1 rounded-lg text-xs">
                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                    <span className="max-w-[150px] truncate">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                      className="text-muted-foreground hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        <div className="p-4 border-t border-border flex justify-end gap-2 bg-muted/10">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-full">
            Odustani
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="rounded-full px-6">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Spremi upit
          </Button>
        </div>
      </div>
    </div>
  )
}

function InquiryDetailModal({
  inquiry,
  canEdit,
  members,
  onClose,
  onRefresh
}: {
  inquiry: ResearchInquiry
  canEdit: boolean
  members: any[]
  onClose: () => void
  onRefresh: () => void
}) {
  const [form, setForm] = useState<ResearchInquiry>({ ...inquiry })
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const uploaded = [...(form.attachments || [])]
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const data = new FormData()
        data.append("file", file)
        const res = await fetch("/api/meetings/upload", { method: "POST", body: data })
        if (res.ok) {
          const ret = await res.json()
          uploaded.push({ id: generateId(), name: ret.name, url: ret.url, fileType: ret.fileType, size: ret.size })
        }
      }
      setForm({ ...form, attachments: uploaded })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const assignedMember = members.find((m) => m.id === Number(form.assigned_to_id))
      const payload = {
        action: "update",
        id: form.id,
        ...form,
        assigned_to_id: form.assigned_to_id ? Number(form.assigned_to_id) : null,
        assigned_to_name: assignedMember ? assignedMember.name : form.assigned_to_name
      }

      const res = await fetch("/api/projects/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        onRefresh()
      } else {
        alert("Greška pri ažuriranju upita.")
      }
    } catch (e) {
      console.error(e)
      alert("Greška pri ažuriranju upita.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Jeste li sigurni da želite obrisati ovaj upit i sve povezane podatke?")) return
    try {
      const res = await fetch("/api/projects/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: form.id })
      })
      if (res.ok) {
        onRefresh()
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-background border border-border rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${STATUS_CONFIG[form.status]?.cls}`}>
                {STATUS_CONFIG[form.status]?.label}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${PRIORITY_CONFIG[form.priority]?.cls}`}>
                {PRIORITY_CONFIG[form.priority]?.label} prioritet
              </span>
            </div>
            <h2 className="font-serif text-2xl font-bold text-primary truncate leading-tight">
              {form.subject}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Podnositelj: <strong className="text-foreground">{form.requester_name}</strong> • Primljeno: {new Date(form.inquiry_date).toLocaleDateString("en-GB")}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted text-muted-foreground shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Podnositelj i upit */}
          <div className="bg-muted/20 border border-border/80 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary">1. Podaci o upitu</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Kontakt podnositelja:</span>
                {canEdit ? (
                  <Input
                    className="h-8 mt-1 text-xs"
                    value={form.requester_contact || ""}
                    onChange={(e) => setForm({ ...form, requester_contact: e.target.value })}
                  />
                ) : (
                  <p className="font-medium text-xs mt-0.5">{form.requester_contact || "Nije navedeno"}</p>
                )}
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Predmet:</span>
                {canEdit ? (
                  <Input
                    className="h-8 mt-1 text-xs font-bold"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  />
                ) : (
                  <p className="font-bold text-xs mt-0.5">{form.subject}</p>
                )}
              </div>
            </div>

            <div>
              <span className="text-xs text-muted-foreground block mb-1">Izvorni tekst upita:</span>
              {canEdit ? (
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs focus:outline-none"
                  value={form.inquiry_text}
                  onChange={(e) => setForm({ ...form, inquiry_text: e.target.value })}
                />
              ) : (
                <div className="p-3 rounded-xl bg-background border border-border text-xs whitespace-pre-wrap leading-relaxed">
                  {form.inquiry_text}
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Tijek istraživanja i zaduženja */}
          <div className="bg-amber-50/20 border border-amber-200/50 rounded-2xl p-4 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">2. Zaduženje i status</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Status rada</label>
                {canEdit ? (
                  <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">U radu (Aktivno)</SelectItem>
                      <SelectItem value="pending">Na čekanju</SelectItem>
                      <SelectItem value="completed">Završeno</SelectItem>
                      <SelectItem value="rejected">Odbijeno</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline">{STATUS_CONFIG[form.status]?.label}</Badge>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Prioritet</label>
                {canEdit ? (
                  <Select value={form.priority} onValueChange={(v: any) => setForm({ ...form, priority: v })}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Nizak</SelectItem>
                      <SelectItem value="normal">Uobičajen</SelectItem>
                      <SelectItem value="high">Visok</SelectItem>
                      <SelectItem value="urgent">Hitan</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline">{PRIORITY_CONFIG[form.priority]?.label}</Badge>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Zaduženi istraživač</label>
                {canEdit ? (
                  <Select
                    value={form.assigned_to_id ? String(form.assigned_to_id) : "unassigned"}
                    onValueChange={(v) => {
                      const id = v === "unassigned" ? null : Number(v)
                      const mb = members.find((m) => m.id === id)
                      setForm({ ...form, assigned_to_id: id, assigned_to_name: mb ? mb.name : null })
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Odaberi..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">-- Nije dodijeljeno --</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs font-semibold mt-1">{form.assigned_to_name || "Nije dodijeljeno"}</p>
                )}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Odgovor i zabilješke istraživača
              </label>
              {canEdit ? (
                <textarea
                  rows={2}
                  placeholder="Što je istraživač odgovorio ili primijetio..."
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs focus:outline-none"
                  value={form.researcher_response || ""}
                  onChange={(e) => setForm({ ...form, researcher_response: e.target.value })}
                />
              ) : (
                <p className="text-xs whitespace-pre-wrap">{form.researcher_response || "Nema odgovora."}</p>
              )}
            </div>
          </div>

          {/* Section 3: Provedene radnje, pronađeni dokumenti i konačni rezultat */}
          <div className="bg-emerald-50/20 border border-emerald-200/50 rounded-2xl p-4 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-950">3. Istraživački rad i nalazi</h4>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Što je napravljeno (Pretraženi arhivi, župe, matični uredi)
              </label>
              {canEdit ? (
                <textarea
                  rows={2}
                  placeholder="npr. Pregledane matice rođenih 1870-1900, poslan upit u arhiv..."
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs focus:outline-none"
                  value={form.actions_taken || ""}
                  onChange={(e) => setForm({ ...form, actions_taken: e.target.value })}
                />
              ) : (
                <p className="text-xs whitespace-pre-wrap">{form.actions_taken || "Nije zabilježeno."}</p>
              )}
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Prikupljeni dokumenti i izvori
              </label>
              {canEdit ? (
                <textarea
                  rows={2}
                  placeholder="npr. Rodni list br. 142/1888, prijepis vjenčanog lista..."
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs focus:outline-none"
                  value={form.collected_documents || ""}
                  onChange={(e) => setForm({ ...form, collected_documents: e.target.value })}
                />
              ) : (
                <p className="text-xs whitespace-pre-wrap">{form.collected_documents || "Nema popisa dokumenata."}</p>
              )}
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 block mb-1">
                Konačni rezultat i zaključak istraživanja
              </label>
              {canEdit ? (
                <textarea
                  rows={3}
                  placeholder="Zaključak, rješenje rodoslovlja ili razlog zašto se podaci nisu mogli pronaći..."
                  className="w-full rounded-xl border border-emerald-300 bg-background p-2.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={form.research_result || ""}
                  onChange={(e) => setForm({ ...form, research_result: e.target.value })}
                />
              ) : (
                <div className="p-3 bg-emerald-50/40 border border-emerald-200/60 rounded-xl text-xs whitespace-pre-wrap font-medium">
                  {form.research_result || "Istraživanje u tijeku."}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Prilozi i poveznice */}
          <div className="bg-muted/20 border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">4. Prilozi i dokumentacija</h4>
              {canEdit && (
                <>
                  <input type="file" ref={fileRef} multiple className="hidden" onChange={handleFileUpload} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="h-7 text-xs rounded-full"
                  >
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                    Dodaj prilog
                  </Button>
                </>
              )}
            </div>

            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Vanjski link na mapu / online arhivu:</label>
              {canEdit ? (
                <Input
                  className="h-8 text-xs"
                  placeholder="https://..."
                  value={form.external_link || ""}
                  onChange={(e) => setForm({ ...form, external_link: e.target.value })}
                />
              ) : form.external_link ? (
                <a
                  href={form.external_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-semibold"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Otvori vanjsku dokumentaciju
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">Nema vanjske poveznice.</p>
              )}
            </div>

            {form.attachments && form.attachments.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <span className="text-xs font-semibold text-muted-foreground block">Spremljene datoteke:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {form.attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-xl border border-border bg-background text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate font-medium">{att.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="p-1 text-primary hover:bg-muted rounded">
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() =>
                              setForm({
                                ...form,
                                attachments: form.attachments.filter((_, i) => i !== idx)
                              })
                            }
                            className="p-1 text-muted-foreground hover:text-red-500 rounded"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-muted/10">
          {canEdit ? (
            <Button type="button" variant="ghost" size="sm" onClick={handleDelete} className="text-red-600 hover:bg-red-50 rounded-full text-xs">
              <Trash2 className="h-4 w-4 mr-1" /> Obriši upit
            </Button>
          ) : <div />}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-full">
              Zatvori
            </Button>
            {canEdit && (
              <Button type="button" onClick={handleSave} disabled={isSaving} className="rounded-full px-6">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Spremi promjene
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
