"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import {
  Search,
  Plus,
  X,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
  Save,
  Calendar,
  Paperclip,
  ExternalLink,
  User,
  Mail,
  Phone,
  FileText,
  Edit3,
  ShieldAlert,
  Download,
  Upload,
  Sparkles,
  Send,
  Inbox,
  CheckCircle2,
  Eye,
  LayoutGrid,
  Columns3,
  UserCheck,
  History,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/contexts/auth-context"
import { useMembers } from "@/contexts/members-context"
import { generateId, formatDateDMY, formatDateTimeDMY } from "@/lib/utils"
import { getInquiryPermissions, getInquiryStatusCategory, type InquiryPermissions } from "@/lib/inquiry-permissions"

export interface InquiryEmailLog {
  id: string
  type: "to_researcher" | "to_requester_wait" | "custom"
  sent_at: string
  sent_by_id?: string
  sent_by_name: string
  sent_by_role?: string
  to: string
  cc?: string
  subject: string
  html_body: string
  attachments_names?: string[]
  gmail_message_id?: string | null
  gmail_thread_id?: string | null
}

export interface ResearchInquiry {
  id: number
  requester_name: string
  requester_contact?: string
  requester_email?: string
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
  status: "unassigned" | "active" | "completed" | "rejected" | "pending"
  priority: "low" | "normal" | "high" | "urgent"
  project_id?: string | null
  project_name?: string | null
  external_link?: string | null
  attachments: Array<{ id: string; name: string; url: string; fileType: string; size?: number; mimeType?: string }>
  email_logs?: InquiryEmailLog[]
  gmail_message_id?: string | null
  gmail_thread_id?: string | null
  notes?: string | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
}

export const STATUS_CONFIG: Record<string, { label: string; shortLabel: string; icon: any; cls: string; dotCls: string }> = {
  unassigned: {
    label: "Zaprimljeno (Nedodijeljeno)",
    shortLabel: "Zaprimljeno – čeka dodjelu",
    icon: Inbox,
    cls: "bg-purple-50 text-purple-900 border-purple-300",
    dotCls: "bg-purple-600",
  },
  pending: {
    label: "Zaprimljeno (Nedodijeljeno)",
    shortLabel: "Zaprimljeno – čeka dodjelu",
    icon: Inbox,
    cls: "bg-purple-50 text-purple-900 border-purple-300",
    dotCls: "bg-purple-600",
  },
  active: {
    label: "U radu (Dodijeljeno)",
    shortLabel: "U radu",
    icon: Clock,
    cls: "bg-amber-50 text-amber-800 border-amber-300",
    dotCls: "bg-amber-500",
  },
  completed: {
    label: "Završeno",
    shortLabel: "Završeno",
    icon: CheckCircle,
    cls: "bg-emerald-50 text-emerald-800 border-emerald-300",
    dotCls: "bg-emerald-600",
  },
  rejected: {
    label: "Odbijeno",
    shortLabel: "Odbijeno",
    icon: X,
    cls: "bg-rose-50 text-rose-800 border-rose-300",
    dotCls: "bg-rose-500",
  },
}

export const PRIORITY_CONFIG: Record<string, { label: string; cls: string }> = {
  low: { label: "Nizak", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  normal: { label: "Uobičajen", cls: "bg-slate-100 text-slate-800 border-slate-300" },
  high: { label: "Visok", cls: "bg-orange-100 text-orange-800 border-orange-300" },
  urgent: { label: "Hitan", cls: "bg-red-100 text-red-800 border-red-300 font-bold" },
}

function escapeHtml(str: string | undefined | null): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function extractEmailFromText(raw?: string | null): string {
  if (!raw) return ""
  const m = String(raw).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return m ? m[0].trim().toLowerCase() : ""
}

function formatDateHr(dateStr?: string | null): string {
  return formatDateDMY(dateStr, "—")
}

function formatDateTimeHr(dateStr?: string | null): string {
  return formatDateTimeDMY(dateStr, "—")
}

export function ResearchInquiriesTab({
  projectId,
  projectName,
}: {
  projectId?: string
  projectName?: string
} = {}) {
  const { user } = useAuth()
  const { members } = useMembers()

  const inqPerms = useMemo(() => getInquiryPermissions(user), [user])
  const canView = inqPerms.canViewAny
  const canCreate = inqPerms.zaprimljeno.edit || inqPerms.canEditAny

  const [inquiries, setInquiries] = useState<ResearchInquiry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "unassigned" | "active" | "completed" | "rejected">("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"grid" | "board">("board")
  const [selectedInquiry, setSelectedInquiry] = useState<ResearchInquiry | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)

  const fetchInquiries = async () => {
    setIsLoading(true)
    try {
      const url = projectId
        ? `/api/projects/inquiries?projectId=${encodeURIComponent(projectId)}`
        : "/api/projects/inquiries"
      const res = await fetch(url, { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        const list: ResearchInquiry[] = data.inquiries || []
        setInquiries(list)
        if (selectedInquiry) {
          const refreshed = list.find((i) => i.id === selectedInquiry.id)
          if (refreshed) setSelectedInquiry(refreshed)
        }
      }
    } catch (e) {
      console.error("Greška pri dohvatu upita:", e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchInquiries()
  }, [projectId])

  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inq) => {
      const q = search.toLowerCase()
      const assignedMember = members.find(
        (m) => m.id === inq.assigned_to_id || m.name === inq.assigned_to_name
      )
      const normStatus = inq.status === "pending" ? "unassigned" : inq.status

      const matchesSearch =
        !search ||
        inq.subject.toLowerCase().includes(q) ||
        inq.requester_name.toLowerCase().includes(q) ||
        (inq.requester_email && inq.requester_email.toLowerCase().includes(q)) ||
        (inq.requester_contact && inq.requester_contact.toLowerCase().includes(q)) ||
        (inq.assigned_to_name && inq.assigned_to_name.toLowerCase().includes(q)) ||
        (assignedMember &&
          ((assignedMember.email && assignedMember.email.toLowerCase().includes(q)) ||
            (assignedMember.phone && assignedMember.phone.toLowerCase().includes(q)))) ||
        (inq.inquiry_text && inq.inquiry_text.toLowerCase().includes(q)) ||
        (inq.research_result && inq.research_result.toLowerCase().includes(q))

      const cat = getInquiryStatusCategory(inq.status)
      if (!inqPerms[cat]?.view) return false

      const matchesStatus = statusFilter === "all" || normStatus === statusFilter
      const matchesPriority = priorityFilter === "all" || inq.priority === priorityFilter

      return matchesSearch && matchesStatus && matchesPriority
    })
  }, [inquiries, search, statusFilter, priorityFilter, members])

  const visibleInquiries = useMemo(() => {
    return inquiries.filter((i) => inqPerms[getInquiryStatusCategory(i.status)]?.view)
  }, [inquiries, inqPerms])

  const stats = useMemo(() => {
    return {
      total: visibleInquiries.length,
      unassigned: visibleInquiries.filter((i) => i.status === "unassigned" || i.status === "pending").length,
      active: visibleInquiries.filter((i) => i.status === "active").length,
      completed: visibleInquiries.filter((i) => i.status === "completed").length,
      rejected: visibleInquiries.filter((i) => i.status === "rejected").length,
    }
  }, [visibleInquiries])

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

  const renderInquiryCard = (inq: ResearchInquiry) => {
    const normStatus = inq.status === "pending" ? "unassigned" : inq.status
    const statusMeta = STATUS_CONFIG[normStatus] || STATUS_CONFIG.unassigned
    const StatusIcon = statusMeta.icon
    const priorityMeta = PRIORITY_CONFIG[inq.priority] || PRIORITY_CONFIG.normal
    const assignedMember = members.find(
      (m) => m.id === inq.assigned_to_id || m.name === inq.assigned_to_name
    )
    const emailLogs = inq.email_logs || []
    const sentToResearcher = emailLogs.some((l) => l.type === "to_researcher")
    const sentWaitToRequester = emailLogs.some((l) => l.type === "to_requester_wait")
    const requesterEmail = inq.requester_email || extractEmailFromText(inq.requester_contact)

    return (
      <div
        key={inq.id}
        onClick={() => setSelectedInquiry(inq)}
        className={`group relative bg-card border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between ${
          normStatus === "unassigned"
            ? "border-purple-300/80 hover:border-purple-500"
            : normStatus === "active"
            ? "border-amber-300/80 hover:border-amber-500"
            : "border-border hover:border-emerald-500/80"
        }`}
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusMeta.cls}`}
            >
              <StatusIcon className="h-3 w-3" />
              {statusMeta.label}
            </span>
            <div className="flex items-center gap-1.5">
              {inq.gmail_message_id && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200"
                  title="Upit izravno prebačen iz Gmail Inboxa"
                >
                  <Mail className="h-2.5 w-2.5" /> Iz Inboxa
                </span>
              )}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${priorityMeta.cls}`}>
                {priorityMeta.label}
              </span>
            </div>
          </div>

          <h3 className="font-serif text-base font-bold text-primary group-hover:text-amber-800 transition-colors line-clamp-2 leading-snug mb-1.5">
            {inq.subject}
          </h3>

          <div className="text-xs text-muted-foreground space-y-0.5 mb-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <User className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
              <span className="font-semibold text-foreground">{inq.requester_name}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 opacity-70" />
                {formatDateHr(inq.inquiry_date)}
              </span>
            </div>
            {requesterEmail && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-600 truncate">
                <Mail className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                <span className="truncate">{requesterEmail}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mb-3 bg-muted/30 p-2.5 rounded-xl border border-border/50">
            {inq.inquiry_text}
          </p>
        </div>

        <div className="border-t border-border/60 pt-2.5 space-y-2">
          {/* Zaduženi istraživač */}
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground font-medium">Istraživač:</span>
              {assignedMember || inq.assigned_to_name ? (
                <span
                  className="font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg truncate max-w-[180px]"
                  title={assignedMember?.name || inq.assigned_to_name || ""}
                >
                  {assignedMember?.name || inq.assigned_to_name}
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-lg">
                  Čeka dodjelu istraživača
                </span>
              )}
            </div>
          </div>

          {/* Oznake poslanih e-mailova */}
          {(sentToResearcher || sentWaitToRequester) && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {sentWaitToRequester && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200"
                  title="Podnositelju je poslan mail zahvale i obavijest da čeka prvog slobodnog istraživača"
                >
                  <CheckCircle2 className="h-2.5 w-2.5 text-sky-600" /> Poslana potvrda podnositelju
                </span>
              )}
              {sentToResearcher && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200"
                  title="Istraživaču je poslan mail s upitom i privitcima (podnositelj u CC)"
                >
                  <Send className="h-2.5 w-2.5 text-emerald-600" /> Proslijeđeno istraživaču (CC)
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <div className="flex items-center gap-1.5">
              {inq.attachments && inq.attachments.length > 0 && (
                <span className="flex items-center gap-1 text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  <Paperclip className="h-3 w-3" /> {inq.attachments.length}
                </span>
              )}
              {emailLogs.length > 0 && (
                <span
                  className="flex items-center gap-1 text-slate-700 font-semibold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                  title={`Ukupno poslano službenih e-mailova: ${emailLogs.length}`}
                >
                  <Mail className="h-3 w-3" /> {emailLogs.length}
                </span>
              )}
              {inq.external_link && (
                <span
                  className="flex items-center gap-1 text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200"
                  title="Vanjska dokumentacija"
                >
                  <ExternalLink className="h-3 w-3" /> Link
                </span>
              )}
            </div>

            <span className="text-accent group-hover:translate-x-0.5 transition-transform font-bold text-xs">
              Upravljaj →
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-gradient-to-r from-amber-50/70 via-amber-50/30 to-background border border-amber-200/70 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-100/60 text-amber-900 font-bold uppercase text-[10px]"
            >
              Rodoslovna istraživanja
            </Badge>
          </div>
          <h2 className="font-serif text-2xl font-bold text-primary mt-1">
            Upiti i rodoslovna istraživanja
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upravljanje zaprimljenim upitima iz e-pošte, dodjela istraživačima, slanje službenih obavijesti (s CC-om i donacijskim barkodom) te arhiva nalaza.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="inline-flex rounded-full border border-border bg-white p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode("board")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                viewMode === "board"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Pregled u 3 stupca po statusu (Zaprimljeno, U radu, Završeno)"
            >
              <Columns3 className="h-3.5 w-3.5" /> Po fazama (3 stupca)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Mrežni prikaz kartica"
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Mreža kartica
            </button>
          </div>

          {canCreate && (
            <Button
              onClick={() => setShowAddDialog(true)}
              className="rounded-full gap-2 shadow-md hover:scale-105 transition-all bg-primary"
            >
              <Plus className="h-4 w-4" /> Novi upit ručno
            </Button>
          )}
        </div>
      </div>

      {/* Status Filter Cards (3 main statuses + All) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`text-left rounded-2xl border p-3.5 transition-all ${
            statusFilter === "all"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
              : "border-border bg-card hover:border-primary/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Svi upiti
            </span>
            <FileText className="h-4 w-4 text-primary/70" />
          </div>
          <p className="font-serif text-2xl font-bold text-primary mt-1">{stats.total}</p>
          <p className="text-[11px] text-muted-foreground">Ukupno evidentirano</p>
        </button>

        {inqPerms.zaprimljeno.view && (
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "unassigned" ? "all" : "unassigned")}
            className={`text-left rounded-2xl border p-3.5 transition-all ${
              statusFilter === "unassigned"
                ? "border-purple-500 bg-purple-50/70 ring-2 ring-purple-400/30 shadow-xs"
                : "border-purple-200 bg-purple-50/25 hover:border-purple-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-900">
                1. Zaprimljeno (Nedodijeljeno)
              </span>
              <Inbox className="h-4 w-4 text-purple-700" />
            </div>
            <p className="font-serif text-2xl font-bold text-purple-900 mt-1">{stats.unassigned}</p>
            <p className="text-[11px] text-purple-800/80">Čeka dodjelu istraživaču</p>
          </button>
        )}

        {inqPerms.uradu.view && (
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
            className={`text-left rounded-2xl border p-3.5 transition-all ${
              statusFilter === "active"
                ? "border-amber-500 bg-amber-50/70 ring-2 ring-amber-400/30 shadow-xs"
                : "border-amber-200 bg-amber-50/25 hover:border-amber-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                2. U radu (Dodijeljeno)
              </span>
              <Clock className="h-4 w-4 text-amber-700" />
            </div>
            <p className="font-serif text-2xl font-bold text-amber-800 mt-1">{stats.active}</p>
            <p className="text-[11px] text-amber-800/80">Dodijeljeno istraživačima</p>
          </button>
        )}

        {inqPerms.zavrseno.view && (
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "completed" ? "all" : "completed")}
            className={`text-left rounded-2xl border p-3.5 transition-all ${
              statusFilter === "completed"
                ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-400/30 shadow-xs"
                : "border-emerald-200 bg-emerald-50/25 hover:border-emerald-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                3. Završeno
              </span>
              <CheckCircle className="h-4 w-4 text-emerald-700" />
            </div>
            <p className="font-serif text-2xl font-bold text-emerald-800 mt-1">{stats.completed}</p>
            <p className="text-[11px] text-emerald-800/80">Riješena istraživanja</p>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap items-center gap-3 justify-between">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pretraži po podnositelju, e-mailu, temi, istraživaču ili tekstu upita..."
            className="pl-9 bg-background border-border rounded-full h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="w-52 h-9 rounded-full bg-background border-border text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Svi dostupni statusi ({stats.total})</SelectItem>
              {inqPerms.zaprimljeno.view && (
                <SelectItem value="unassigned">1. Zaprimljeno / Nedodijeljeno ({stats.unassigned})</SelectItem>
              )}
              {inqPerms.uradu.view && (
                <SelectItem value="active">2. U radu / Dodijeljeno ({stats.active})</SelectItem>
              )}
              {inqPerms.zavrseno.view && (
                <>
                  <SelectItem value="completed">3. Završeno ({stats.completed})</SelectItem>
                  <SelectItem value="rejected">Odbijeno ({stats.rejected})</SelectItem>
                </>
              )}
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

      {/* Main Content: Board (3 columns) or Grid */}
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
            Trenutno nema upisa koji odgovaraju odabranim kriterijima ili prebacite upit izravno iz Gmail Inboxa gumbom „U istraživanje”.
          </p>
          {canCreate && (
            <Button
              onClick={() => setShowAddDialog(true)}
              variant="outline"
              size="sm"
              className="mt-4 rounded-full"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Unesi novi upit
            </Button>
          )}
        </div>
      ) : viewMode === "board" && statusFilter === "all" ? (
        <div className={`grid grid-cols-1 ${
          ((inqPerms.zaprimljeno.view ? 1 : 0) + (inqPerms.uradu.view ? 1 : 0) + (inqPerms.zavrseno.view ? 1 : 0)) === 2
            ? "lg:grid-cols-2"
            : ((inqPerms.zaprimljeno.view ? 1 : 0) + (inqPerms.uradu.view ? 1 : 0) + (inqPerms.zavrseno.view ? 1 : 0)) >= 3
            ? "lg:grid-cols-3"
            : ""
        } gap-5 items-start`}>
          {/* Column 1: Zaprimljeno (Nedodijeljeno) */}
          {inqPerms.zaprimljeno.view && (
            <div className="rounded-2xl border border-purple-200/80 bg-purple-50/20 p-3.5 space-y-3">
              <div className="flex items-center justify-between px-1 pb-2 border-b border-purple-200/70">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-600" />
                  <h3 className="font-serif text-sm font-bold text-purple-950 uppercase tracking-wide">
                    1. Zaprimljeno (Nedodijeljeno)
                  </h3>
                </div>
                <Badge className="bg-purple-100 text-purple-900 border-purple-300 hover:bg-purple-100">
                  {filteredInquiries.filter((i) => i.status === "unassigned" || i.status === "pending").length}
                </Badge>
              </div>
              <p className="text-[11px] text-purple-900/80 px-1">
                Upiti pristigli iz maila ili ručno uneseni koji još čekaju dodjelu slobodnom istraživaču.
              </p>
              <div className="space-y-3">
                {filteredInquiries
                  .filter((i) => i.status === "unassigned" || i.status === "pending")
                  .map(renderInquiryCard)}
                {filteredInquiries.filter((i) => i.status === "unassigned" || i.status === "pending").length ===
                  0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-purple-200 rounded-xl bg-white/50">
                    Nema nedodijeljenih upita
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Column 2: U radu (Dodijeljeno) */}
          {inqPerms.uradu.view && (
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/20 p-3.5 space-y-3">
              <div className="flex items-center justify-between px-1 pb-2 border-b border-amber-200/70">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <h3 className="font-serif text-sm font-bold text-amber-950 uppercase tracking-wide">
                    2. U radu (Dodijeljeno)
                  </h3>
                </div>
                <Badge className="bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-100">
                  {filteredInquiries.filter((i) => i.status === "active").length}
                </Badge>
              </div>
              <p className="text-[11px] text-amber-900/80 px-1">
                Istraživanja dodijeljena istraživačima na kojima je rad u tijeku.
              </p>
              <div className="space-y-3">
                {filteredInquiries.filter((i) => i.status === "active").map(renderInquiryCard)}
                {filteredInquiries.filter((i) => i.status === "active").length === 0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-amber-200 rounded-xl bg-white/50">
                    Nema aktivnih istraživanja u radu
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Column 3: Završeno */}
          {inqPerms.zavrseno.view && (
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/20 p-3.5 space-y-3">
              <div className="flex items-center justify-between px-1 pb-2 border-b border-emerald-200/70">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                  <h3 className="font-serif text-sm font-bold text-emerald-950 uppercase tracking-wide">
                    3. Završeno
                  </h3>
                </div>
                <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-100">
                  {filteredInquiries.filter((i) => i.status === "completed").length}
                </Badge>
              </div>
              <p className="text-[11px] text-emerald-900/80 px-1">
                Dovršena rodoslovna istraživanja s unesenim nalazima i dokumentima.
              </p>
              <div className="space-y-3">
                {filteredInquiries.filter((i) => i.status === "completed").map(renderInquiryCard)}
                {filteredInquiries.filter((i) => i.status === "completed").length === 0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-emerald-200 rounded-xl bg-white/50">
                    Nema završenih istraživanja
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInquiries.map(renderInquiryCard)}
        </div>
      )}

      {/* Detail & Management Modal */}
      {selectedInquiry && (
        <InquiryDetailModal
          inquiry={selectedInquiry}
          canEdit={Boolean(inqPerms[getInquiryStatusCategory(selectedInquiry.status)]?.edit)}
          inqPerms={inqPerms}
          members={members}
          onClose={() => setSelectedInquiry(null)}
          onRefresh={() => {
            fetchInquiries()
          }}
        />
      )}

      {showAddDialog && (
        <InquiryAddModal
          members={members}
          defaultProjectId={projectId}
          defaultProjectName={projectName}
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

export function MemberSearchPicker({
  members,
  selectedMemberId,
  selectedMemberName,
  onSelect,
  disabled = false,
  label = "Zadužena odgovorna osoba",
}: {
  members: any[]
  selectedMemberId?: number | null
  selectedMemberName?: string | null
  onSelect: (member: any | null) => void
  disabled?: boolean
  label?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedMember = useMemo(() => {
    if (selectedMemberId) {
      return members.find((m) => m.id === selectedMemberId)
    }
    if (selectedMemberName) {
      return members.find((m) => m.name?.toLowerCase() === selectedMemberName.toLowerCase())
    }
    return null
  }, [members, selectedMemberId, selectedMemberName])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return members.slice(0, 40)
    return members
      .filter(
        (m) =>
          m.name?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q) ||
          m.phone?.toLowerCase().includes(q) ||
          m.membershipNumber?.toLowerCase().includes(q)
      )
      .slice(0, 40)
  }, [members, search])

  return (
    <div className="space-y-1.5" ref={dropdownRef}>
      {label && (
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
          {label}
        </label>
      )}

      {selectedMember ? (
        <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/70 border border-amber-200 shadow-sm transition-all">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-full bg-amber-200 text-amber-900 font-bold text-xs flex items-center justify-center shrink-0">
              {selectedMember.initials || selectedMember.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-amber-950 truncate">{selectedMember.name}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-amber-900/90 mt-0.5">
                {selectedMember.email && (
                  <span className="flex items-center gap-1 truncate" title={selectedMember.email}>
                    <Mail className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                    <span className="truncate">{selectedMember.email}</span>
                  </span>
                )}
                {selectedMember.phone && (
                  <span className="flex items-center gap-1 shrink-0" title={selectedMember.phone}>
                    <Phone className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                    <span>{selectedMember.phone}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {!disabled && (
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsOpen(true)
                  setSearch("")
                }}
                className="h-8 px-2.5 text-xs text-amber-900 hover:bg-amber-100 font-medium rounded-lg"
              >
                Promijeni
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onSelect(null)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg"
                title="Ukloni zaduženje"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      ) : !disabled ? (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Pretraži istraživača (člana) po imenu, e-mailu ili telefonu..."
              value={search}
              onFocus={() => setIsOpen(true)}
              onChange={(e) => {
                setSearch(e.target.value)
                setIsOpen(true)
              }}
              className="pl-9 pr-8 h-9 text-xs bg-background border-border rounded-xl"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {isOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-background border border-border rounded-xl shadow-xl max-h-60 overflow-y-auto p-1 text-xs divide-y divide-border/40 animate-in fade-in-50 zoom-in-95">
              <div
                onClick={() => {
                  onSelect(null)
                  setIsOpen(false)
                }}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer flex items-center gap-2"
              >
                <User className="h-3.5 w-3.5" />
                <span>-- Nije dodijeljeno (Status: Zaprimljeno / Čeka dodjelu) --</span>
              </div>

              {filteredMembers.length === 0 ? (
                <div className="p-3 text-center text-muted-foreground text-xs">
                  Nema pronađenih članova za &quot;{search}&quot;
                </div>
              ) : (
                filteredMembers.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      onSelect(m)
                      setIsOpen(false)
                      setSearch("")
                    }}
                    className="p-2.5 rounded-lg hover:bg-amber-50/80 cursor-pointer transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{m.name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground truncate mt-0.5">
                        {m.email && <span className="truncate">{m.email}</span>}
                        {m.email && m.phone && <span>•</span>}
                        {m.phone && <span className="shrink-0">{m.phone}</span>}
                      </div>
                    </div>
                    {m.membershipNumber && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0 font-mono">
                        #{m.membershipNumber}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic p-2 bg-muted/20 rounded-xl">
          Nije dodijeljena odgovorna osoba.
        </p>
      )}
    </div>
  )
}

function InquiryAddModal({
  members,
  defaultProjectId,
  defaultProjectName,
  onClose,
  onSuccess,
}: {
  members: any[]
  defaultProjectId?: string
  defaultProjectName?: string
  onClose: () => void
  onSuccess: () => void
}) {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    requester_name: "",
    requester_email: "",
    requester_contact: "",
    inquiry_date: new Date().toISOString().slice(0, 10),
    subject: "",
    inquiry_text: "",
    assigned_to_id: "" as any,
    assigned_date: "",
    priority: "normal",
    status: "unassigned",
    external_link: "",
    notes: "",
    project_id: defaultProjectId || "",
    project_name: defaultProjectName || "",
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
          uploaded.push({
            id: generateId(),
            name: data.name,
            url: data.url,
            fileType: data.fileType,
            size: data.size,
          })
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
        requester_email:
          formData.requester_email.trim() || extractEmailFromText(formData.requester_contact),
        requester_contact:
          formData.requester_contact.trim() || formData.requester_email.trim(),
        assigned_to_id: formData.assigned_to_id ? Number(formData.assigned_to_id) : null,
        assigned_to_name: assignedMember ? assignedMember.name : null,
        status:
          formData.status === "unassigned" && assignedMember ? "active" : formData.status,
        attachments,
        created_by: user?.name || "Administrator",
      }

      const res = await fetch("/api/projects/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
            <p className="text-xs text-muted-foreground mt-0.5">
              Unesite pristigli upit građana ili institucije
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Ime i prezime podnositelja *
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
                E-mail adresa podnositelja
              </label>
              <Input
                type="email"
                placeholder="npr. marko@email.com"
                value={formData.requester_email}
                onChange={(e) => setFormData({ ...formData, requester_email: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Telefon / Dodatni kontakt
              </label>
              <Input
                placeholder="npr. 091 123 4567"
                value={formData.requester_contact}
                onChange={(e) => setFormData({ ...formData, requester_contact: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Datum kada je upit zaprimljen *
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
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">1. Zaprimljeno (Nedodijeljeno)</SelectItem>
                  <SelectItem value="active">2. U radu (Dodijeljeno)</SelectItem>
                  <SelectItem value="completed">3. Završeno</SelectItem>
                  <SelectItem value="rejected">Odbijeno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Prioritet
              </label>
              <Select
                value={formData.priority}
                onValueChange={(v) => setFormData({ ...formData, priority: v })}
              >
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
              Naslov istraživanja (Predmet) *
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
              Tekst upita *
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

          <div className="space-y-4 border-t border-border pt-4">
            <MemberSearchPicker
              members={members}
              selectedMemberId={formData.assigned_to_id ? Number(formData.assigned_to_id) : null}
              selectedMemberName={null}
              onSelect={(m) => {
                setFormData({
                  ...formData,
                  assigned_to_id: m ? String(m.id) : "",
                  assigned_date: m ? new Date().toISOString().slice(0, 10) : "",
                  status: m ? "active" : "unassigned",
                })
              }}
              label="Zadužena odgovorna osoba (Ostavite prazno ako je samo zaprimljeno)"
            />

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
              <input
                type="file"
                ref={fileRef}
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="h-8 rounded-full text-xs"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Upload className="h-3.5 w-3.5 mr-1" />
                )}
                Prenesi datoteke
              </Button>
            </div>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 bg-muted/50 border border-border px-2.5 py-1 rounded-lg text-xs"
                  >
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
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-full px-6"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Spremi upit
          </Button>
        </div>
      </div>
    </div>
  )
}

function buildDefaultEmailContent(
  type: "to_researcher" | "to_requester_wait",
  inquiry: ResearchInquiry,
  assignedMember: any | null
): { to: string; cc: string; subject: string; messageHtml: string } {
  const requesterEmail =
    (inquiry.requester_email || "").trim() || extractEmailFromText(inquiry.requester_contact)
  const researcherEmail = (assignedMember?.email || "").trim()
  const researcherName = assignedMember?.name || inquiry.assigned_to_name || "kolega/ice"
  const formattedDate = formatDateHr(inquiry.inquiry_date)
  const attachmentsCount = (inquiry.attachments || []).length

  if (type === "to_researcher") {
    const to = researcherEmail
    const cc = requesterEmail
    const subject = inquiry.subject.toLowerCase().startsWith("upit")
      ? inquiry.subject
      : `Upit za rodoslovno istraživanje: ${inquiry.subject}`

    const escapedText = escapeHtml(inquiry.inquiry_text).replace(/\n/g, "<br/>")
    const attachmentNote =
      attachmentsCount > 0
        ? `<p style="margin:12px 0;padding:10px 14px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;font-size:13px;color:#92400e;">📎 <strong>Privitci uz upit:</strong> U privitku ovog e-maila nalaze se sve datoteke i dokumenti iz izvornog upita (${attachmentsCount} ${
            attachmentsCount === 1 ? "datoteka" : "datoteka/e"
          }).</p>`
        : ""

    const messageHtml = `
<p>Poštovani/a <strong>${escapeHtml(researcherName)}</strong>,</p>
<p>prosljeđujemo Vam zaprimljeni upit za rodoslovno istraživanje koji je uputio/la <strong>${escapeHtml(
      inquiry.requester_name
    )}</strong> (datum zaprimanja: ${escapeHtml(formattedDate)}).</p>
<p>Osoba koja je poslala upit (<strong>${escapeHtml(inquiry.requester_name)}</strong>${
      requesterEmail ? `, <a href="mailto:${escapeHtml(requesterEmail)}">${escapeHtml(requesterEmail)}</a>` : ""
    }) stavljena je u kopiju (<strong>CC</strong>) ovog e-maila kako biste bili izravno povezani i kako biste sav daljnji dogovor oko istraživanja mogli nastaviti međusobno.</p>

<div style="margin:16px 0;padding:16px 18px;background-color:#f8fafc;border:1px solid #cbd5e1;border-left:4px solid #b45309;border-radius:8px;">
  <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#92400e;margin-bottom:8px;">
    Podaci o zaprimljenom upitu
  </div>
  <p style="margin:4px 0;font-size:13.5px;"><strong>Podnositelj upita:</strong> ${escapeHtml(
    inquiry.requester_name
  )}</p>
  <p style="margin:4px 0;font-size:13.5px;"><strong>Kontakt / E-mail:</strong> ${escapeHtml(
    inquiry.requester_contact || requesterEmail || "—"
  )}</p>
  <p style="margin:4px 0;font-size:13.5px;"><strong>Datum zaprimanja:</strong> ${escapeHtml(
    formattedDate
  )}</p>
  <p style="margin:4px 0 10px 0;font-size:13.5px;"><strong>Naslov / Predmet:</strong> ${escapeHtml(
    inquiry.subject
  )}</p>
  <div style="padding-top:10px;border-top:1px dashed #cbd5e1;font-size:13.5px;line-height:1.6;color:#1e293b;">
    <strong>Tekst upita:</strong><br/>
    ${escapedText}
  </div>
</div>
${attachmentNote}
<p>Zahvaljujemo na preuzimanju upita i angažmanu u radu Društva!</p>
<p>Srdačan pozdrav,</p>`.trim()

    return { to, cc, subject, messageHtml }
  } else {
    const to = requesterEmail
    const cc = ""
    const subject = inquiry.subject.toLowerCase().startsWith("re:")
      ? inquiry.subject
      : `Re: ${inquiry.subject}`

    const messageHtml = `
<p>Poštovani/a <strong>${escapeHtml(inquiry.requester_name)}</strong>,</p>
<p>najljepše Vam zahvaljujemo na javljanju i upitu upućenom Hrvatskom rodoslovnom društvu „Pavao Ritter Vitezović”.</p>
<p>Ovim putem potvrđujemo da smo Vaš upit (<em>„${escapeHtml(
      inquiry.subject
    )}”</em>) uredno zaprimili i evidentirali u našem sustavu.</p>
<p>Budući da smo zbog velikog broja pristiglih upita i volonterske prirode rada trenutno potkapacitirani, Vaš ćemo upit proslijediti <strong>prvom slobodnom istraživaču</strong> čim se za to oslobode kapaciteti.</p>
<p>Kada Vaš upit dodijelimo istraživaču, o tome ćete automatski dobiti obavijest na način da ćete se nalaziti u kopiji (<strong>CC</strong>) tog e-maila prema istraživaču, a nakon toga sav daljnji dogovor i komunikaciju odrađujete izravno s osobom kojoj je Vaš upit dodijeljen.</p>
<p>Zahvaljujemo Vam na razumijevanju i strpljenju!</p>
<p>Srdačan pozdrav,</p>`.trim()

    return { to, cc, subject, messageHtml }
  }
}

function InquirySendEmailModal({
  emailType,
  inquiry,
  members,
  selectedMember,
  onSelectMember,
  onClose,
  onSuccess,
}: {
  emailType: "to_researcher" | "to_requester_wait"
  inquiry: ResearchInquiry
  members: any[]
  selectedMember: any | null
  onSelectMember: (m: any | null) => void
  onClose: () => void
  onSuccess: (updatedInquiry: ResearchInquiry) => void
}) {
  const { user } = useAuth()
  const editorRef = useRef<HTMLDivElement | null>(null)

  const defaults = useMemo(
    () => buildDefaultEmailContent(emailType, inquiry, selectedMember),
    [emailType, inquiry, selectedMember]
  )

  const [to, setTo] = useState(defaults.to)
  const [cc, setCc] = useState(defaults.cc)
  const [subject, setSubject] = useState(defaults.subject)
  const [includeAttachments, setIncludeAttachments] = useState(emailType === "to_researcher")
  const [sending, setSending] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [testEmail, setTestEmail] = useState("")
  const [testSuccessMsg, setTestSuccessMsg] = useState("")
  const [error, setError] = useState("")
  const [donationPreviewHtml, setDonationPreviewHtml] = useState<string>("")
  const [officialMailbox, setOfficialMailbox] = useState<string>("rodoslovlje@rodoslovlje.hr")

  useEffect(() => {
    try {
      const savedTestEmail = localStorage.getItem("hrd_inquiry_test_email")
      if (savedTestEmail) {
        setTestEmail(savedTestEmail)
      } else if (user?.email) {
        setTestEmail(user.email)
      }
    } catch {
      if (user?.email) setTestEmail(user.email)
    }
  }, [user?.email])

  useEffect(() => {
    const nextDefaults = buildDefaultEmailContent(emailType, inquiry, selectedMember)
    setTo(nextDefaults.to)
    setCc(nextDefaults.cc)
    setSubject(nextDefaults.subject)
    if (editorRef.current) {
      editorRef.current.innerHTML = nextDefaults.messageHtml
    }
  }, [selectedMember, emailType, inquiry])

  useEffect(() => {
    fetch("/api/projects/inquiries?action=donation-preview")
      .then((r) => r.json())
      .then((data) => {
        if (data.donationBlockHtml) setDonationPreviewHtml(data.donationBlockHtml)
        if (data.officialMailbox) setOfficialMailbox(data.officialMailbox)
      })
      .catch(() => {})
  }, [])

  const handleSendTest = async () => {
    const targetTestEmail = (testEmail || user?.email || officialMailbox || "").trim()
    if (!targetTestEmail) {
      setError("Unesite e-mail adresu administratora na koju želite poslati TEST poruku.")
      return
    }
    try {
      localStorage.setItem("hrd_inquiry_test_email", targetTestEmail)
    } catch {}

    setSendingTest(true)
    setError("")
    setTestSuccessMsg("")
    try {
      const currentMessageHtml = editorRef.current?.innerHTML || defaults.messageHtml
      const res = await fetch("/api/projects/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send-email",
          id: inquiry.id,
          emailType,
          isTest: true,
          testEmail: targetTestEmail,
          to: targetTestEmail,
          subject: subject.trim(),
          messageHtml: currentMessageHtml,
          includeDonationBlock: true,
          includeAttachments,
          sender: user
            ? {
                userId: user.id,
                userName: user.name,
                userRole: user.role,
              }
            : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Greška pri slanju TEST e-maila.")
      }
      setTestSuccessMsg(`TEST e-mail je uspješno poslan na ${targetTestEmail} (bez slanja podnositelju u CC).`)
    } catch (e: any) {
      setError(e.message || "Greška pri slanju TEST e-maila.")
    } finally {
      setSendingTest(false)
    }
  }

  const handleSend = async () => {
    if (!to.trim()) {
      setError(
        emailType === "to_researcher"
          ? "Odaberite istraživača ili unesite e-mail adresu primatelja (Za)."
          : "Unesite e-mail adresu osobe koja je poslala upit (Za)."
      )
      return
    }
    setSending(true)
    setError("")
    try {
      const currentMessageHtml = editorRef.current?.innerHTML || defaults.messageHtml
      const res = await fetch("/api/projects/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send-email",
          id: inquiry.id,
          emailType,
          to: to.trim(),
          cc: cc.trim() || undefined,
          subject: subject.trim(),
          messageHtml: currentMessageHtml,
          includeDonationBlock: true,
          includeAttachments,
          assigned_to_id: selectedMember ? selectedMember.id : inquiry.assigned_to_id,
          assigned_to_name: selectedMember ? selectedMember.name : inquiry.assigned_to_name,
          sender: user
            ? {
                userId: user.id,
                userName: user.name,
                userRole: user.role,
              }
            : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Greška pri slanju e-maila.")
      }
      onSuccess(data.inquiry)
    } catch (e: any) {
      setError(e.message || "Greška pri slanju e-maila.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-background border border-border rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div
          className={`px-6 py-4 border-b border-border flex items-center justify-between ${
            emailType === "to_researcher"
              ? "bg-amber-950 text-white"
              : "bg-[#1B2B36] text-white"
          }`}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-[#CEA369] shrink-0" />
              <h3 className="font-serif text-lg font-bold truncate">
                {emailType === "to_researcher"
                  ? "Slanje upita i privitaka istraživaču (Podnositelj u CC)"
                  : "Slanje odgovora podnositelju (Potvrda primitka / Na čekanju istraživača)"}
              </h3>
            </div>
            <p className="text-[11px] text-white/75 mt-0.5">
              Šalje se sa službenog sandučića ({officialMailbox}) • Ostaje vidljiv trag u INBOXU i u ovom istraživanju
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {emailType === "to_researcher" && (
            <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-3.5">
              <MemberSearchPicker
                members={members}
                selectedMemberId={selectedMember?.id || inquiry.assigned_to_id}
                selectedMemberName={selectedMember?.name || inquiry.assigned_to_name}
                onSelect={(m) => onSelectMember(m)}
                label="Odaberite istraživača kojem prosljeđujete ovaj upit"
              />
            </div>
          )}

          {/* Recipients */}
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            <div className="flex items-center px-4 py-2.5 gap-3">
              <span className="text-xs font-bold uppercase text-muted-foreground w-20 shrink-0">
                Za (To):
              </span>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder={
                  emailType === "to_researcher"
                    ? "E-mail istraživača..."
                    : "E-mail osobe koja je poslala upit..."
                }
                className="flex-1 text-sm font-semibold bg-transparent outline-none"
              />
              <Badge variant="outline" className="text-[10px] shrink-0">
                {emailType === "to_researcher" ? "Istraživač" : "Podnositelj upita"}
              </Badge>
            </div>

            <div className="flex items-center px-4 py-2.5 gap-3 bg-muted/20">
              <span className="text-xs font-bold uppercase text-muted-foreground w-20 shrink-0">
                CC (Kopija):
              </span>
              <input
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder={
                  emailType === "to_researcher"
                    ? "E-mail osobe koja je poslala upit (automatski u CC)..."
                    : "Opcionalno (kopija)..."
                }
                className="flex-1 text-sm bg-transparent outline-none"
              />
              {emailType === "to_researcher" && (
                <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] shrink-0">
                  Osoba s upita u CC
                </Badge>
              )}
            </div>

            <div className="flex items-center px-4 py-2.5 gap-3">
              <span className="text-xs font-bold uppercase text-muted-foreground w-20 shrink-0">
                Naslov:
              </span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex-1 text-sm font-medium bg-transparent outline-none"
              />
            </div>
          </div>

          {/* Attachments toggle for researcher email */}
          {inquiry.attachments && inquiry.attachments.length > 0 && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="h-4 w-4 text-amber-700 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-900">
                    Privitci iz upita ({inquiry.attachments.length}):{" "}
                  </span>
                  <span className="text-muted-foreground">
                    {inquiry.attachments.map((a) => a.name).join(", ")}
                  </span>
                </div>
              </div>
              <label className="flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={includeAttachments}
                  onChange={(e) => setIncludeAttachments(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Priloži u e-mail
              </label>
            </div>
          )}

          {/* Editable Message HTML */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
              Sadržaj poruke (možete slobodno prilagoditi prije slanja):
            </label>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              dangerouslySetInnerHTML={{ __html: defaults.messageHtml }}
              className="min-h-[200px] rounded-2xl border border-border bg-white p-4 text-sm text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20 prose prose-sm max-w-none"
            />
          </div>

          {/* Automatic Support & Donation Block Preview */}
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/20 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                Unificirani blok za podršku, donaciju (50,00 EUR + 2D HUB-3A barkod) i službeni potpis Društva
              </span>
              <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-900 bg-white">
                Unificirano s Donacije &amp; kampanje
              </Badge>
            </div>
            {donationPreviewHtml ? (
              <div
                className="bg-white rounded-xl border border-border p-4 overflow-x-auto text-xs"
                dangerouslySetInnerHTML={{ __html: donationPreviewHtml }}
              />
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Učitavanje pregleda donacijskog bloka, 2D barkoda i potpisa...
              </p>
            )}
          </div>

          {testSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{testSuccessMsg}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer with TEST email option & Official Send button */}
        <div className="p-4 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground">
              Test na mail:
            </span>
            <Input
              type="email"
              placeholder={user?.email || "npr. admin@rodoslovlje.hr"}
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="h-9 text-xs font-mono bg-background"
              title="E-mail adresa administratora ili vlastita adresa za probno slanje"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={sendingTest || sending}
              onClick={handleSendTest}
              className="h-9 shrink-0 rounded-full px-4 font-semibold border border-border shadow-2xs"
            >
              {sendingTest ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Mail className="h-3.5 w-3.5 mr-1.5" />
              )}
              Pošalji TEST
            </Button>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-full h-9">
              Odustani
            </Button>
            <Button
              type="button"
              onClick={handleSend}
              disabled={sending || sendingTest}
              className="rounded-full h-9 px-6 gap-2 bg-[#0b57d0] hover:bg-[#0842a0] text-white font-semibold shadow-md"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Slanje službenog maila..." : "Pošalji službeni e-mail"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function InquiryDetailModal({
  inquiry,
  canEdit,
  inqPerms,
  members,
  onClose,
  onRefresh,
}: {
  inquiry: ResearchInquiry
  canEdit: boolean
  inqPerms?: InquiryPermissions
  members: any[]
  onClose: () => void
  onRefresh: () => void
}) {
  const [form, setForm] = useState<ResearchInquiry>({
    ...inquiry,
    status: inquiry.status === "pending" ? "unassigned" : inquiry.status,
    requester_email:
      inquiry.requester_email || extractEmailFromText(inquiry.requester_contact),
  })
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [emailModalType, setEmailModalType] = useState<"to_researcher" | "to_requester_wait" | null>(
    null
  )
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setForm({
      ...inquiry,
      status: inquiry.status === "pending" ? "unassigned" : inquiry.status,
      requester_email:
        inquiry.requester_email || extractEmailFromText(inquiry.requester_contact),
    })
  }, [inquiry])

  const assignedMember = useMemo(() => {
    return (
      members.find(
        (m) => m.id === Number(form.assigned_to_id) || m.name === form.assigned_to_name
      ) || null
    )
  }, [members, form.assigned_to_id, form.assigned_to_name])

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
          uploaded.push({
            id: generateId(),
            name: ret.name,
            url: ret.url,
            fileType: ret.fileType,
            size: ret.size,
          })
        }
      }
      setForm({ ...form, attachments: uploaded })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const handleSave = async (closeAfterSave = true) => {
    setIsSaving(true)
    try {
      const memberObj = members.find((m) => m.id === Number(form.assigned_to_id))
      const payload = {
        ...form,
        action: "update",
        assigned_to_id: form.assigned_to_id ? Number(form.assigned_to_id) : null,
        assigned_to_name: memberObj ? memberObj.name : form.assigned_to_name,
      }

      const res = await fetch("/api/projects/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.inquiry) {
          setForm(data.inquiry)
        }
        onRefresh()
        if (closeAfterSave) {
          onClose()
        }
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
        body: JSON.stringify({ action: "delete", id: form.id }),
      })
      if (res.ok) {
        onRefresh()
        onClose()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const emailLogs = form.email_logs || []
  const normStatus = form.status === "pending" ? "unassigned" : form.status

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-background border border-border rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-start justify-between gap-4 bg-card">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  STATUS_CONFIG[normStatus]?.cls
                }`}
              >
                {STATUS_CONFIG[normStatus]?.label}
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  PRIORITY_CONFIG[form.priority]?.cls
                }`}
              >
                {PRIORITY_CONFIG[form.priority]?.label} prioritet
              </span>
              {form.gmail_message_id && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  <Mail className="h-3 w-3" /> Kreirano iz Gmail Inboxa
                </span>
              )}
            </div>
            {!canEdit && (
              <div className="inline-flex items-center gap-1.5 mb-2 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs font-medium">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-700" />
                <span>Pristup samo za pregled – faza je zaključana za uređivanje prema vašim ovlastima</span>
              </div>
            )}
            <h2 className="font-serif text-xl md:text-2xl font-bold text-primary leading-tight">
              {form.subject}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Podnositelj: <strong className="text-foreground">{form.requester_name}</strong>
              {form.requester_email ? ` (${form.requester_email})` : ""} • Zaprimljeno:{" "}
              <strong>{formatDateHr(form.inquiry_date)}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted text-muted-foreground shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Status & Researcher Assignment + Official Emails Action Panel */}
          <div className="bg-gradient-to-r from-amber-50/90 via-amber-50/40 to-background border border-amber-200/90 rounded-2xl p-4 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                  Upravljanje zaduženjem i službena e-mail komunikacija
                </span>
                <h4 className="font-serif text-base font-bold text-amber-950">
                  Dodijelite istraživača i pošaljite službeni e-mail iz sustava
                </h4>
              </div>

              {/* Quick 3-status switcher */}
              {canEdit && (
                <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-white p-1 border border-border shadow-2xs">
                  {(["unassigned", "active", "completed"] as const).map((st) => {
                    const cat = getInquiryStatusCategory(st)
                    const canSwitch = !inqPerms || inqPerms[cat]?.edit
                    if (!canSwitch) return null
                    const meta = STATUS_CONFIG[st]
                    const active = normStatus === st
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setForm({ ...form, status: st })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                          active
                            ? meta.cls + " shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${meta.dotCls}`} />
                        {meta.shortLabel}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Member Picker directly at the top for fast assignment */}
            <div id="assigned-picker-section">
              <MemberSearchPicker
                members={members}
                selectedMemberId={form.assigned_to_id ? Number(form.assigned_to_id) : null}
                selectedMemberName={form.assigned_to_name}
                onSelect={(m) => {
                  setForm({
                    ...form,
                    assigned_to_id: m ? m.id : null,
                    assigned_to_name: m ? m.name : null,
                    assigned_date:
                      m && !form.assigned_date
                        ? new Date().toISOString().slice(0, 10)
                        : m
                        ? form.assigned_date
                        : null,
                    status: m
                      ? form.status === "completed"
                        ? "completed"
                        : "active"
                      : "unassigned",
                  })
                }}
                disabled={!canEdit}
                label="Odgovorni istraživač (Odabirom osobe upit prelazi u status 'U radu')"
              />
            </div>

            {/* Two Official Email Buttons */}
            {canEdit && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-amber-200/60">
                <div className="rounded-xl bg-white border border-amber-300 p-3 flex flex-col justify-between gap-2.5 shadow-2xs">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                      <UserCheck className="h-4 w-4 text-amber-700 shrink-0" />
                      <span>1. Mail prema istraživaču (Podnositelj u CC)</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      Šalje sve podatke upita i sve privitke direktno odabranom istraživaču, dok je osoba koja je poslala upit u CC-u.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setEmailModalType("to_researcher")}
                    className="w-full rounded-xl gap-1.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Pripremi i pošalji mail istraživaču
                  </Button>
                </div>

                <div className="rounded-xl bg-white border border-slate-300 p-3 flex flex-col justify-between gap-2.5 shadow-2xs">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <Mail className="h-4 w-4 text-blue-700 shrink-0" />
                      <span>2. Mail osobi koja je poslala upit (Na čekanju)</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      Zahvala na upitu uz obavijest da smo trenutno potkapacitirani te da ćemo upit proslijediti prvom slobodnom istraživaču (uz CC).
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEmailModalType("to_requester_wait")}
                    className="w-full rounded-xl gap-1.5 border-blue-300 text-blue-800 hover:bg-blue-50 text-xs font-semibold"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Pripremi i pošalji odgovor podnositelju
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Section: Povijest poslanih e-mailova iz ovog istraživanja */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <History className="h-4 w-4 text-primary" />
                Evidencija poslanih e-mailova u ovom istraživanju ({emailLogs.length})
              </h4>
              <span className="text-[11px] text-muted-foreground">
                Svi poslani mailovi vidljivi su i u INBOXU
              </span>
            </div>

            {emailLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">
                Iz ovog istraživanja još nije poslan nijedan službeni e-mail.
              </p>
            ) : (
              <div className="space-y-2">
                {[...emailLogs].reverse().map((log) => {
                  const isExpanded = expandedLogId === log.id
                  const isToResearcher = log.type === "to_researcher"
                  return (
                    <div
                      key={log.id}
                      className="rounded-xl border border-border bg-white overflow-hidden shadow-2xs"
                    >
                      <div className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                isToResearcher
                                  ? "bg-amber-50 text-amber-900 border-amber-300"
                                  : "bg-sky-50 text-sky-900 border-sky-300"
                              }`}
                            >
                              <Send className="h-2.5 w-2.5" />
                              {isToResearcher
                                ? "Poslano istraživaču (Podnositelj u CC)"
                                : "Poslana obavijest podnositelju (Na čekanju)"}
                            </span>
                            <span className="text-muted-foreground font-medium">
                              {formatDateTimeHr(log.sent_at)}
                            </span>
                            <span className="text-slate-700 font-semibold">
                              • Poslao/la: {log.sent_by_name}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-0.5">
                            <span>
                              <strong>Za:</strong> {log.to}
                            </span>
                            {log.cc && (
                              <span>
                                <strong>CC:</strong> {log.cc}
                              </span>
                            )}
                            <span>
                              <strong>Naslov:</strong> {log.subject}
                            </span>
                            {log.attachments_names && log.attachments_names.length > 0 && (
                              <span className="text-amber-800 font-medium">
                                📎 Prilozi ({log.attachments_names.length}):{" "}
                                {log.attachments_names.join(", ")}
                              </span>
                            )}
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="h-7 px-2.5 text-xs gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {isExpanded ? "Sakrij mail" : "Pregledaj mail"}
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>

                      {isExpanded && (
                        <div className="p-4 border-t border-border bg-slate-50/50 overflow-x-auto">
                          <div
                            className="bg-white p-4 rounded-xl border border-border text-xs"
                            dangerouslySetInnerHTML={{ __html: log.html_body }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Section 1: Podnositelj i upit */}
          <div className="bg-muted/20 border border-border/80 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
              1. Podaci o zaprimljenom upitu
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">
                  Ime i prezime podnositelja:
                </span>
                {canEdit ? (
                  <Input
                    className="h-8 mt-1 text-xs font-semibold"
                    value={form.requester_name || ""}
                    onChange={(e) => setForm({ ...form, requester_name: e.target.value })}
                  />
                ) : (
                  <p className="font-semibold text-xs mt-0.5">{form.requester_name}</p>
                )}
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">
                  E-mail adresa podnositelja:
                </span>
                {canEdit ? (
                  <Input
                    className="h-8 mt-1 text-xs"
                    placeholder="email@primjer.hr"
                    value={form.requester_email || ""}
                    onChange={(e) => setForm({ ...form, requester_email: e.target.value })}
                  />
                ) : (
                  <p className="font-medium text-xs mt-0.5">
                    {form.requester_email || "Nije navedeno"}
                  </p>
                )}
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">
                  Kontakt / Telefon / Datum:
                </span>
                {canEdit ? (
                  <div className="flex gap-1.5 mt-1">
                    <Input
                      className="h-8 text-xs flex-1"
                      placeholder="Telefon / kontakt"
                      value={form.requester_contact || ""}
                      onChange={(e) => setForm({ ...form, requester_contact: e.target.value })}
                    />
                    <Input
                      type="date"
                      className="h-8 text-xs w-36"
                      value={form.inquiry_date || ""}
                      onChange={(e) => setForm({ ...form, inquiry_date: e.target.value })}
                    />
                  </div>
                ) : (
                  <p className="font-medium text-xs mt-0.5">
                    {form.requester_contact || "—"} ({formatDateHr(form.inquiry_date)})
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <span className="text-xs text-muted-foreground block">
                  Naslov istraživanja (Predmet):
                </span>
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
              <div>
                <span className="text-xs text-muted-foreground block">Prioritet:</span>
                {canEdit ? (
                  <Select
                    value={form.priority}
                    onValueChange={(v: any) => setForm({ ...form, priority: v })}
                  >
                    <SelectTrigger className="h-8 mt-1 text-xs bg-background">
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
                  <Badge variant="outline" className="mt-1">
                    {PRIORITY_CONFIG[form.priority]?.label}
                  </Badge>
                )}
              </div>
            </div>

            <div>
              <span className="text-xs text-muted-foreground block mb-1">
                Izvorni tekst upita (body maila):
              </span>
              {canEdit ? (
                <textarea
                  rows={5}
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs focus:outline-none leading-relaxed"
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

          {/* Section 2: Prilozi i dokumentacija iz upita */}
          <div className="bg-muted/20 border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                2. Prilozi iz upita i dokumentacija ({(form.attachments || []).length})
              </h4>
              {canEdit && (
                <>
                  <input
                    type="file"
                    ref={fileRef}
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="h-7 text-xs rounded-full"
                  >
                    {uploading ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Upload className="h-3 w-3 mr-1" />
                    )}
                    Dodaj prilog
                  </Button>
                </>
              )}
            </div>

            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">
                Vanjski link na mapu / online arhivu:
              </label>
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
                <span className="text-xs font-semibold text-muted-foreground block">
                  Spremljene datoteke (automatski se šalju istraživaču kod prosljeđivanja):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {form.attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-xl border border-border bg-background text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate font-medium">{att.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={att.name}
                          className="p-1 text-primary hover:bg-muted rounded"
                          title="Preuzmi datoteku"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() =>
                              setForm({
                                ...form,
                                attachments: form.attachments.filter((_, i) => i !== idx),
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

          {/* Section 3: Istraživački rad i nalazi */}
          <div className="bg-emerald-50/20 border border-emerald-200/50 rounded-2xl p-4 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
              3. Istraživački rad, zabilješke i konačni rezultat
            </h4>

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
                <p className="text-xs whitespace-pre-wrap">
                  {form.researcher_response || "Nema odgovora."}
                </p>
              )}
            </div>

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
                <p className="text-xs whitespace-pre-wrap">
                  {form.actions_taken || "Nije zabilježeno."}
                </p>
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
                <p className="text-xs whitespace-pre-wrap">
                  {form.collected_documents || "Nema popisa dokumenata."}
                </p>
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
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-muted/10">
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="text-red-600 hover:bg-red-50 rounded-full text-xs"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Obriši upit
            </Button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-full">
              Zatvori
            </Button>
            {canEdit && (
              <Button
                type="button"
                onClick={() => handleSave(true)}
                disabled={isSaving}
                className="rounded-full px-6"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Spremi promjene
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Email Preparation & Sending Sub-Modal */}
      {emailModalType && (
        <InquirySendEmailModal
          emailType={emailModalType}
          inquiry={form}
          members={members}
          selectedMember={assignedMember}
          onSelectMember={(m) => {
            setForm((prev) => ({
              ...prev,
              assigned_to_id: m ? m.id : null,
              assigned_to_name: m ? m.name : null,
              assigned_date:
                m && !prev.assigned_date
                  ? new Date().toISOString().slice(0, 10)
                  : prev.assigned_date,
              status: m ? "active" : prev.status,
            }))
          }}
          onClose={() => setEmailModalType(null)}
          onSuccess={(updatedInquiry) => {
            setForm(updatedInquiry)
            setEmailModalType(null)
            onRefresh()
          }}
        />
      )}
    </div>
  )
}
