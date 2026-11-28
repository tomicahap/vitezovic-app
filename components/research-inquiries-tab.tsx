"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { toast } from "sonner"
import { confirmAction } from "@/components/ui/confirm-dialog"
import Link from "next/link"
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
  ArrowUpDown,
  MessageSquareText,
  Lock,
  FlaskConical,
  Star,
  HeartHandshake,
  Award,
  UserPlus,
  GitMerge,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DateOrYearInput } from "@/components/ui/date-or-year-input"
import {
  ACTION_BUTTON_STYLES,
  CloseActionButton,
  DeleteActionButton,
  FinishActionButton,
  ModalActionFooter,
  SaveActionButton,
} from "@/components/ui/action-bar"
import { SectionTabsBar, type SectionTabItem } from "@/components/ui/section-tabs"
import { useAuth } from "@/contexts/auth-context"
import { useMembers } from "@/contexts/members-context"
import { useSettings } from "@/contexts/settings-context"
import {
  InquiryCloseCaseModal,
  type InquiryCloseDispatchResult,
} from "@/components/inquiry-close-case-modal"
import { InquiryFeedbackEmailModal } from "@/components/inquiry-feedback-email-modal"
import { InquiryFeedbackStatsPanel } from "@/components/inquiry-feedback-stats"
import { InquiryMergeModal } from "@/components/inquiry-merge-modal"
import {
  compareInquiriesFifo,
  formatBytesCompact,
  getInquiryWaitingDays,
  MAX_GMAIL_TOTAL_ATTACHMENTS_BYTES,
  sumAttachmentsSize,
  type InquiryAttachment,
  type InquirySourceMessage,
} from "@/lib/inquiry-grouping"
import {
  getFinancialSupportLabel,
  INQUIRY_FEEDBACK_QUESTIONS,
  type InquiryFeedbackRecord,
} from "@/lib/inquiry-feedback"
import { generateId, formatDateDMY, formatDateTimeDMY, resolveSenderSignoff, buildClientSenderIdentity } from "@/lib/utils"
import { inspectMemberDate } from "@/lib/date-validation"
import {
  getInquiryCaseCapabilities,
  getInquiryPermissions,
  getInquiryStatusCategory,
  isInquiryAssignedToUser,
  type InquiryPermissions,
} from "@/lib/inquiry-permissions"

export interface InquiryEmailLog {
  id: string
  type:
    | "to_researcher"
    | "to_researcher_supplement"
    | "to_requester_wait"
    | "to_requester_check"
    | "requester_status_response"
    | "case_closed_requester"
    | "case_closed_researcher"
    | "case_closed_archive"
    | "satisfaction_survey"
    | "custom"
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
  response_date?: string | null
  response_text?: string | null
  response_recorded_at?: string | null
  response_recorded_by?: string | null
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
  attachments: InquiryAttachment[]
  source_messages?: InquirySourceMessage[]
  email_logs?: InquiryEmailLog[]
  feedback?: InquiryFeedbackRecord | null
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

function getInquiryAuthHeaders(user: any): Record<string, string> {
  if (!user) return {}
  return {
    "x-user-id": String(user.id ?? ""),
    "x-user-role": String(user.role ?? ""),
    "x-user-email": String(user.email ?? ""),
  }
}

function getInquiryActorPayload(user: any) {
  if (!user) return undefined
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    email: user.email,
  }
}

export function ResearchInquiriesTab({
  projectId,
  projectName,
  initialInquiryId,
  initialViewTab = "inquiries",
  openedFromGmail = false,
  justCreatedFromGmail = false,
  justAttachedFromGmail = false,
  attachedMessageId = null,
  onClearInitialInquiry,
}: {
  projectId?: string
  projectName?: string
  initialInquiryId?: number | null
  initialViewTab?: "inquiries" | "satisfaction"
  openedFromGmail?: boolean
  justCreatedFromGmail?: boolean
  justAttachedFromGmail?: boolean
  attachedMessageId?: string | null
  onClearInitialInquiry?: () => void
} = {}) {
  const { user } = useAuth()
  const { members } = useMembers()
  const { settings } = useSettings()

  const isAdminUser = String(user?.role || "").toLowerCase() === "admin"
  const inqPerms = useMemo(() => getInquiryPermissions(user), [user])
  const canCreate = inqPerms.zaprimljeno.edit || inqPerms.canEditAny

  const [activeViewTab, setActiveViewTab] = useState<"inquiries" | "satisfaction">(initialViewTab)
  const [inquiries, setInquiries] = useState<ResearchInquiry[]>([])
  const [externalResearchers, setExternalResearchers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "unassigned" | "active" | "completed" | "rejected">("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [onlyMineFilter, setOnlyMineFilter] = useState(false)
  const [sortOrder, setSortOrder] = useState<"fifo" | "newest">("fifo")
  const [viewMode, setViewMode] = useState<"grid" | "board">("board")
  const [selectedInquiry, setSelectedInquiry] = useState<ResearchInquiry | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [mergeModalState, setMergeModalState] = useState<{ open: boolean; targetId: number | null }>({
    open: false,
    targetId: null,
  })
  const [feedbackModalInquiry, setFeedbackModalInquiry] = useState<ResearchInquiry | null>(null)
  const [feedbackRefreshKey, setFeedbackRefreshKey] = useState(0)
  const [gmailTransferNotice, setGmailTransferNotice] = useState<{
    inquiryId: number
    created: boolean
    attached?: boolean
    attachedMessageId?: string | null
  } | null>(null)
  const handledInitialInquiryIdRef = useRef<number | null>(null)

  useEffect(() => {
    setActiveViewTab(initialViewTab)
  }, [initialViewTab])

  const submittedFeedbackCount = useMemo(
    () => inquiries.filter((i) => Boolean(i.feedback?.submitted_at)).length,
    [inquiries]
  )

  const fetchInquiries = async () => {
    setIsLoading(true)
    try {
      const url = projectId
        ? `/api/projects/inquiries?projectId=${encodeURIComponent(projectId)}`
        : "/api/projects/inquiries"
      const res = await fetch(url, {
        cache: "no-store",
        headers: getInquiryAuthHeaders(user),
      })
      if (res.ok) {
        const data = await res.json()
        const list: ResearchInquiry[] = data.inquiries || []
        setInquiries(list)
        setSelectedInquiry((prev) => (prev ? list.find((i) => i.id === prev.id) || prev : null))
      }
    } catch (e) {
      console.error("Greška pri dohvatu upita:", e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchInquiries()
  }, [projectId, user?.id])

  useEffect(() => {
    if (!user || user.role === "external") {
      setExternalResearchers([])
      return
    }
    const canFetchResearchers =
      user.role === "admin" ||
      user.role === "moderator" ||
      inqPerms.canViewAny ||
      inqPerms.canEditAny
    if (!canFetchResearchers) return

    let cancelled = false
    fetch("/api/admin/external-users?scope=researchers", {
      cache: "no-store",
      headers: getInquiryAuthHeaders(user),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.externalUsers)) {
          setExternalResearchers(data.externalUsers)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user?.id, user?.role, inqPerms.canViewAny, inqPerms.canEditAny])

  const researcherCandidates = useMemo(
    () => [...members, ...externalResearchers],
    [members, externalResearchers]
  )

  const canViewSatisfactionTab =
    user?.role !== "external" ||
    inqPerms.canEditAny ||
    inqPerms.zaprimljeno.view ||
    inqPerms.uradu.view ||
    inqPerms.zavrseno.view

  useEffect(() => {
    if (!initialInquiryId) {
      handledInitialInquiryIdRef.current = null
      return
    }
    if (isLoading || handledInitialInquiryIdRef.current === initialInquiryId) {
      return
    }

    const found = inquiries.find((i) => i.id === initialInquiryId)
    if (found) {
      handledInitialInquiryIdRef.current = initialInquiryId
      setSelectedInquiry(found)
      if (openedFromGmail) {
        setGmailTransferNotice({
          inquiryId: found.id,
          created: Boolean(justCreatedFromGmail),
          attached: Boolean(justAttachedFromGmail),
          attachedMessageId,
        })
      }
      return
    }

    if (!user) return

    let cancelled = false
    handledInitialInquiryIdRef.current = initialInquiryId
    ;(async () => {
      try {
        const res = await fetch(`/api/projects/inquiries?id=${initialInquiryId}`, {
          cache: "no-store",
          headers: getInquiryAuthHeaders(user),
        })
        if (!res.ok || cancelled) return
        const single: ResearchInquiry = await res.json()
        if (!single?.id || cancelled) return
        setInquiries((prev) => (prev.some((i) => i.id === single.id) ? prev : [single, ...prev]))
        setSelectedInquiry(single)
        if (openedFromGmail) {
          setGmailTransferNotice({
            inquiryId: single.id,
            created: Boolean(justCreatedFromGmail),
            attached: Boolean(justAttachedFromGmail),
            attachedMessageId,
          })
        }
      } catch (e) {
        console.error("Greška pri izravnom otvaranju predmeta:", e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [initialInquiryId, openedFromGmail, justCreatedFromGmail, justAttachedFromGmail, attachedMessageId, inquiries, isLoading, user])

  const myAssignedCount = useMemo(
    () => inquiries.filter((i) => isInquiryAssignedToUser(i, user)).length,
    [inquiries, user]
  )
  const canView = inqPerms.canViewAny || myAssignedCount > 0

  const filteredInquiries = useMemo(() => {
    const filtered = inquiries.filter((inq) => {
      const q = search.toLowerCase()
      const assignedMember = members.find(
        (m) => m.id === inq.assigned_to_id || m.name === inq.assigned_to_name
      )
      const normStatus = inq.status === "pending" ? "unassigned" : inq.status

      const matchesSearch =
        !search ||
        String(inq.id).includes(q) ||
        inq.subject.toLowerCase().includes(q) ||
        inq.requester_name.toLowerCase().includes(q) ||
        (inq.requester_email && inq.requester_email.toLowerCase().includes(q)) ||
        (inq.requester_contact && inq.requester_contact.toLowerCase().includes(q)) ||
        (inq.assigned_to_name && inq.assigned_to_name.toLowerCase().includes(q)) ||
        (assignedMember &&
          ((assignedMember.email && assignedMember.email.toLowerCase().includes(q)) ||
            (assignedMember.phone && assignedMember.phone.toLowerCase().includes(q)))) ||
        (inq.inquiry_text && inq.inquiry_text.toLowerCase().includes(q)) ||
        (inq.research_result && inq.research_result.toLowerCase().includes(q)) ||
        (inq.source_messages || []).some(
          (m) =>
            (m.subject && m.subject.toLowerCase().includes(q)) ||
            (m.from_name && m.from_name.toLowerCase().includes(q)) ||
            (m.from_email && m.from_email.toLowerCase().includes(q)) ||
            (m.body_text && m.body_text.toLowerCase().includes(q))
        ) ||
        (inq.email_logs || []).some(
          (l) =>
            (l.response_text && l.response_text.toLowerCase().includes(q)) ||
            (l.subject && l.subject.toLowerCase().includes(q))
        )

      const cat = getInquiryStatusCategory(inq.status)
      const isMine = isInquiryAssignedToUser(inq, user)
      if (!inqPerms[cat]?.view && !isMine) return false
      if (onlyMineFilter && !isMine) return false

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "unassigned" && cat === "zaprimljeno") ||
        (statusFilter === "active" && cat === "uradu") ||
        (statusFilter === "completed" && ((inq.status as string) === "completed" || (inq.status as string) === "zavrseno")) ||
        (statusFilter === "rejected" && inq.status === "rejected") ||
        normStatus === statusFilter
      const matchesPriority = priorityFilter === "all" || inq.priority === priorityFilter

      return matchesSearch && matchesStatus && matchesPriority
    })

    return filtered.slice().sort((a, b) => {
      const cmp = compareInquiriesFifo(a, b)
      return sortOrder === "fifo" ? cmp : -cmp
    })
  }, [inquiries, search, statusFilter, priorityFilter, onlyMineFilter, sortOrder, members, inqPerms, user])

  const fifoQueueRankMap = useMemo(() => {
    const map = new Map<number, number>()
    const unassignedFifo = inquiries
      .filter((i) => getInquiryStatusCategory(i.status) === "zaprimljeno")
      .slice()
      .sort(compareInquiriesFifo)
    unassignedFifo.forEach((inq, idx) => {
      map.set(inq.id, idx + 1)
    })
    return map
  }, [inquiries])

  const visibleInquiries = useMemo(() => {
    return inquiries.filter(
      (i) => inqPerms[getInquiryStatusCategory(i.status)]?.view || isInquiryAssignedToUser(i, user)
    )
  }, [inquiries, inqPerms, user])

  const showZaprimljeno =
    inqPerms.zaprimljeno.view ||
    visibleInquiries.some((i) => getInquiryStatusCategory(i.status) === "zaprimljeno")
  const showUradu =
    inqPerms.uradu.view ||
    visibleInquiries.some((i) => getInquiryStatusCategory(i.status) === "uradu")
  const showZavrseno =
    inqPerms.zavrseno.view ||
    visibleInquiries.some((i) => getInquiryStatusCategory(i.status) === "zavrseno")

  const stats = useMemo(() => {
    return {
      total: visibleInquiries.length,
      unassigned: visibleInquiries.filter((i) => getInquiryStatusCategory(i.status) === "zaprimljeno").length,
      active: visibleInquiries.filter((i) => getInquiryStatusCategory(i.status) === "uradu").length,
      completed: visibleInquiries.filter((i) => (i.status as string) === "completed" || (i.status as string) === "zavrseno").length,
      rejected: visibleInquiries.filter((i) => i.status === "rejected").length,
    }
  }, [visibleInquiries])

  if (!isLoading && !canView) {
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
    const checkLogs = emailLogs.filter((l) => l.type === "to_requester_check")
    const sentCheckToRequester = checkLogs.length > 0
    const lastCheckLog = checkLogs.length > 0 ? checkLogs[checkLogs.length - 1] : null
    const responseLogs = emailLogs
      .filter((l) => Boolean(l.response_text && String(l.response_text).trim()))
      .sort((a, b) => (a.response_date || a.sent_at || "").localeCompare(b.response_date || b.sent_at || ""))
    const lastResponseLog = responseLogs.length > 0 ? responseLogs[responseLogs.length - 1] : null
    const awaitingCheckResponse = Boolean(lastCheckLog && !lastCheckLog.response_text?.trim())
    const requesterEmail = inq.requester_email || extractEmailFromText(inq.requester_contact)
    const sourceMessages = Array.isArray(inq.source_messages) ? inq.source_messages : []
    const groupedEmailCount = sourceMessages.length > 1 ? sourceMessages.length : 0
    const fifoRank = normStatus === "unassigned" ? fifoQueueRankMap.get(inq.id) : undefined
    const waitingDays =
      normStatus === "unassigned" || normStatus === "active"
        ? getInquiryWaitingDays(inq.inquiry_date)
        : null

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
            <div className="flex items-center gap-1.5 flex-wrap">
              {fifoRank !== undefined && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300 font-mono"
                  title={`FIFO redoslijed čekanja (#${fifoRank} po datumu zaprimanja)`}
                >
                  FIFO #{fifoRank}
                  {waitingDays !== null ? ` • ${waitingDays}d` : ""}
                </span>
              )}
              {isInquiryAssignedToUser(inq, user) && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300"
                  title="Ovaj predmet je dodijeljen vama — možete dodavati datoteke, upisivati bilješke i zatvoriti predmet"
                >
                  <UserCheck className="h-2.5 w-2.5" /> Moj predmet
                </span>
              )}
              {groupedEmailCount > 1 && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200"
                  title={`Grupirano ${groupedEmailCount} povezana e-maila u isti predmet`}
                >
                  <Mail className="h-2.5 w-2.5" /> {groupedEmailCount} e-maila
                </span>
              )}
              {inq.gmail_message_id && groupedEmailCount <= 1 && (
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

          {/* Oznake poslanih e-mailova i provjera statusa */}
          {(sentToResearcher || sentWaitToRequester || sentCheckToRequester || lastResponseLog) && (
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
              {sentCheckToRequester && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200"
                  title={`Podnositelju je poslan mail za provjeru statusa istraživanja (${formatDateHr(lastCheckLog?.sent_at)})`}
                >
                  <Clock className="h-2.5 w-2.5 text-amber-600" /> Provjera statusa ({formatDateHr(lastCheckLog?.sent_at)})
                </span>
              )}
              {lastResponseLog ? (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200"
                  title={`Evidentiran odgovor osobe (${formatDateHr(lastResponseLog.response_date || lastResponseLog.sent_at)})`}
                >
                  <MessageSquareText className="h-2.5 w-2.5 text-indigo-600" /> Odgovor osobe ({formatDateHr(lastResponseLog.response_date || lastResponseLog.sent_at)})
                </span>
              ) : awaitingCheckResponse ? (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-orange-50 text-orange-800 border border-orange-200"
                  title="Poslana je provjera statusa i čeka se unos datuma i odgovora osobe"
                >
                  <AlertCircle className="h-2.5 w-2.5 text-orange-600" /> Čeka odgovor na provjeru
                </span>
              ) : null}
            </div>
          )}

          {lastResponseLog && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-2.5 py-2 text-[11px] text-indigo-950">
              <div className="flex items-center justify-between gap-2 font-bold text-indigo-900 mb-0.5">
                <span className="truncate">
                  Opravdanje ({formatDateHr(lastResponseLog.response_date || lastResponseLog.sent_at)}):
                </span>
                {responseLogs.length > 1 && (
                  <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded shrink-0">
                    +{responseLogs.length - 1} ranijih
                  </span>
                )}
              </div>
              <p className="line-clamp-2 text-indigo-950/90 leading-snug">
                {lastResponseLog.response_text}
              </p>
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
              {inq.feedback?.submitted_at ? (
                <span
                  className="flex items-center gap-1 text-[#7C2D12] font-bold bg-[#FEFCE8] px-1.5 py-0.5 rounded border border-[#D97706]/50"
                  title={`Ocjena zadovoljstva naručitelja: ${Number(inq.feedback.average_rating || 0).toFixed(2)} / 5`}
                >
                  <Star className="h-3 w-3 fill-[#D97706] text-[#D97706]" />{" "}
                  {Number(inq.feedback.average_rating || 0).toFixed(1)}
                </span>
              ) : inq.feedback?.sent_at ? (
                <span
                  className="flex items-center gap-1 text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200"
                  title={`Anketa zadovoljstva poslana ${formatDateTimeHr(inq.feedback.sent_at)}`}
                >
                  <Star className="h-3 w-3 text-[#D97706]" /> Anketa poslana
                </span>
              ) : null}
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
          {activeViewTab === "inquiries" && (
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
          )}

          {user?.role === "admin" && !projectId && (
            <Link href="/settings?tab=access&subtab=external">
              <Button
                type="button"
                variant="outline"
                className="rounded-full gap-1.5 border-purple-300 bg-purple-50/70 text-purple-900 hover:bg-purple-100 font-semibold text-xs"
              >
                <UserPlus className="h-3.5 w-3.5" /> Vanjski suradnici
              </Button>
            </Link>
          )}

          {isAdminUser && activeViewTab === "inquiries" && inquiries.filter((i) => i.status !== "completed" && i.status !== "rejected").length >= 2 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setMergeModalState({ open: true, targetId: null })}
              className="rounded-full gap-1.5 border-indigo-300 bg-indigo-50/70 text-indigo-900 hover:bg-indigo-100 font-semibold text-xs"
              title="Spoji više otvorenih predmeta iste osobe u jedan jedinstveni predmet (samo Administrator)"
            >
              <GitMerge className="h-3.5 w-3.5" /> Spoji predmete
            </Button>
          )}

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

      {/* Glavni izbornik modula Istraživanja */}
      {!projectId && canViewSatisfactionTab && (
        <SectionTabsBar
          variant="page"
          value={activeViewTab}
          onValueChange={(v) => setActiveViewTab(v as "inquiries" | "satisfaction")}
          ariaLabel="Pregledi modula Istraživanja"
          tabs={[
            {
              id: "inquiries",
              label: "Predmeti istraživanja",
              shortLabel: "Predmeti",
              icon: FileText,
              count: inquiries.length,
            },
            {
              id: "satisfaction",
              label: "Zadovoljstvo korisnika",
              shortLabel: "Zadovoljstvo",
              icon: Star,
              count: submittedFeedbackCount,
              hasDot: submittedFeedbackCount > 0,
            },
          ]}
        />
      )}

      {activeViewTab === "satisfaction" && !projectId && canViewSatisfactionTab ? (
        <InquiryFeedbackStatsPanel
          user={user}
          getAuthHeaders={getInquiryAuthHeaders}
          refreshKey={feedbackRefreshKey}
          onOpenInquiryById={(inqId) => {
            const found = inquiries.find((i) => Number(i.id) === Number(inqId))
            if (found) setSelectedInquiry(found)
          }}
          onSendFeedbackForInquiryId={(inqId) => {
            const found = inquiries.find((i) => Number(i.id) === Number(inqId))
            if (found) setFeedbackModalInquiry(found)
          }}
        />
      ) : (
        <>
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

        {showZaprimljeno && (
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

        {showUradu && (
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

        {showZavrseno && (
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
          {myAssignedCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOnlyMineFilter((prev) => !prev)}
              className={`h-9 rounded-full text-xs font-semibold gap-1.5 ${
                onlyMineFilter
                  ? "bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800 hover:text-white"
                  : "border-emerald-300 bg-emerald-50/60 text-emerald-900 hover:bg-emerald-100"
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              Moji predmeti ({myAssignedCount})
            </Button>
          )}

          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="w-52 h-9 rounded-full bg-background border-border text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Svi dostupni statusi ({stats.total})</SelectItem>
              {showZaprimljeno && (
                <SelectItem value="unassigned">1. Zaprimljeno / Nedodijeljeno ({stats.unassigned})</SelectItem>
              )}
              {showUradu && (
                <SelectItem value="active">2. U radu / Dodijeljeno ({stats.active})</SelectItem>
              )}
              {showZavrseno && (
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

          <Select value={sortOrder} onValueChange={(v: "fifo" | "newest") => setSortOrder(v)}>
            <SelectTrigger
              className="w-48 h-9 rounded-full bg-background border-border text-xs font-semibold"
              title="Redoslijed prikaza predmeta"
            >
              <ArrowUpDown className="h-3.5 w-3.5 mr-1 text-primary shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fifo">FIFO (najstariji prvi)</SelectItem>
              <SelectItem value="newest">Najnoviji prvi</SelectItem>
            </SelectContent>
          </Select>

          {(search || statusFilter !== "all" || priorityFilter !== "all" || onlyMineFilter) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("")
                setStatusFilter("all")
                setPriorityFilter("all")
                setOnlyMineFilter(false)
              }}
              className="rounded-full text-xs h-9 gap-1 border-slate-300"
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
      ) : viewMode === "board" && statusFilter === "all" ? (
        <div className={`grid grid-cols-1 ${
          ((showZaprimljeno ? 1 : 0) + (showUradu ? 1 : 0) + (showZavrseno ? 1 : 0)) === 2
            ? "lg:grid-cols-2"
            : ((showZaprimljeno ? 1 : 0) + (showUradu ? 1 : 0) + (showZavrseno ? 1 : 0)) >= 3
            ? "lg:grid-cols-3"
            : ""
        } gap-5 items-start`}>
          {/* Column 1: Zaprimljeno (Nedodijeljeno) */}
          {showZaprimljeno && (
            <div className="rounded-2xl border border-purple-200/80 bg-purple-50/20 p-3.5 space-y-3">
              <div className="flex items-center justify-between px-1 pb-2 border-b border-purple-200/70">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-600" />
                  <h3 className="font-serif text-sm font-bold text-purple-950 uppercase tracking-wide">
                    1. Zaprimljeno (Nedodijeljeno)
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-purple-200 text-purple-900">
                    {sortOrder === "fifo" ? "FIFO" : "Najnoviji"}
                  </span>
                  <Badge className="bg-purple-100 text-purple-900 border-purple-300 hover:bg-purple-100">
                    {filteredInquiries.filter((i) => getInquiryStatusCategory(i.status) === "zaprimljeno").length}
                  </Badge>
                </div>
              </div>
              <p className="text-[11px] text-purple-900/80 px-1">
                Upiti pristigli iz maila ili ručno uneseni koji još čekaju dodjelu slobodnom istraživaču.
              </p>
              <div className="space-y-3">
                {filteredInquiries
                  .filter((i) => getInquiryStatusCategory(i.status) === "zaprimljeno")
                  .map(renderInquiryCard)}
                {filteredInquiries.filter((i) => getInquiryStatusCategory(i.status) === "zaprimljeno").length ===
                  0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-purple-200 rounded-xl bg-white/50">
                    Nema nedodijeljenih upita
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Column 2: U radu (Dodijeljeno) */}
          {showUradu && (
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/20 p-3.5 space-y-3">
              <div className="flex items-center justify-between px-1 pb-2 border-b border-amber-200/70">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <h3 className="font-serif text-sm font-bold text-amber-950 uppercase tracking-wide">
                    2. U radu (Dodijeljeno)
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-amber-200 text-amber-900">
                    {sortOrder === "fifo" ? "FIFO" : "Najnoviji"}
                  </span>
                  <Badge className="bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-100">
                    {filteredInquiries.filter((i) => getInquiryStatusCategory(i.status) === "uradu").length}
                  </Badge>
                </div>
              </div>
              <p className="text-[11px] text-amber-900/80 px-1">
                Istraživanja dodijeljena istraživačima na kojima je rad u tijeku.
              </p>
              <div className="space-y-3">
                {filteredInquiries.filter((i) => getInquiryStatusCategory(i.status) === "uradu").map(renderInquiryCard)}
                {filteredInquiries.filter((i) => getInquiryStatusCategory(i.status) === "uradu").length === 0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-amber-200 rounded-xl bg-white/50">
                    Nema aktivnih istraživanja u radu
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Column 3: Završeno */}
          {showZavrseno && (
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/20 p-3.5 space-y-3">
              <div className="flex items-center justify-between px-1 pb-2 border-b border-emerald-200/70">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                  <h3 className="font-serif text-sm font-bold text-emerald-950 uppercase tracking-wide">
                    3. Završeno
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-900">
                    {sortOrder === "fifo" ? "FIFO" : "Najnoviji"}
                  </span>
                  <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-100">
                    {filteredInquiries.filter((i) => getInquiryStatusCategory(i.status) === "zavrseno").length}
                  </Badge>
                </div>
              </div>
              <p className="text-[11px] text-emerald-900/80 px-1">
                Dovršena rodoslovna istraživanja s unesenim nalazima i dokumentima.
              </p>
              <div className="space-y-3">
                {filteredInquiries.filter((i) => getInquiryStatusCategory(i.status) === "zavrseno").map(renderInquiryCard)}
                {filteredInquiries.filter((i) => getInquiryStatusCategory(i.status) === "zavrseno").length === 0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-emerald-200 rounded-xl bg-white/50">
                    Nema završenih istraživanja
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : filteredInquiries.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-2xl bg-muted/10">
          <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
          <h4 className="font-serif text-lg font-bold text-primary">
            {user?.role === "external" && !search
              ? "Trenutno nemate dodijeljenih istraživačkih predmeta"
              : "Nema pronađenih upita"}
          </h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {user?.role === "external" && !search
              ? "Čim Vam administrator ili voditelj dodijeli predmet za istraživanje, ovdje će se prikazati svi njegovi podaci, prilozi i komunikacija."
              : "Trenutno nema upisa koji odgovaraju odabranim kriterijima ili prebacite upit izravno iz Gmail Inboxa gumbom „U istraživanje”."}
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInquiries.map(renderInquiryCard)}
        </div>
      )}
        </>
      )}

      {/* Detail & Management Modal */}
      {selectedInquiry && (
        <InquiryDetailModal
          inquiry={selectedInquiry}
          canEdit={getInquiryCaseCapabilities(selectedInquiry, user).canEdit}
          inqPerms={inqPerms}
          members={researcherCandidates}
          canMergeCases={isAdminUser}
          onOpenMerge={(targetId) => setMergeModalState({ open: true, targetId })}
          gmailTransferNotice={
            gmailTransferNotice && gmailTransferNotice.inquiryId === selectedInquiry.id
              ? gmailTransferNotice
              : null
          }
          onDismissTransferNotice={() => setGmailTransferNotice(null)}
          onClose={() => {
            setSelectedInquiry(null)
            setGmailTransferNotice(null)
            if (initialInquiryId) {
              onClearInitialInquiry?.()
            }
          }}
          onRefresh={() => {
            fetchInquiries()
            setFeedbackRefreshKey((k) => k + 1)
          }}
        />
      )}

      {isAdminUser && (
        <InquiryMergeModal
          open={mergeModalState.open}
          inquiries={inquiries}
          initialTargetId={mergeModalState.targetId}
          user={user}
          onClose={() => setMergeModalState({ open: false, targetId: null })}
          onMerged={(mergedInquiry) => {
            setMergeModalState({ open: false, targetId: null })
            setSelectedInquiry(mergedInquiry)
            fetchInquiries()
          }}
        />
      )}

      {feedbackModalInquiry && (
        <InquiryFeedbackEmailModal
          open={Boolean(feedbackModalInquiry)}
          inquiry={feedbackModalInquiry}
          members={researcherCandidates}
          user={user}
          settings={settings}
          getAuthHeaders={getInquiryAuthHeaders}
          getActorPayload={getInquiryActorPayload}
          onClose={() => setFeedbackModalInquiry(null)}
          onSentSuccess={() => {
            fetchInquiries()
            setFeedbackRefreshKey((k) => k + 1)
          }}
        />
      )}

      {showAddDialog && (
        <InquiryAddModal
          members={researcherCandidates}
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
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="font-bold text-sm text-amber-950 truncate">{selectedMember.name}</p>
                {selectedMember.isExternal && (
                  <span className="inline-flex items-center rounded-md bg-purple-100 border border-purple-300 px-1.5 py-0.5 text-[10px] font-bold text-purple-900">
                    Vanjski suradnik (Nije član)
                  </span>
                )}
              </div>
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
              placeholder="Pretraži istraživača (člana ili vanjskog suradnika) po imenu, e-mailu ili telefonu..."
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-foreground truncate">{m.name}</p>
                        {m.isExternal && (
                          <span className="inline-flex items-center rounded bg-purple-100 border border-purple-300 px-1.5 py-0.5 text-[9px] font-bold text-purple-900 shrink-0">
                            Nije član
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground truncate mt-0.5">
                        {m.email && <span className="truncate">{m.email}</span>}
                        {m.email && (m.phone || m.organization) && <span>•</span>}
                        {m.organization ? (
                          <span className="truncate text-purple-800">{m.organization}</span>
                        ) : m.phone ? (
                          <span className="shrink-0">{m.phone}</span>
                        ) : null}
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
      toast.error("Molimo unesite ime podnositelja, predmet i tekst upita.")
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
        actor: getInquiryActorPayload(user),
      }

      const res = await fetch("/api/projects/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getInquiryAuthHeaders(user) },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        onSuccess()
      } else {
        const err = await res.json()
        toast.error(err.error || "Greška pri spremanju.")
      }
    } catch (e) {
      console.error(e)
      toast.error("Greška pri spremanju.")
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

        <ModalActionFooter
          right={
            <>
              <CloseActionButton label="Odustani" onClick={onClose} />
              <SaveActionButton
                label="Spremi upit"
                loading={isSubmitting}
                onClick={handleSubmit}
              />
            </>
          }
        />
      </div>
    </div>
  )
}

function buildDefaultEmailContent(
  type: "to_researcher" | "to_researcher_supplement" | "to_requester_wait" | "to_requester_check",
  inquiry: ResearchInquiry,
  assignedMember: any | null,
  senderUser?: any,
  members?: any[],
  adminName?: string | null,
  supplementMessage?: InquirySourceMessage | null
): { to: string; cc: string; subject: string; messageHtml: string } {
  const requesterEmail =
    (inquiry.requester_email || "").trim() || extractEmailFromText(inquiry.requester_contact)
  const researcherEmail = (assignedMember?.email || "").trim()
  const researcherName = assignedMember?.name || inquiry.assigned_to_name || "kolega/ice"
  const formattedDate = formatDateHr(inquiry.inquiry_date)
  const attachmentsCount = (inquiry.attachments || []).length
  const senderSignoff = resolveSenderSignoff(senderUser, members, adminName)
  const signoffBlockHtml = senderSignoff.html ? `\n${senderSignoff.html}` : ""

  if (type === "to_researcher_supplement") {
    const to = researcherEmail
    const cc = requesterEmail
    const suppDate = formatDateTimeHr(
      supplementMessage?.received_at || supplementMessage?.received_date || inquiry.inquiry_date
    )
    const suppSubject = supplementMessage?.subject || inquiry.subject
    const suppFrom =
      [supplementMessage?.from_name, supplementMessage?.from_email ? `(${supplementMessage.from_email})` : ""]
        .filter(Boolean)
        .join(" ") || inquiry.requester_name
    const suppBody = escapeHtml(supplementMessage?.body_text || "").replace(/\n/g, "<br/>")
    const suppAttNames = supplementMessage?.attachments_names || []

    const subject = `Dopuna predmeta #${inquiry.id}: ${suppSubject}`
    const attachmentNote =
      suppAttNames.length > 0
        ? `<p style="margin:12px 0;padding:10px 14px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;font-size:13px;color:#92400e;">📎 <strong>Novi privitci uz dopunu (${suppAttNames.length}):</strong> ${escapeHtml(
            suppAttNames.join(", ")
          )}</p>`
        : ""

    const messageHtml = `
<p>Poštovani/a <strong>${escapeHtml(researcherName)}</strong>,</p>
<p>prosljeđujemo Vam <strong>naknadnu dopunu</strong> već zaprimljenog i Vama dodijeljenog istraživačkog predmeta <strong>#${inquiry.id}</strong> (<em>„${escapeHtml(
      inquiry.subject
    )}”</em>, zaprimljeno ${escapeHtml(formattedDate)}).</p>
<p>Osoba koja je poslala upit (<strong>${escapeHtml(inquiry.requester_name)}</strong>${
      requesterEmail ? `, <a href="mailto:${escapeHtml(requesterEmail)}">${escapeHtml(requesterEmail)}</a>` : ""
    }) nalazi se u kopiji (<strong>CC</strong>) radi izravnog nastavka komunikacije.</p>

<div style="margin:16px 0;padding:16px 18px;background-color:#f8fafc;border:1px solid #cbd5e1;border-left:4px solid #D97706;border-radius:8px;">
  <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#7C2D12;margin-bottom:8px;">
    Sadržaj nove dopune upita
  </div>
  <p style="margin:4px 0;font-size:13.5px;"><strong>Pošiljatelj dopune:</strong> ${escapeHtml(suppFrom)}</p>
  <p style="margin:4px 0;font-size:13.5px;"><strong>Datum i vrijeme primitka:</strong> ${escapeHtml(suppDate)}</p>
  <p style="margin:4px 0 10px 0;font-size:13.5px;"><strong>Naslov poruke:</strong> ${escapeHtml(suppSubject)}</p>
  <div style="padding-top:10px;border-top:1px dashed #cbd5e1;font-size:13.5px;line-height:1.6;color:#1e293b;">
    ${suppBody || "(Bez teksta)"}
  </div>
</div>
${attachmentNote}
<p>Zahvaljujemo na nastavku obrade predmeta!</p>
<p>Srdačan pozdrav,</p>${signoffBlockHtml}`.trim()

    return { to, cc, subject, messageHtml }
  }

  if (type === "to_researcher") {
    const to = researcherEmail
    const cc = requesterEmail
    const subject = inquiry.subject.toLowerCase().startsWith("upit")
      ? inquiry.subject
      : `Upit za rodoslovno istraživanje: ${inquiry.subject}`

    const sourceMessages = Array.isArray(inquiry.source_messages) ? inquiry.source_messages : []
    const hasGroupedMessages = sourceMessages.length > 1
    const bodyHtmlSection = hasGroupedMessages
      ? sourceMessages
          .map((m, idx) => {
            const label =
              idx === 0
                ? "Izvorni upit (#1)"
                : m.merged_from_inquiry_id
                ? `Spojeni predmet #${m.merged_from_inquiry_id} (Dopuna #${idx + 1})`
                : `Dopuna upita #${idx + 1}`
            const dt = formatDateTimeHr(m.received_at || m.received_date)
            return `<div style="margin-top:${idx === 0 ? "6px" : "12px"};padding-top:${
              idx === 0 ? "6px" : "10px"
            };border-top:1px dashed #cbd5e1;">
              <div style="font-size:12px;font-weight:700;color:#1E3A5F;margin-bottom:4px;">${escapeHtml(
                label
              )} • ${escapeHtml(dt)} • ${escapeHtml(m.subject || "")}</div>
              <div style="font-size:13.5px;line-height:1.6;color:#1e293b;">${escapeHtml(
                m.body_text || ""
              ).replace(/\n/g, "<br/>")}</div>
            </div>`
          })
          .join("")
      : `<div style="padding-top:10px;border-top:1px dashed #cbd5e1;font-size:13.5px;line-height:1.6;color:#1e293b;">
          <strong>Tekst upita:</strong><br/>
          ${escapeHtml(inquiry.inquiry_text).replace(/\n/g, "<br/>")}
        </div>`

    const attachmentNote =
      attachmentsCount > 0
        ? `<p style="margin:12px 0;padding:10px 14px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;font-size:13px;color:#92400e;">📎 <strong>Privitci uz upit:</strong> U privitku ovog e-maila nalaze se sve datoteke i dokumenti iz upita (${attachmentsCount} ${
            attachmentsCount === 1 ? "datoteka" : "datoteka/e"
          }).</p>`
        : ""

    const messageHtml = `
<p>Poštovani/a <strong>${escapeHtml(researcherName)}</strong>,</p>
<p>prosljeđujemo Vam zaprimljeni upit za rodoslovno istraživanje koji je uputio/la <strong>${escapeHtml(
      inquiry.requester_name
    )}</strong> (datum zaprimanja: ${escapeHtml(formattedDate)}${
      hasGroupedMessages ? `, objedinjeno ${sourceMessages.length} povezana e-maila` : ""
    }).</p>
<p>Osoba koja je poslala upit (<strong>${escapeHtml(inquiry.requester_name)}</strong>${
      requesterEmail ? `, <a href="mailto:${escapeHtml(requesterEmail)}">${escapeHtml(requesterEmail)}</a>` : ""
    }) stavljena je u kopiju (<strong>CC</strong>) ovog e-maila kako biste bili izravno povezani i kako biste sav daljnji dogovor oko istraživanja mogli nastaviti međusobno.</p>

<div style="margin:16px 0;padding:16px 18px;background-color:#f8fafc;border:1px solid #cbd5e1;border-left:4px solid #b45309;border-radius:8px;">
  <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#92400e;margin-bottom:8px;">
    Podaci o zaprimljenom upitu (#${inquiry.id})
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
  ${bodyHtmlSection}
</div>
${attachmentNote}
<p>Zahvaljujemo na preuzimanju upita i angažmanu u radu Društva!</p>
<p>Srdačan pozdrav,</p>${signoffBlockHtml}`.trim()

    return { to, cc, subject, messageHtml }
  } else if (type === "to_requester_check") {
    const to = requesterEmail
    const cc = ""
    const subject = inquiry.subject.toLowerCase().startsWith("re:")
      ? inquiry.subject
      : `Re: ${inquiry.subject}`
    const researcherMention =
      assignedMember?.name || inquiry.assigned_to_name
        ? `predloženog istraživača Društva (${escapeHtml(assignedMember?.name || inquiry.assigned_to_name || "")})`
        : "našeg predloženog istraživača"

    const messageHtml = `
<p>Poštovani/a <strong>${escapeHtml(inquiry.requester_name)}</strong>,</p>
<p>srdačno Vas pozdravljamo iz Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović” i iskreno se nadamo da ste dobro.</p>
<p>Javljamo Vam se kratko kako bismo provjerili status Vašeg rodoslovnog upita (<em>„${escapeHtml(
      inquiry.subject
    )}”</em>${formattedDate ? `, zaprimljenog ${escapeHtml(formattedDate)}` : ""}). Prema našoj evidenciji znamo da ste kontaktirani od strane ${researcherMention}, no do sada u Društvu nismo dobili nikakve povratne informacije o daljnjem tijeku ili ishodu istraživanja.</p>
<p>Bit će nam iznimno drago ako nam možete ukratko javiti kako napreduje komunikacija i jeste li na dobrom tragu. Ako ste možda u međuvremenu odustali od daljnjeg istraživanja ili Vam pomoć više nije potrebna, molimo Vas da nam to samo kratko javite odgovorom na ovu poruku kako bismo mogli uredno zatvoriti predmet u našoj evidenciji.</p>
<p>Od srca Vam zahvaljujemo na javljanju i vremenu!</p>
<p>Srdačan pozdrav,</p>${signoffBlockHtml}`.trim()

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
<p>Srdačan pozdrav,</p>${signoffBlockHtml}`.trim()

    return { to, cc, subject, messageHtml }
  }
}

function InquirySendEmailModal({
  emailType,
  inquiry,
  members,
  selectedMember,
  supplementMessage,
  onSelectMember,
  onClose,
  onSuccess,
}: {
  emailType: "to_researcher" | "to_researcher_supplement" | "to_requester_wait" | "to_requester_check"
  inquiry: ResearchInquiry
  members: any[]
  selectedMember: any | null
  supplementMessage?: InquirySourceMessage | null
  onSelectMember: (m: any | null) => void
  onClose: () => void
  onSuccess: (updatedInquiry: ResearchInquiry) => void
}) {
  const { user } = useAuth()
  const { settings } = useSettings()
  const editorRef = useRef<HTMLDivElement | null>(null)
  const isResearcherType = emailType === "to_researcher" || emailType === "to_researcher_supplement"

  const defaults = useMemo(
    () =>
      buildDefaultEmailContent(
        emailType,
        inquiry,
        selectedMember,
        user,
        members,
        settings?.adminName,
        supplementMessage
      ),
    [emailType, inquiry, selectedMember, user, members, settings?.adminName, supplementMessage]
  )

  const getDefaultAttachmentIds = (): string[] => {
    const allAtts = inquiry.attachments || []
    if (emailType === "to_researcher") {
      return allAtts.map((a) => a.id)
    }
    if (emailType === "to_researcher_supplement" && supplementMessage) {
      const idSet = new Set(supplementMessage.attachment_ids || [])
      return allAtts
        .filter(
          (a) =>
            idSet.has(a.id) ||
            (a.source_message_id && a.source_message_id === supplementMessage.id) ||
            (supplementMessage.gmail_message_id &&
              a.source_gmail_message_id === supplementMessage.gmail_message_id)
        )
        .map((a) => a.id)
    }
    return []
  }

  const [to, setTo] = useState(defaults.to)
  const [cc, setCc] = useState(defaults.cc)
  const [subject, setSubject] = useState(defaults.subject)
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<string[]>(getDefaultAttachmentIds)
  const [sending, setSending] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [testEmail, setTestEmail] = useState("")
  const [testSuccessMsg, setTestSuccessMsg] = useState("")
  const [error, setError] = useState("")
  const [donationPreviewHtml, setDonationPreviewHtml] = useState<string>("")
  const [officialMailbox, setOfficialMailbox] = useState<string>("rodoslovlje@rodoslovlje.hr")

  const selectedAttachmentsSize = useMemo(() => {
    const idSet = new Set(selectedAttachmentIds)
    return sumAttachmentsSize((inquiry.attachments || []).filter((a) => idSet.has(a.id)))
  }, [inquiry.attachments, selectedAttachmentIds])

  useEffect(() => {
    setSelectedAttachmentIds(getDefaultAttachmentIds())
  }, [emailType, supplementMessage?.id, inquiry.id])

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
    const nextDefaults = buildDefaultEmailContent(
      emailType,
      inquiry,
      selectedMember,
      user,
      members,
      settings?.adminName,
      supplementMessage
    )
    setTo(nextDefaults.to)
    setCc(nextDefaults.cc)
    setSubject(nextDefaults.subject)
    if (editorRef.current) {
      editorRef.current.innerHTML = nextDefaults.messageHtml
      window.requestAnimationFrame(() => {
        try {
          const el = editorRef.current
          if (!el) return
          el.focus()
          const sel = window.getSelection()
          if (sel) {
            const range = document.createRange()
            range.setStart(el.firstChild || el, 0)
            range.collapse(true)
            sel.removeAllRanges()
            sel.addRange(range)
          }
        } catch {}
      })
    }
  }, [selectedMember, emailType, inquiry, user, members, settings?.adminName, supplementMessage])

  useEffect(() => {
    fetch("/api/projects/inquiries?action=donation-preview", {
      headers: getInquiryAuthHeaders(user),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.donationBlockHtml) setDonationPreviewHtml(data.donationBlockHtml)
        if (data.officialMailbox) setOfficialMailbox(data.officialMailbox)
      })
      .catch(() => {})
  }, [user?.id])

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
        headers: { "Content-Type": "application/json", ...getInquiryAuthHeaders(user) },
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
          includeAttachments: selectedAttachmentIds.length > 0,
          attachmentIds: selectedAttachmentIds,
          sender: buildClientSenderIdentity(user, members, settings),
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
        isResearcherType
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
        headers: { "Content-Type": "application/json", ...getInquiryAuthHeaders(user) },
        body: JSON.stringify({
          action: "send-email",
          id: inquiry.id,
          emailType,
          to: to.trim(),
          cc: cc.trim() || undefined,
          subject: subject.trim(),
          messageHtml: currentMessageHtml,
          includeDonationBlock: true,
          includeAttachments: selectedAttachmentIds.length > 0,
          attachmentIds: selectedAttachmentIds,
          assigned_to_id: selectedMember ? selectedMember.id : inquiry.assigned_to_id,
          assigned_to_name: selectedMember ? selectedMember.name : inquiry.assigned_to_name,
          sender: buildClientSenderIdentity(user, members, settings),
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Greška pri slanju e-maila.")
      }
      toast.success("Službeni e-mail je uspješno poslan.")
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
          className="px-6 py-4 border-b-2 border-[#D97706] flex items-center justify-between bg-[#1E3A5F] text-white"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-[#D97706] shrink-0" />
              <h3 className="font-serif text-lg font-bold truncate">
                {emailType === "to_researcher"
                  ? "Slanje upita i privitaka istraživaču (Podnositelj u CC)"
                  : emailType === "to_researcher_supplement"
                  ? "Slanje dopune upita dodijeljenom istraživaču (Podnositelj u CC)"
                  : emailType === "to_requester_check"
                  ? "Slanje e-maila za provjeru statusa podnositelju (Dodijeljeno istraživaču)"
                  : "Slanje odgovora podnositelju (Potvrda primitka / Na čekanju istraživača)"}
              </h3>
            </div>
            <p className="text-[11px] text-[#F8FAFC] mt-0.5">
              Standardizirani HRD predložak (#1E3A5F / #7C2D12 / #D97706) • Šalje se sa službenog sandučića ({officialMailbox})
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
                  isResearcherType
                    ? "E-mail istraživača..."
                    : "E-mail osobe koja je poslala upit..."
                }
                className="flex-1 text-sm font-semibold bg-transparent outline-none"
              />
              <Badge variant="outline" className="text-[10px] shrink-0">
                {isResearcherType ? "Istraživač" : "Podnositelj upita"}
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
                  isResearcherType
                    ? "E-mail osobe koja je poslala upit (automatski u CC)..."
                    : "Opcionalno (kopija)..."
                }
                className="flex-1 text-sm bg-transparent outline-none"
              />
              {isResearcherType && (
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

          {/* Selective Attachments picker */}
          {inquiry.attachments && inquiry.attachments.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-amber-700 shrink-0" />
                  <span className="font-semibold text-slate-900">
                    Privitci ({selectedAttachmentIds.length}/{inquiry.attachments.length} odabrano •{" "}
                    {formatBytesCompact(selectedAttachmentsSize)})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {emailType === "to_researcher_supplement" && supplementMessage && (
                    <button
                      type="button"
                      onClick={() => setSelectedAttachmentIds(getDefaultAttachmentIds())}
                      className="text-[11px] font-semibold text-indigo-700 hover:underline"
                    >
                      Samo iz dopune
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedAttachmentIds(inquiry.attachments.map((a) => a.id))}
                    className="text-[11px] font-semibold text-[#1E3A5F] hover:underline"
                  >
                    Označi sve
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAttachmentIds([])}
                    className="text-[11px] font-semibold text-muted-foreground hover:underline"
                  >
                    Poništi
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                {inquiry.attachments.map((att) => {
                  const checked = selectedAttachmentIds.includes(att.id)
                  return (
                    <label
                      key={att.id}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 cursor-pointer transition-colors ${
                        checked
                          ? "bg-white border-amber-300 text-slate-900"
                          : "bg-slate-100/70 border-slate-200 text-muted-foreground"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedAttachmentIds((prev) =>
                            prev.includes(att.id) ? prev.filter((x) => x !== att.id) : [...prev, att.id]
                          )
                        }
                        className="rounded border-slate-300 shrink-0"
                      />
                      <span className="truncate flex-1 font-medium" title={att.name}>
                        {att.name}
                      </span>
                      {att.size ? (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatBytesCompact(att.size)}
                        </span>
                      ) : null}
                    </label>
                  )
                })}
              </div>

              {selectedAttachmentsSize > MAX_GMAIL_TOTAL_ATTACHMENTS_BYTES && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-950 flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    Ukupna veličina odabranih privitaka ({formatBytesCompact(selectedAttachmentsSize)}) približava se Gmail ograničenju od 25 MB. Ako slanje ne uspije, isključite dio većih datoteka ili dodajte vanjski link.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Editable Message HTML unutar standardiziranog HRD okvira (#1E3A5F zaglavlje bez logotipa + #D97706 linija) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Pregled predloška i uređivanje sadržaja poruke prije slanja:
            </label>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <div className="mx-auto max-w-[600px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="bg-[#1E3A5F] px-6 py-4 text-left border-b-4 border-[#D97706]">
                  <div className="font-serif text-base font-bold text-white uppercase tracking-wider">
                    HRVATSKO RODOSLOVNO DRUŠTVO
                  </div>
                  <div className="text-xs text-[#F8FAFC] mt-0.5">
                    Pavao Ritter Vitezović
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    dangerouslySetInnerHTML={{ __html: defaults.messageHtml }}
                    className="min-h-[180px] rounded-lg border border-dashed border-[#E2E8F0] bg-white p-3 text-sm text-[#1F2937] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 prose prose-sm max-w-none"
                  />
                  {donationPreviewHtml ? (
                    <div
                      className="overflow-x-auto text-xs border-t border-[#E2E8F0] pt-3"
                      dangerouslySetInnerHTML={{ __html: donationPreviewHtml }}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Učitavanje pregleda donacijskog bloka, 2D barkoda i potpisa...
                    </p>
                  )}
                </div>
              </div>
            </div>
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
        <div className="shrink-0 px-5 py-3.5 border-t-2 border-border bg-[#FBF9F6] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-[0_-4px_12px_rgba(27,43,54,0.06)]">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground">
              Test na mail:
            </span>
            <Input
              type="email"
              placeholder={user?.email || "npr. admin@rodoslovlje.hr"}
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="h-10 text-xs font-mono bg-background"
              title="E-mail adresa administratora ili vlastita adresa za probno slanje"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={sendingTest || sending}
              onClick={handleSendTest}
              className="h-10 shrink-0 rounded-full px-4 font-semibold border-2 border-[#D97706] text-[#1E3A5F] hover:bg-amber-50 shadow-2xs"
            >
              {sendingTest ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Mail className="h-3.5 w-3.5 mr-1.5 text-[#D97706]" />
              )}
              Pošalji TEST
            </Button>
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <CloseActionButton label="Odustani" onClick={onClose} />
            <Button
              type="button"
              onClick={handleSend}
              disabled={sending || sendingTest}
              className="rounded-full h-10 px-6 gap-2 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white border border-[#D97706] font-bold shadow-md"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-[#D97706]" />}
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
  canMergeCases = false,
  onOpenMerge,
  gmailTransferNotice,
  onDismissTransferNotice,
  onClose,
  onRefresh,
}: {
  inquiry: ResearchInquiry
  canEdit: boolean
  inqPerms?: InquiryPermissions
  members: any[]
  canMergeCases?: boolean
  onOpenMerge?: (targetId: number) => void
  gmailTransferNotice?: {
    inquiryId: number
    created: boolean
    attached?: boolean
    attachedMessageId?: string | null
  } | null
  onDismissTransferNotice?: () => void
  onClose: () => void
  onRefresh: () => void
}) {
  const { user } = useAuth()
  const { settings } = useSettings()
  const [form, setForm] = useState<ResearchInquiry>({
    ...inquiry,
    status: inquiry.status === "pending" ? "unassigned" : inquiry.status,
    requester_email:
      inquiry.requester_email || extractEmailFromText(inquiry.requester_contact),
  })
  const loadedInquiryIdRef = useRef<number>(inquiry.id)
  const [activeTab, setActiveTab] = useState<"details" | "work" | "attachments" | "communications">("details")
  const [isSaving, setIsSaving] = useState(false)
  const [closeModalState, setCloseModalState] = useState<{
    open: boolean
    initialTab: "confirm" | "preview" | "test"
  }>({ open: false, initialTab: "confirm" })
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [uploadFeedback, setUploadFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [saveFeedback, setSaveFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [emailModalType, setEmailModalType] = useState<
    "to_researcher" | "to_researcher_supplement" | "to_requester_wait" | "to_requester_check" | null
  >(null)
  const [supplementForEmail, setSupplementForEmail] = useState<InquirySourceMessage | null>(null)
  const [expandedSourceMsgId, setExpandedSourceMsgId] = useState<string | null>(
    gmailTransferNotice?.attachedMessageId || null
  )
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)
  const [timelineOrder, setTimelineOrder] = useState<"asc" | "desc">("asc")
  const [editingResponseLogId, setEditingResponseLogId] = useState<string | null>(null)
  const [responseDateInput, setResponseDateInput] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [responseTextInput, setResponseTextInput] = useState<string>("")
  const [showNewStandaloneResponse, setShowNewStandaloneResponse] = useState(false)
  const [standaloneDateInput, setStandaloneDateInput] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [standaloneTextInput, setStandaloneTextInput] = useState<string>("")
  const [savingResponse, setSavingResponse] = useState(false)
  const [responseError, setResponseError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const caps = useMemo(() => getInquiryCaseCapabilities(form, user), [form, user])
  const effectiveCanEdit = Boolean(canEdit || caps.canEdit)

  useEffect(() => {
    const normalizedStatus = inquiry.status === "pending" ? "unassigned" : inquiry.status
    const normalizedEmail =
      inquiry.requester_email || extractEmailFromText(inquiry.requester_contact)
    if (loadedInquiryIdRef.current !== inquiry.id) {
      loadedInquiryIdRef.current = inquiry.id
      setForm({
        ...inquiry,
        status: normalizedStatus,
        requester_email: normalizedEmail,
      })
      setEditingResponseLogId(null)
      setShowNewStandaloneResponse(false)
      setResponseError("")
      setUploadFeedback(null)
      setSaveFeedback(null)
      setActiveTab("details")
      setCloseModalState({ open: false, initialTab: "confirm" })
    } else {
      setForm((prev) => ({
        ...prev,
        attachments: inquiry.attachments || prev.attachments || [],
        email_logs: inquiry.email_logs || [],
        source_messages: inquiry.source_messages || prev.source_messages || [],
        inquiry_date: inquiry.inquiry_date || prev.inquiry_date,
        inquiry_text:
          (inquiry.source_messages || []).length !== (prev.source_messages || []).length
            ? inquiry.inquiry_text
            : prev.inquiry_text,
        requester_contact:
          (inquiry.source_messages || []).length !== (prev.source_messages || []).length
            ? inquiry.requester_contact
            : prev.requester_contact,
        status: normalizedStatus,
        assigned_to_id: inquiry.assigned_to_id,
        assigned_to_name: inquiry.assigned_to_name,
        assigned_date: inquiry.assigned_date,
        gmail_thread_id: inquiry.gmail_thread_id,
      }))
    }
  }, [inquiry])

  const isDirty = useMemo(() => {
    const origStatus = inquiry.status === "pending" ? "unassigned" : inquiry.status
    const origEmail = inquiry.requester_email || extractEmailFromText(inquiry.requester_contact)
    return (
      (form.requester_name || "") !== (inquiry.requester_name || "") ||
      (form.requester_email || "") !== (origEmail || "") ||
      (form.requester_contact || "") !== (inquiry.requester_contact || "") ||
      (form.inquiry_date || "") !== (inquiry.inquiry_date || "") ||
      (form.subject || "") !== (inquiry.subject || "") ||
      (form.priority || "normal") !== (inquiry.priority || "normal") ||
      (form.inquiry_text || "") !== (inquiry.inquiry_text || "") ||
      (form.external_link || "") !== (inquiry.external_link || "") ||
      (form.researcher_response || "") !== (inquiry.researcher_response || "") ||
      (form.actions_taken || "") !== (inquiry.actions_taken || "") ||
      (form.collected_documents || "") !== (inquiry.collected_documents || "") ||
      (form.research_result || "") !== (inquiry.research_result || "") ||
      (form.notes || "") !== (inquiry.notes || "") ||
      Number(form.assigned_to_id || 0) !== Number(inquiry.assigned_to_id || 0) ||
      (form.status || "unassigned") !== (origStatus || "unassigned")
    )
  }, [form, inquiry])

  const assignedMember = useMemo(() => {
    return (
      members.find(
        (m) => m.id === Number(form.assigned_to_id) || m.name === form.assigned_to_name
      ) || null
    )
  }, [members, form.assigned_to_id, form.assigned_to_name])

  const handleSafeClose = async () => {
    if (
      isDirty &&
      effectiveCanEdit &&
      !(await confirmAction("Imate nespremljene izmjene na ovom predmetu. Želite li zatvoriti prozor bez spremanja?"))
    ) {
      return
    }
    onClose()
  }

  const uploadFilesToCase = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList || [])
    if (files.length === 0 || !effectiveCanEdit) return
    setUploading(true)
    setUploadFeedback(null)
    try {
      const newlyUploaded: Array<{
        id: string
        name: string
        url: string
        fileType: string
        size?: number
        mimeType?: string
      }> = []
      const failedNames: string[] = []

      for (const file of files) {
        const data = new FormData()
        data.append("file", file)
        const res = await fetch("/api/meetings/upload", { method: "POST", body: data })
        const ret = await res.json().catch(() => ({}))
        if (res.ok && ret.url) {
          newlyUploaded.push({
            id: generateId(),
            name: ret.name || file.name,
            url: ret.url,
            fileType: ret.fileType || "document",
            size: ret.size || file.size,
            mimeType: ret.mimeType,
          })
        } else {
          failedNames.push(`${file.name} (${ret.error || "greška pri prijenosu"})`)
        }
      }

      if (newlyUploaded.length > 0) {
        const nextAttachments = [...(form.attachments || []), ...newlyUploaded]
        setForm((prev) => ({ ...prev, attachments: nextAttachments }))

        // Automatsko trajno spremanje dodanih datoteka u bazu kako se prilog nikad ne bi izgubio
        const saveRes = await fetch("/api/projects/inquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getInquiryAuthHeaders(user) },
          body: JSON.stringify({
            action: "update",
            id: form.id,
            attachments: nextAttachments,
            actor: getInquiryActorPayload(user),
          }),
        })
        const saveData = await saveRes.json().catch(() => ({}))
        if (!saveRes.ok || saveData.error) {
          setUploadFeedback({
            type: "error",
            text: saveData.error || "Datoteka je prenesena, ali nije spremljena u predmet.",
          })
        } else {
          if (saveData.inquiry?.attachments) {
            setForm((prev) => ({ ...prev, attachments: saveData.inquiry.attachments }))
          }
          onRefresh()
          const okMsg = `✓ Priloženo i spremljeno (${newlyUploaded.length} ${
            newlyUploaded.length === 1 ? "datoteka" : "datoteke/a"
          }).`
          setUploadFeedback({
            type: failedNames.length > 0 ? "error" : "success",
            text:
              failedNames.length > 0
                ? `${okMsg} Nije preneseno: ${failedNames.join("; ")}`
                : okMsg,
          })
        }
      } else if (failedNames.length > 0) {
        setUploadFeedback({
          type: "error",
          text: `Prijenos nije uspio: ${failedNames.join("; ")}`,
        })
      }
    } catch (e: any) {
      setUploadFeedback({
        type: "error",
        text: e?.message || "Greška pri prijenosu datoteka.",
      })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    await uploadFilesToCase(e.target.files)
  }

  const handleRemoveAttachment = async (idx: number) => {
    const target = (form.attachments || [])[idx]
    if (!target || !effectiveCanEdit) return
    if (!(await confirmAction(`Želite li ukloniti prilog "${target.name}" iz predmeta?`))) return
    const nextAttachments = (form.attachments || []).filter((_, i) => i !== idx)
    setForm((prev) => ({ ...prev, attachments: nextAttachments }))
    setUploadFeedback(null)
    try {
      const res = await fetch("/api/projects/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getInquiryAuthHeaders(user) },
        body: JSON.stringify({
          action: "update",
          id: form.id,
          attachments: nextAttachments,
          actor: getInquiryActorPayload(user),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        throw new Error(data.error || "Greška pri uklanjanju datoteke.")
      }
      if (data.inquiry?.attachments) {
        setForm((prev) => ({ ...prev, attachments: data.inquiry.attachments }))
      }
      onRefresh()
      setUploadFeedback({ type: "success", text: `✓ Prilog "${target.name}" je uklonjen.` })
    } catch (e: any) {
      setUploadFeedback({ type: "error", text: e?.message || "Greška pri uklanjanju priloga." })
    }
  }

  const buildUpdatePayload = (overrideStatus?: string): Record<string, any> => {
    const memberObj = members.find((m) => m.id === Number(form.assigned_to_id))
    const payload: Record<string, any> = {
      ...form,
      action: "update",
      actor: getInquiryActorPayload(user),
    }
    if (overrideStatus) {
      payload.status = overrideStatus
    }
    if (!caps.canReassign) {
      delete payload.assigned_to_id
      delete payload.assigned_to_name
      delete payload.assigned_date
    } else {
      payload.assigned_to_id = form.assigned_to_id ? Number(form.assigned_to_id) : null
      payload.assigned_to_name = memberObj ? memberObj.name : form.assigned_to_name
    }
    return payload
  }

  const handleSave = async (closeAfterSave = true) => {
    setIsSaving(true)
    setSaveFeedback(null)
    try {
      const payload = buildUpdatePayload()
      const res = await fetch("/api/projects/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getInquiryAuthHeaders(user) },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (res.ok && !data.error) {
        if (data.inquiry) {
          setForm(data.inquiry)
        }
        onRefresh()
        if (closeAfterSave) {
          onClose()
        } else {
          setSaveFeedback({ type: "success", text: "✓ Sve promjene na predmetu su spremljene." })
        }
      } else {
        setSaveFeedback({ type: "error", text: data.error || "Greška pri ažuriranju upita." })
      }
    } catch (e: any) {
      console.error(e)
      setSaveFeedback({ type: "error", text: e?.message || "Greška pri ažuriranju upita." })
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenCloseModal = (initialTab: "confirm" | "preview" | "test" = "confirm") => {
    if (!caps.canCloseCase && initialTab === "confirm") return
    setCloseModalState({ open: true, initialTab })
  }

  const handleClosedSuccess = (
    updatedInquiry: ResearchInquiry,
    dispatch?: InquiryCloseDispatchResult
  ) => {
    setForm(updatedInquiry)
    setCloseModalState({ open: false, initialTab: "confirm" })
    const sentParts: string[] = []
    if (dispatch?.requester?.status === "sent") {
      sentParts.push(`podnositelju (${dispatch.requester.to})`)
    }
    if (dispatch?.researcher?.status === "sent") {
      sentParts.push(`istraživaču (${dispatch.researcher.to})`)
    }
    if (dispatch?.archive?.status === "sent") {
      sentParts.push(`arhivi Društva (${dispatch.archive.to})`)
    }
    const skippedNotes: string[] = []
    if (dispatch?.requester?.status === "skipped_do_not_contact") {
      skippedNotes.push("podnositelj ima zabranu kontakta")
    } else if (dispatch?.requester?.status === "error") {
      skippedNotes.push(`greška slanja podnositelju: ${dispatch.requester.error || "SMTP/Gmail"}`)
    }
    if (dispatch?.researcher?.status === "skipped_do_not_contact") {
      skippedNotes.push("istraživač ima zabranu kontakta")
    } else if (dispatch?.researcher?.status === "error") {
      skippedNotes.push(`greška slanja istraživaču: ${dispatch.researcher.error || "SMTP/Gmail"}`)
    }
    if (dispatch?.archive?.status === "error") {
      skippedNotes.push(`greška slanja arhivi: ${dispatch.archive.error || "SMTP/Gmail"}`)
    }

    const msg =
      `✓ Predmet #${updatedInquiry.id} je trajno zatvoren i zaključan.` +
      (sentParts.length > 0 ? ` Automatske obavijesti poslane su: ${sentParts.join(", ")}.` : "") +
      (skippedNotes.length > 0 ? ` (${skippedNotes.join("; ")})` : "")

    toast.success(`Predmet #${updatedInquiry.id} je zatvoren i zaključan.`)
    setSaveFeedback({ type: "success", text: msg })
    onRefresh()
  }

  const handleDelete = async () => {
    if (!caps.canDeleteCase) return
    if (!(await confirmAction("Jeste li sigurni da želite obrisati ovaj upit i sve povezane podatke?"))) return
    try {
      const res = await fetch("/api/projects/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getInquiryAuthHeaders(user) },
        body: JSON.stringify({ action: "delete", id: form.id, actor: getInquiryActorPayload(user) }),
      })
      if (res.ok) {
        onRefresh()
        onClose()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Greška pri brisanju upita.")
      }
    } catch (e) {
      console.error(e)
    }
  }

  const emailLogs = form.email_logs || []
  const normStatus = form.status === "pending" ? "unassigned" : form.status

  const persistEmailLogs = async (nextLogs: InquiryEmailLog[]): Promise<boolean> => {
    setSavingResponse(true)
    setResponseError("")
    try {
      const res = await fetch("/api/projects/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getInquiryAuthHeaders(user) },
        body: JSON.stringify({
          action: "update",
          id: form.id,
          email_logs: nextLogs,
          actor: getInquiryActorPayload(user),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Greška pri spremanju odgovora.")
      }
      const savedLogs: InquiryEmailLog[] = data.inquiry?.email_logs || nextLogs
      setForm((prev) => ({ ...prev, email_logs: savedLogs }))
      onRefresh()
      return true
    } catch (e: any) {
      setResponseError(e.message || "Greška pri spremanju odgovora.")
      return false
    } finally {
      setSavingResponse(false)
    }
  }

  const normalizeDateInputToIso = (raw: string): string | null => {
    const trimmed = String(raw || "").trim()
    if (!trimmed) return null
    const inspected = inspectMemberDate(trimmed)
    return inspected.isoDate || null
  }

  const openInlineResponseEditor = (log: InquiryEmailLog) => {
    setResponseError("")
    setShowNewStandaloneResponse(false)
    setEditingResponseLogId(log.id)
    setResponseDateInput(log.response_date || new Date().toISOString().slice(0, 10))
    setResponseTextInput(log.response_text || "")
  }

  const handleSaveLogResponse = async (logId: string) => {
    const isoDate = normalizeDateInputToIso(responseDateInput)
    if (!isoDate) {
      setResponseError("Unesite ispravan datum odgovora u formatu DD/MM/YYYY.")
      return
    }
    const cleanText = responseTextInput.trim()
    if (!cleanText) {
      setResponseError("Unesite odgovor osobe / opravdanje zašto je predmet još otvoren.")
      return
    }

    const nowIso = new Date().toISOString()
    const recorderName = user?.name || "Administrator"
    const nextLogs = emailLogs.map((l) =>
      l.id === logId
        ? {
            ...l,
            response_date: isoDate,
            response_text: cleanText,
            response_recorded_at: nowIso,
            response_recorded_by: recorderName,
          }
        : l
    )
    const ok = await persistEmailLogs(nextLogs)
    if (ok) {
      setEditingResponseLogId(null)
    }
  }

  const handleClearLogResponse = async (logId: string) => {
    if (!(await confirmAction("Ukloniti evidentirani odgovor osobe za ovu provjeru statusa?"))) return
    const nextLogs = emailLogs.map((l) =>
      l.id === logId
        ? {
            ...l,
            response_date: null,
            response_text: null,
            response_recorded_at: null,
            response_recorded_by: null,
          }
        : l
    )
    await persistEmailLogs(nextLogs)
    if (editingResponseLogId === logId) {
      setEditingResponseLogId(null)
    }
  }

  const handleSaveStandaloneResponse = async () => {
    const isoDate = normalizeDateInputToIso(standaloneDateInput)
    if (!isoDate) {
      setResponseError("Unesite ispravan datum odgovora u formatu DD/MM/YYYY.")
      return
    }
    const cleanText = standaloneTextInput.trim()
    if (!cleanText) {
      setResponseError("Unesite odgovor osobe / opravdanje zašto je predmet još otvoren.")
      return
    }

    const nowIso = new Date().toISOString()
    const recorderName = user?.name || "Administrator"
    const newEntry: InquiryEmailLog = {
      id: generateId(),
      type: "requester_status_response",
      sent_at: `${isoDate}T12:00:00.000Z`,
      sent_by_id: user?.id ? String(user.id) : "admin",
      sent_by_name: recorderName,
      sent_by_role: user?.role || "admin",
      to: form.requester_email || form.requester_name,
      subject: "Odgovor osobe na provjeru statusa (opravdanje otvorenog predmeta)",
      html_body: "",
      response_date: isoDate,
      response_text: cleanText,
      response_recorded_at: nowIso,
      response_recorded_by: recorderName,
    }
    const ok = await persistEmailLogs([...emailLogs, newEntry])
    if (ok) {
      setShowNewStandaloneResponse(false)
      setStandaloneDateInput(new Date().toISOString().slice(0, 10))
      setStandaloneTextInput("")
    }
  }

  const handleDeleteStandaloneResponse = async (logId: string) => {
    if (!(await confirmAction("Obrisati ovaj zapis odgovora osobe iz kronologije?"))) return
    const nextLogs = emailLogs.filter((l) => l.id !== logId)
    await persistEmailLogs(nextLogs)
    if (editingResponseLogId === logId) {
      setEditingResponseLogId(null)
    }
  }

  const checkEmailsCount = emailLogs.filter((l) => l.type === "to_requester_check").length
  const statusResponsesCount = emailLogs.filter((l) => Boolean(l.response_text?.trim())).length
  const hasUnansweredCheck = emailLogs.some(
    (l) => l.type === "to_requester_check" && !l.response_text?.trim()
  )

  type TimelineNode =
    | {
        id: string
        kind: "received"
        sortTs: number
        seq: number
        dateStr: string
      }
    | {
        id: string
        kind: "assigned"
        sortTs: number
        seq: number
        dateStr: string
        researcherName: string
      }
    | {
        id: string
        kind: "supplement"
        sortTs: number
        seq: number
        msg: InquirySourceMessage
        supplementNum: number
      }
    | {
        id: string
        kind: "log"
        sortTs: number
        seq: number
        log: InquiryEmailLog
      }

  const timelineNodes = useMemo(() => {
    const parseTs = (raw?: string | null, fallbackHour = "10:00:00"): number => {
      if (!raw) return 0
      const trimmed = String(raw).trim()
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const ts = new Date(`${trimmed}T${fallbackHour}`).getTime()
        return Number.isNaN(ts) ? 0 : ts
      }
      const ts = new Date(trimmed).getTime()
      return Number.isNaN(ts) ? 0 : ts
    }

    const items: TimelineNode[] = []
    if (form.inquiry_date) {
      items.push({
        id: "milestone-received",
        kind: "received",
        sortTs: parseTs(form.inquiry_date, "08:00:00"),
        seq: 0,
        dateStr: form.inquiry_date,
      })
    }

    const researcherLabel = assignedMember?.name || form.assigned_to_name
    if (researcherLabel && (form.assigned_date || form.status !== "unassigned")) {
      items.push({
        id: "milestone-assigned",
        kind: "assigned",
        sortTs: parseTs(form.assigned_date || form.inquiry_date, "09:00:00"),
        seq: 1,
        dateStr: form.assigned_date || form.inquiry_date,
        researcherName: researcherLabel,
      })
    }

    const sourceList = Array.isArray(form.source_messages) ? form.source_messages : []
    sourceList.forEach((msg, idx) => {
      if (idx === 0 && (msg.is_initial || msg.gmail_message_id === form.gmail_message_id)) {
        return
      }
      items.push({
        id: `supp-${msg.id || idx}`,
        kind: "supplement",
        sortTs: parseTs(msg.received_at || msg.received_date, "11:00:00"),
        seq: 5 + idx,
        msg,
        supplementNum: idx + 1,
      })
    })

    emailLogs.forEach((log, idx) => {
      const refDate =
        log.type === "requester_status_response"
          ? log.response_date || log.sent_at
          : log.sent_at
      items.push({
        id: `log-${log.id}`,
        kind: "log",
        sortTs: parseTs(refDate, "12:00:00"),
        seq: 20 + idx,
        log,
      })
    })

    items.sort((a, b) => {
      const diff = a.sortTs - b.sortTs
      const cmp = diff !== 0 ? diff : a.seq - b.seq
      return timelineOrder === "asc" ? cmp : -cmp
    })

    return items
  }, [
    form.inquiry_date,
    form.assigned_date,
    form.assigned_to_name,
    form.status,
    form.source_messages,
    form.gmail_message_id,
    assignedMember?.name,
    emailLogs,
    timelineOrder,
  ])

  const inquiryTabs: SectionTabItem<"details" | "work" | "attachments" | "communications">[] = [
    { id: "details", label: "Detalji i upit", shortLabel: "Detalji", icon: FileText },
    {
      id: "work",
      label: "Obrada i nalazi",
      shortLabel: "Obrada",
      icon: Edit3,
      hasDot: Boolean(form.research_result || form.actions_taken || form.researcher_response),
    },
    {
      id: "attachments",
      label: "Prilozi",
      icon: Paperclip,
      count: (form.attachments || []).length,
    },
    {
      id: "communications",
      label: "Obavijesti i e-pošta",
      shortLabel: "Obavijesti",
      icon: Mail,
      count: emailLogs.length,
      badgeTone: hasUnansweredCheck ? "warning" : "default",
      hasDot: hasUnansweredCheck,
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-background border border-border rounded-none sm:rounded-3xl shadow-2xl max-w-4xl w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-border flex items-start justify-between gap-3 sm:gap-4 bg-card">
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
              {(form.source_messages || []).length > 1 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                  <Mail className="h-3 w-3" /> {(form.source_messages || []).length} povezana e-maila
                </span>
              )}
              {canMergeCases && onOpenMerge && normStatus !== "completed" && normStatus !== "rejected" && (
                <button
                  type="button"
                  onClick={() => onOpenMerge(form.id)}
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-300 hover:bg-indigo-200 transition-colors"
                  title="Spoji ovaj predmet s drugim otvorenim predmetima (samo Administrator)"
                >
                  <GitMerge className="h-3 w-3" /> Spoji s drugim predmetom
                </button>
              )}
            </div>
            {!effectiveCanEdit && (
              <div
                className={`inline-flex items-center gap-1.5 mb-2 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                  caps.isClosedLocked
                    ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-950"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-900"
                }`}
              >
                {caps.isClosedLocked ? (
                  <>
                    <Lock className="h-3.5 w-3.5 text-emerald-700" />
                    <span>Predmet je trajno zatvoren i zaključan — nastavak rada nije moguć (za dopune se šalje novi upit)</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-700" />
                    <span>Pristup samo za pregled – faza je zaključana za uređivanje prema vašim ovlastima</span>
                  </>
                )}
              </div>
            )}
            <h2 className="font-serif text-lg sm:text-xl md:text-2xl font-bold text-primary leading-tight">
              {form.subject}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Podnositelj: <strong className="text-foreground">{form.requester_name}</strong>
              {form.requester_email ? ` (${form.requester_email})` : ""} • Zaprimljeno:{" "}
              <strong>{formatDateHr(form.inquiry_date)}</strong>
            </p>
          </div>
          <button
            onClick={handleSafeClose}
            aria-label="Zatvori prozor"
            title="Zatvori prozor"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950 shadow-2xs shrink-0 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Izbornik sekcija */}
        <SectionTabsBar
          variant="detail"
          tabs={inquiryTabs}
          value={activeTab}
          onValueChange={setActiveTab}
          ariaLabel="Sekcije istraživačkog predmeta"
        />

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {saveFeedback && (
            <div
              className={`rounded-2xl border px-4 py-3 text-xs font-semibold flex items-center justify-between gap-2 ${
                saveFeedback.type === "success"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-red-300 bg-red-50 text-red-800"
              }`}
            >
              <span>{saveFeedback.text}</span>
              <button
                type="button"
                onClick={() => setSaveFeedback(null)}
                className="text-current opacity-70 hover:opacity-100 p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {activeTab === "details" && (
            <>
              {gmailTransferNotice && (() => {
                const matchedSupplement = gmailTransferNotice.attached
                  ? (form.source_messages || []).find(
                      (m) => m.id === gmailTransferNotice.attachedMessageId
                    ) ||
                    (form.source_messages && form.source_messages.length > 1
                      ? form.source_messages[form.source_messages.length - 1]
                      : null)
                  : null
                const canForwardSupplement = Boolean(
                  gmailTransferNotice.attached &&
                    caps.canSendOfficialEmail &&
                    normStatus !== "completed" &&
                    normStatus !== "rejected" &&
                    (assignedMember || form.assigned_to_name) &&
                    matchedSupplement
                )

                return (
                  <div className="rounded-2xl border-2 border-indigo-300 bg-gradient-to-r from-indigo-50 via-blue-50/60 to-white px-4 py-3 flex flex-col gap-3 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="text-xs text-indigo-950 space-y-0.5">
                          <p className="font-bold text-sm text-indigo-950">
                            {gmailTransferNotice.attached
                              ? `Dodatni e-mail je pridružen predmetu #${gmailTransferNotice.inquiryId} (FIFO datum: ${formatDateHr(
                                  form.inquiry_date
                                )})`
                              : gmailTransferNotice.created
                              ? `E-mail je prebačen u Istraživanja (Predmet #${gmailTransferNotice.inquiryId})`
                              : `Otvoren postojeći istraživački predmet #${gmailTransferNotice.inquiryId} iz Gmaila`}
                          </p>
                          <p className="text-indigo-900/90 leading-relaxed">
                            {gmailTransferNotice.attached
                              ? "Sadržaj i privitci nove poruke sačuvani su bez gubitka uz očuvanje izvornog FIFO datuma zaprimanja."
                              : gmailTransferNotice.created
                              ? "Ovdje možete odmah dodijeliti istraživača, poslati službene e-mailove, priložiti datoteke i završiti sve radnje vezane za ovaj predmet."
                              : "Ovaj e-mail već je povezan s predmetom u Istraživanjima — možete odmah nastaviti obradu i dovršiti sve potrebne radnje."}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Link
                          href="/gmail"
                          className="inline-flex items-center gap-1.5 rounded-full border border-indigo-300 bg-white hover:bg-indigo-100 text-indigo-900 px-3 py-1.5 text-xs font-semibold transition-colors"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          Natrag u Gmail
                        </Link>
                        {onDismissTransferNotice && (
                          <button
                            type="button"
                            onClick={onDismissTransferNotice}
                            aria-label="Sakrij obavijest"
                            title="Sakrij obavijest"
                            className="p-1.5 rounded-full hover:bg-indigo-100 text-indigo-700"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {canForwardSupplement && matchedSupplement && (
                      <div className="pt-2 border-t border-indigo-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-medium text-indigo-900">
                          Predmet je već dodijeljen istraživaču (<strong>{assignedMember?.name || form.assigned_to_name}</strong>). Možete odmah proslijediti ovu novu dopunu:
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setSupplementForEmail(matchedSupplement)
                            setEmailModalType("to_researcher_supplement")
                          }}
                          className="rounded-full h-9 px-4 gap-1.5 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white border border-[#D97706] text-xs font-bold shrink-0"
                        >
                          <Send className="h-3.5 w-3.5 text-[#D97706]" />
                          Pošalji novu dopunu istraživaču (CC naručitelj)
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })()}

          {/* Jedinstvena istaknuta gornja akcijska traka za zatvaranje predmeta i testiranje */}
          {(caps.isAssignedResearcher || caps.canCloseCase || normStatus === "completed") && (
            <div
              className={`rounded-2xl border-2 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
                normStatus === "completed"
                  ? "border-emerald-300 bg-emerald-50/75"
                  : "border-emerald-500/50 bg-gradient-to-r from-emerald-50 via-emerald-50/45 to-white"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    normStatus === "completed"
                      ? "bg-emerald-700 text-white"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  }`}
                >
                  {normStatus === "completed" ? (
                    <Lock className="h-5 w-5" />
                  ) : caps.isAssignedResearcher ? (
                    <UserCheck className="h-5 w-5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-serif text-sm font-bold text-emerald-950">
                      {normStatus === "completed"
                        ? "Predmet je trajno zatvoren i zaključan (Status: Završeno)"
                        : caps.isAssignedResearcher
                        ? "Ovaj istraživački predmet je dodijeljen vama"
                        : "Završetak istraživanja i zatvaranje predmeta"}
                    </h4>
                    {caps.isAssignedResearcher && (
                      <Badge className="bg-emerald-700 text-white border-emerald-700 text-[10px] font-bold">
                        Dodijeljeni istraživač
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-emerald-900/85 leading-relaxed">
                    {normStatus === "completed"
                      ? "Daljnji rad i izmjene na ovom predmetu više nisu mogući. Podnositelj i istraživač dobili su obavijest o zatvaranju; za sve nove promjene ili dorade potrebno je poslati novi upit."
                      : caps.isAssignedResearcher
                      ? "Možete prilagati datoteke, upisivati sve bilješke, radnje i zaključak te zatvoriti predmet kada završite obradu (uz automatsko slanje obavijesti vama i podnositelju)."
                      : "Kada unesete nalaze i dokumente, zatvorite predmet uz drugu potvrdu. Po zatvaranju sustav automatski šalje obavijest istraživaču i podnositelju te zaključava predmet."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {normStatus === "completed" ? (
                  <>
                    {String(user?.role || "").toLowerCase() === "admin" &&
                      !form.feedback?.submitted_at && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setFeedbackModalOpen(true)}
                          className="rounded-full h-9 px-4 font-bold bg-[#1E3A5F] hover:bg-[#162D4A] text-white border border-[#D97706] shadow-xs gap-1.5"
                        >
                          <Star className="h-3.5 w-3.5 text-[#D97706]" />
                          {form.feedback?.sent_at
                            ? "Pošalji anketu ponovno"
                            : "Pošalji provjeru zadovoljstva"}
                        </Button>
                      )}
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-xs">
                      <Lock className="h-3.5 w-3.5" /> Zaključano
                    </span>
                  </>
                ) : (
                  normStatus !== "rejected" &&
                  caps.canCloseCase && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenCloseModal("test")}
                        className="rounded-full h-10 px-4 font-semibold border-2 border-[#D97706] bg-white text-[#1E3A5F] hover:bg-[#FEFCE8] gap-1.5"
                      >
                        <FlaskConical className="h-4 w-4 text-[#D97706]" />
                        Testiraj zatvaranje
                      </Button>
                      <FinishActionButton
                        label="Zatvori predmet"
                        onClick={() => handleOpenCloseModal("confirm")}
                      />
                    </>
                  )
                )}
              </div>
            </div>
          )}

          {/* Arhiva provjere zadovoljstva korisnika na zatvorenom predmetu */}
          {normStatus === "completed" && form.feedback && (
            <div className="rounded-2xl border border-[#CEA369]/60 bg-gradient-to-br from-[#FEFCE8]/90 via-white to-white p-4 space-y-3 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-amber-100 border border-[#D97706]/30 flex items-center justify-center text-[#D97706] shrink-0">
                    <Award className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-serif text-sm font-bold text-[#7C2D12]">
                      Arhiva zadovoljstva naručitelja
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      {form.feedback.submitted_at
                        ? `Ocjena zaprimljena: ${formatDateTimeHr(form.feedback.submitted_at)}`
                        : `Anketa poslana: ${formatDateTimeHr(form.feedback.sent_at)} (${
                            form.feedback.opened_at
                              ? `otvorena ${formatDateTimeHr(form.feedback.opened_at)}`
                              : "još nije otvorena"
                          })`}
                    </p>
                  </div>
                </div>

                {form.feedback.submitted_at ? (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FEFCE8] border border-[#D97706] px-3 py-1 text-xs font-bold text-[#7C2D12]">
                    <Star className="h-3.5 w-3.5 fill-[#D97706] text-[#D97706]" />
                    Prosjek: {Number(form.feedback.average_rating || 0).toFixed(2)} / 5
                  </div>
                ) : (
                  <Badge variant="outline" className="text-[11px] border-amber-300 bg-amber-50 text-amber-900">
                    Čeka odgovor naručitelja
                  </Badge>
                )}
              </div>

              {form.feedback.submitted_at && (
                <div className="space-y-2.5 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                    {INQUIRY_FEEDBACK_QUESTIONS.map((q) => {
                      const val = Number((form.feedback as any)?.[q.key] || 0)
                      return (
                        <div
                          key={q.key}
                          className="rounded-xl border border-[#E8E4DE] bg-white p-2.5 space-y-1 text-xs"
                        >
                          <div className="text-[10px] font-semibold text-muted-foreground line-clamp-2">
                            {q.shortTitle}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#1E3A5F]">{val}/5</span>
                            <span className="inline-flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`h-3 w-3 ${
                                    s <= val ? "fill-[#D97706] text-[#D97706]" : "text-slate-200"
                                  }`}
                                />
                              ))}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {form.feedback.financial_support && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-950 flex flex-wrap items-center gap-2">
                      <HeartHandshake className="h-4 w-4 text-emerald-700 shrink-0" />
                      <span>
                        <strong>Financijska podrška radu Društva:</strong>{" "}
                        {getFinancialSupportLabel(String(form.feedback.financial_support))}
                      </span>
                      {form.feedback.payment_info_sent_at && (
                        <span className="inline-flex items-center rounded-full border border-amber-300 bg-[#FEFCE8] px-2.5 py-0.5 text-[10px] font-semibold text-[#7C2D12]">
                          Poslane upute i QR kod na e-mail ({formatDateTimeDMY(form.feedback.payment_info_sent_at)})
                        </span>
                      )}
                    </div>
                  )}

                  {form.feedback.comment && (
                    <div className="rounded-xl border border-[#E8E4DE] bg-[#FBF9F6] p-3 text-xs text-slate-800">
                      <span className="font-bold text-[#1E3A5F] block mb-1">Komentar naručitelja:</span>
                      <p className="italic leading-relaxed whitespace-pre-wrap">„{form.feedback.comment}”</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Quick Status & Researcher Assignment + Official Emails Action Panel */}
          <div className="bg-gradient-to-r from-amber-50/90 via-amber-50/40 to-background border border-amber-200/90 rounded-2xl p-4 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                  Upravljanje zaduženjem i službena e-mail komunikacija
                </span>
                <h4 className="font-serif text-base font-bold text-amber-950">
                  {caps.canReassign
                    ? "Dodijelite istraživača i pošaljite službeni e-mail iz sustava"
                    : "Podaci o dodijeljenom istraživaču"}
                </h4>
              </div>

              {/* Quick 3-status switcher */}
              {caps.canReassign && (
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
                        onClick={() => {
                          if (st === "completed") {
                            handleOpenCloseModal("confirm")
                          } else {
                            setForm({ ...form, status: st })
                          }
                        }}
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
                disabled={!caps.canReassign}
                label="Odgovorni istraživač (Odabirom osobe upit prelazi u status 'U radu')"
              />
            </div>

            {/* Quick action link to Obavijesti i e-pošta */}
            <div className="pt-2 border-t border-amber-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="text-xs text-amber-950">
                <span className="font-semibold">Poslani e-mailovi i kronologija:</span>{" "}
                <span className="text-amber-900/80">
                  {emailLogs.length > 0
                    ? `Evidentirano ${emailLogs.length} zapisa komunikacije`
                    : "Još nema poslanih službenih obavijesti."}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("communications")}
                className="rounded-full gap-1.5 border-[#1E3A5F]/35 bg-white text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white font-semibold text-xs shrink-0"
              >
                <Mail className="h-3.5 w-3.5" />
                {caps.canSendOfficialEmail ? "Otvori obavijesti i slanje e-pošte" : "Otvori kronologiju komunikacije"}
              </Button>
            </div>
          </div>
          </>
          )}

          {activeTab === "communications" && (
            <>
              {/* Official Email Buttons */}
              {caps.canSendOfficialEmail && (() => {
                const isAssignedAndNotCompleted =
                  Boolean(form.assigned_to_id || (form.assigned_to_name && String(form.assigned_to_name).trim())) &&
                  form.status !== "completed" &&
                  (form.status as string) !== "zavrseno" &&
                  form.status !== "rejected"

                return (
                  <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/80 via-amber-50/40 to-card p-4 space-y-3 shadow-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                        Službena e-mail komunikacija iz sustava
                      </span>
                      <h4 className="font-serif text-base font-bold text-amber-950">
                        Odaberite vrstu službene obavijesti
                      </h4>
                    </div>
                    <div className={`grid grid-cols-1 ${isAssignedAndNotCompleted ? "md:grid-cols-3" : "md:grid-cols-2"} gap-3`}>
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

                      {isAssignedAndNotCompleted && (
                        <div className="rounded-xl bg-white border border-emerald-300 p-3 flex flex-col justify-between gap-2.5 shadow-2xs">
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                              <Clock className="h-4 w-4 text-emerald-700 shrink-0" />
                              <span>3. Mail za provjeru statusa (Dodijeljen predmet)</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                              Topao upit podnositelju za provjeru tijeka komunikacije s istraživačem ili potvrdu mogu li zatvoriti predmet ako su odustali.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEmailModalType("to_requester_check")}
                            className="w-full rounded-xl gap-1.5 border-emerald-400 text-emerald-800 hover:bg-emerald-50 text-xs font-semibold"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Pripremi i pošalji mail za provjeru
                          </Button>
                        </div>
                      )}
                    </div>

                    {isAssignedAndNotCompleted && (form.source_messages || []).length > 1 && (
                      <div className="rounded-xl bg-indigo-50/80 border border-indigo-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="text-xs text-indigo-950">
                          <span className="font-bold block">
                            Predmet sadrži {(form.source_messages || []).length} povezana e-maila
                          </span>
                          <span className="text-[11px] text-indigo-900/85">
                            Ako je naknadno stigla nova dopuna, možete odmah poslati samo taj novi e-mail i njegove privitke dodijeljenom istraživaču (uz naručitelja u CC).
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            const list = form.source_messages || []
                            setSupplementForEmail(list[list.length - 1] || null)
                            setEmailModalType("to_researcher_supplement")
                          }}
                          className="rounded-full gap-1.5 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white border border-[#D97706] text-xs font-bold shrink-0"
                        >
                          <Send className="h-3.5 w-3.5 text-[#D97706]" />
                          Pošalji zadnju dopunu istraživaču
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })()}

          {/* Section: Kronološki tijek predmeta, poslanih e-mailova i odgovora na provjeru statusa */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <History className="h-4 w-4 text-primary" />
                  Kronološki tijek predmeta, e-mailova i opravdanja ({timelineNodes.length})
                </h4>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                    <Mail className="h-2.5 w-2.5 text-slate-500" /> Poslani e-mailovi: {emailLogs.filter((l) => l.type !== "requester_status_response").length}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                    <Clock className="h-2.5 w-2.5 text-emerald-600" /> Provjere statusa: {checkEmailsCount}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                    <MessageSquareText className="h-2.5 w-2.5 text-indigo-600" /> Odgovori / opravdanja: {statusResponsesCount}
                  </span>
                  {hasUnansweredCheck && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[10px] font-semibold text-orange-800">
                      <AlertCircle className="h-2.5 w-2.5 text-orange-600" /> Čeka se odgovor osobe
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTimelineOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                  className="h-7 px-2.5 text-[11px] rounded-full bg-white gap-1.5"
                  title="Promijeni kronološki redoslijed prikaza"
                >
                  <ArrowUpDown className="h-3 w-3" />
                  {timelineOrder === "asc" ? "Od najstarijeg prema najnovijem" : "Od najnovijeg prema najstarijem"}
                </Button>
                {effectiveCanEdit && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setResponseError("")
                      setEditingResponseLogId(null)
                      setStandaloneDateInput(new Date().toISOString().slice(0, 10))
                      setStandaloneTextInput("")
                      setShowNewStandaloneResponse((prev) => !prev)
                    }}
                    className="h-7 px-3 text-[11px] rounded-full bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Evidentiraj odgovor osobe
                  </Button>
                )}
              </div>
            </div>

            {showNewStandaloneResponse && effectiveCanEdit && (
              <div className="rounded-xl border border-indigo-300 bg-white p-3.5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <MessageSquareText className="h-4 w-4 text-indigo-600" />
                    Novi kronološki zapis — odgovor osobe i opravdanje zašto je predmet još otvoren
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewStandaloneResponse(false)
                      setResponseError("")
                    }}
                    className="text-muted-foreground hover:text-foreground p-1 rounded"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <DateOrYearInput
                      label="Datum odgovora osobe *"
                      value={standaloneDateInput}
                      onChange={setStandaloneDateInput}
                      inputClassName="h-8 text-xs"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-medium block">
                      Odgovor od osobe / opravdanje zašto je predmet još otvoren *
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Upišite što je osoba odgovorila (npr. čeka se odgovor iz župnog ureda, osoba je na putu i nastavlja sljedeći mjesec, traži dodatne podatke...)"
                      className="w-full rounded-xl border border-border bg-background p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      value={standaloneTextInput}
                      onChange={(e) => setStandaloneTextInput(e.target.value)}
                    />
                  </div>
                </div>
                {responseError && (
                  <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {responseError}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <CloseActionButton
                    label="Odustani"
                    size="sm"
                    onClick={() => {
                      setShowNewStandaloneResponse(false)
                      setResponseError("")
                    }}
                  />
                  <SaveActionButton
                    label="Spremi odgovor u kronologiju"
                    size="sm"
                    loading={savingResponse}
                    onClick={handleSaveStandaloneResponse}
                  />
                </div>
              </div>
            )}

            {timelineNodes.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">
                Još nema evidentiranih kronoloških zapisa za ovaj upit.
              </p>
            ) : (
              <div className="relative pl-5 space-y-3 before:content-[''] before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-300">
                {timelineNodes.map((node) => {
                  if (node.kind === "received") {
                    return (
                      <div key={node.id} className="relative">
                        <span className="absolute -left-5 top-3 h-3.5 w-3.5 rounded-full border-2 border-purple-600 bg-white" />
                        <div className="rounded-xl border border-purple-200/80 bg-white p-3 text-xs shadow-2xs flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-900 border border-purple-200">
                              <Inbox className="h-2.5 w-2.5" /> 1. Zaprimanje upita
                            </span>
                            <span className="font-bold text-slate-900">{formatDateHr(node.dateStr)}</span>
                            <span className="text-slate-700">
                              Podnositelj: <strong>{form.requester_name}</strong>
                              {form.gmail_message_id ? " • Uvezeno iz Gmail Inboxa" : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  if (node.kind === "assigned") {
                    return (
                      <div key={node.id} className="relative">
                        <span className="absolute -left-5 top-3 h-3.5 w-3.5 rounded-full border-2 border-amber-500 bg-white" />
                        <div className="rounded-xl border border-amber-200/80 bg-white p-3 text-xs shadow-2xs flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                              <UserCheck className="h-2.5 w-2.5" /> Dodjela istraživaču
                            </span>
                            <span className="font-bold text-slate-900">{formatDateHr(node.dateStr)}</span>
                            <span className="text-slate-700">
                              Odgovorni istraživač: <strong>{node.researcherName}</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  if (node.kind === "supplement") {
                    const sm = node.msg
                    const isSuppExpanded = expandedSourceMsgId === sm.id
                    return (
                      <div key={node.id} className="relative">
                        <span className="absolute -left-5 top-3 h-3.5 w-3.5 rounded-full border-2 border-indigo-500 bg-white" />
                        <div className="rounded-xl border border-indigo-200 bg-white overflow-hidden shadow-2xs">
                          <div className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
                                  <Mail className="h-2.5 w-2.5" />
                                  {sm.merged_from_inquiry_id
                                    ? `Spojeni predmet #${sm.merged_from_inquiry_id} (Dopuna #${node.supplementNum})`
                                    : `Pristigla dopuna upita #${node.supplementNum}`}
                                </span>
                                <span className="font-bold text-slate-900">
                                  {formatDateTimeHr(sm.received_at || sm.received_date)}
                                </span>
                                <span className="text-slate-700">
                                  • {sm.from_name}
                                  {sm.from_email ? ` (${sm.from_email})` : ""}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-0.5">
                                <span>
                                  <strong>Naslov:</strong> {sm.subject}
                                </span>
                                {sm.attachments_names && sm.attachments_names.length > 0 && (
                                  <span className="text-amber-800 font-medium">
                                    📎 Prilozi ({sm.attachments_names.length}): {sm.attachments_names.join(", ")}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedSourceMsgId(isSuppExpanded ? null : sm.id)}
                              className="h-7 px-2.5 text-xs gap-1"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              {isSuppExpanded ? "Sakrij tekst" : "Pregledaj tekst"}
                            </Button>
                          </div>
                          {isSuppExpanded && (
                            <div className="p-3 border-t border-indigo-100 bg-indigo-50/30 text-xs whitespace-pre-wrap leading-relaxed text-slate-800">
                              {sm.body_text}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  }

                  const log = node.log
                  const isStandaloneResponse = log.type === "requester_status_response"
                  const isEditingThisResponse = editingResponseLogId === log.id

                  if (isStandaloneResponse) {
                    return (
                      <div key={node.id} className="relative">
                        <span className="absolute -left-5 top-3 h-3.5 w-3.5 rounded-full border-2 border-indigo-600 bg-indigo-100" />
                        <div className="rounded-xl border border-indigo-200 bg-white overflow-hidden shadow-2xs">
                          <div className="p-3 space-y-2 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
                                  <MessageSquareText className="h-2.5 w-2.5" />
                                  Odgovor osobe / Opravdanje otvorenog predmeta
                                </span>
                                <span className="font-bold text-indigo-950">
                                  Datum odgovora: {formatDateHr(log.response_date || log.sent_at)}
                                </span>
                                {(log.response_recorded_by || log.sent_by_name) && (
                                  <span className="text-[11px] text-muted-foreground">
                                    • Upisao/la: {log.response_recorded_by || log.sent_by_name}
                                    {log.response_recorded_at ? ` (${formatDateTimeHr(log.response_recorded_at)})` : ""}
                                  </span>
                                )}
                              </div>
                              {effectiveCanEdit && !isEditingThisResponse && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openInlineResponseEditor(log)}
                                    className="h-7 px-2 text-xs text-indigo-700 hover:bg-indigo-50 gap-1"
                                  >
                                    <Edit3 className="h-3 w-3" /> Uredi
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteStandaloneResponse(log.id)}
                                    className="h-7 px-2 text-xs text-red-600 hover:bg-red-50"
                                    title="Obriši ovaj zapis"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>

                            {isEditingThisResponse ? (
                              <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 space-y-2.5">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <DateOrYearInput
                                    label="Datum odgovora osobe *"
                                    value={responseDateInput}
                                    onChange={setResponseDateInput}
                                    inputClassName="h-8 text-xs"
                                  />
                                  <div className="md:col-span-2 space-y-1.5">
                                    <label className="text-xs font-medium block">
                                      Odgovor / opravdanje zašto je predmet još otvoren *
                                    </label>
                                    <textarea
                                      rows={3}
                                      className="w-full rounded-xl border border-border bg-white p-2.5 text-xs focus:outline-none"
                                      value={responseTextInput}
                                      onChange={(e) => setResponseTextInput(e.target.value)}
                                    />
                                  </div>
                                </div>
                                {responseError && (
                                  <p className="text-xs text-red-600 font-medium">{responseError}</p>
                                )}
                                <div className="flex justify-end gap-2">
                                  <CloseActionButton
                                    label="Odustani"
                                    size="sm"
                                    onClick={() => setEditingResponseLogId(null)}
                                  />
                                  <SaveActionButton
                                    label="Spremi"
                                    size="sm"
                                    loading={savingResponse}
                                    onClick={() => handleSaveLogResponse(log.id)}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-lg bg-indigo-50/60 border border-indigo-100 p-2.5 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                                {log.response_text}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  }

                  const isExpanded = expandedLogId === log.id
                  const isToResearcher = log.type === "to_researcher"
                  const isToSupplement = log.type === "to_researcher_supplement"
                  const isToCheck = log.type === "to_requester_check"
                  const isClosedRequester = log.type === "case_closed_requester"
                  const isClosedResearcher = log.type === "case_closed_researcher"
                  const isClosedArchive = log.type === "case_closed_archive"
                  const isSatisfactionSurvey = log.type === "satisfaction_survey"
                  const hasResponse = Boolean(log.response_text && log.response_text.trim())

                  return (
                    <div key={node.id} className="relative">
                      <span
                        className={`absolute -left-5 top-3 h-3.5 w-3.5 rounded-full border-2 bg-white ${
                          isClosedRequester || isClosedResearcher || isClosedArchive
                            ? "border-purple-600"
                            : isSatisfactionSurvey
                            ? "border-amber-500"
                            : isToResearcher || isToSupplement
                            ? "border-amber-600"
                            : isToCheck
                            ? "border-emerald-600"
                            : "border-sky-600"
                        }`}
                      />
                      <div className="rounded-xl border border-border bg-white overflow-hidden shadow-2xs">
                        <div className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                  isClosedRequester || isClosedResearcher || isClosedArchive
                                    ? "bg-purple-50 text-purple-900 border-purple-300"
                                    : isSatisfactionSurvey
                                    ? "bg-amber-50 text-amber-900 border-amber-300"
                                    : isToResearcher || isToSupplement
                                    ? "bg-amber-50 text-amber-900 border-amber-300"
                                    : isToCheck
                                    ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                                    : "bg-sky-50 text-sky-900 border-sky-300"
                                }`}
                              >
                                {isClosedRequester || isClosedResearcher || isClosedArchive ? (
                                  <Lock className="h-2.5 w-2.5" />
                                ) : (
                                  <Send className="h-2.5 w-2.5" />
                                )}
                                {isClosedRequester
                                  ? "Automatska obavijest podnositelju (Predmet zatvoren)"
                                  : isClosedResearcher
                                  ? "Automatska obavijest istraživaču (Predmet zatvoren)"
                                  : isClosedArchive
                                  ? "Automatski arhivski zapis (rodoslovlje@rodoslovlje.hr)"
                                  : isSatisfactionSurvey
                                  ? "Anketa zadovoljstva poslana naručitelju"
                                  : isToSupplement
                                  ? "Poslana dopuna upita istraživaču (Podnositelj u CC)"
                                  : isToResearcher
                                  ? "Poslano istraživaču (Podnositelj u CC)"
                                  : isToCheck
                                  ? "Poslana provjera statusa podnositelju"
                                  : "Poslana obavijest podnositelju (Na čekanju)"}
                              </span>
                              <span className="text-muted-foreground font-medium">
                                {formatDateTimeHr(log.sent_at)}
                              </span>
                              <span className="text-slate-700 font-semibold">
                                • Poslao/la: {log.sent_by_name}
                              </span>
                              {isToCheck && (
                                hasResponse ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                    <CheckCircle2 className="h-2.5 w-2.5 text-indigo-600" />
                                    Odgovoreno {formatDateHr(log.response_date)}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 text-orange-800 border border-orange-200">
                                    <Clock className="h-2.5 w-2.5 text-orange-600" />
                                    Čeka odgovor osobe
                                  </span>
                                )
                              )}
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

                        {/* Odgovor osobe i opravdanje za poslanu provjeru statusa */}
                        {(isToCheck || hasResponse) && (
                          <div className="border-t border-border/70 bg-slate-50/70 px-3 py-2.5 space-y-2">
                            {isEditingThisResponse ? (
                              <div className="rounded-xl border border-indigo-200 bg-white p-3 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                                    <MessageSquareText className="h-3.5 w-3.5 text-indigo-600" />
                                    Unos datuma i odgovora osobe (opravdanje zašto je predmet još otvoren)
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <DateOrYearInput
                                      label="Datum odgovora osobe *"
                                      value={responseDateInput}
                                      onChange={setResponseDateInput}
                                      inputClassName="h-8 text-xs"
                                    />
                                  </div>
                                  <div className="md:col-span-2 space-y-1.5">
                                    <label className="text-xs font-medium block">
                                      Odgovor osobe / opravdanje otvorenog predmeta *
                                    </label>
                                    <textarea
                                      rows={3}
                                      placeholder="Upišite sažetak ili točan odgovor osobe kojim se opravdava zašto predmet još nije zatvoren..."
                                      className="w-full rounded-xl border border-border bg-background p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                      value={responseTextInput}
                                      onChange={(e) => setResponseTextInput(e.target.value)}
                                    />
                                  </div>
                                </div>
                                {responseError && (
                                  <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {responseError}
                                  </p>
                                )}
                                <div className="flex justify-end gap-2">
                                  <CloseActionButton
                                    label="Odustani"
                                    size="sm"
                                    onClick={() => {
                                      setEditingResponseLogId(null)
                                      setResponseError("")
                                    }}
                                  />
                                  <SaveActionButton
                                    label="Spremi odgovor i opravdanje"
                                    size="sm"
                                    loading={savingResponse}
                                    onClick={() => handleSaveLogResponse(log.id)}
                                  />
                                </div>
                              </div>
                            ) : hasResponse ? (
                              <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 space-y-1.5 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                                      <MessageSquareText className="h-3.5 w-3.5 text-indigo-600" />
                                      Odgovor osobe / Opravdanje zašto je predmet još otvoren
                                    </span>
                                    <Badge className="bg-white text-indigo-900 border border-indigo-300 text-[10px] font-bold">
                                      Datum odgovora: {formatDateHr(log.response_date)}
                                    </Badge>
                                  </div>
                                  {effectiveCanEdit && (
                                    <div className="flex items-center gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openInlineResponseEditor(log)}
                                        className="h-6 px-2 text-[11px] text-indigo-800 hover:bg-indigo-100 gap-1"
                                      >
                                        <Edit3 className="h-3 w-3" /> Uredi odgovor
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleClearLogResponse(log.id)}
                                        className="h-6 px-1.5 text-[11px] text-red-600 hover:bg-red-50"
                                        title="Ukloni evidentirani odgovor"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <p className="text-slate-900 whitespace-pre-wrap leading-relaxed bg-white/80 rounded-lg p-2.5 border border-indigo-100">
                                  {log.response_text}
                                </p>
                                {(log.response_recorded_by || log.response_recorded_at) && (
                                  <p className="text-[10px] text-indigo-900/75">
                                    Evidentirao/la: <strong>{log.response_recorded_by || "—"}</strong>
                                    {log.response_recorded_at
                                      ? ` • ${formatDateTimeHr(log.response_recorded_at)}`
                                      : ""}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-dashed border-orange-300 bg-orange-50/60 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                                <span className="text-orange-900 font-medium flex items-center gap-1.5">
                                  <Clock className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                                  Čeka se odgovor osobe na poslanu provjeru statusa.
                                </span>
                                {effectiveCanEdit && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openInlineResponseEditor(log)}
                                    className="h-7 px-3 text-[11px] rounded-full border-orange-400 bg-white text-orange-900 hover:bg-orange-100 font-semibold gap-1.5"
                                  >
                                    <MessageSquareText className="h-3 w-3" />
                                    Unesi datum i odgovor osobe (opravdanje)
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {isExpanded && (
                          <div className="p-4 border-t border-border bg-slate-50/50 overflow-x-auto">
                            <div
                              className="bg-white p-4 rounded-xl border border-border text-xs"
                              dangerouslySetInnerHTML={{ __html: log.html_body }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          </>
          )}

          {/* Section 1: Podnositelj i upit */}
          {activeTab === "details" && (
          <div className="bg-muted/20 border border-border/80 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
              1. Podaci o zaprimljenom upitu
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">
                  Ime i prezime podnositelja:
                </span>
                {effectiveCanEdit ? (
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
                {effectiveCanEdit ? (
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
                {effectiveCanEdit ? (
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
                {effectiveCanEdit ? (
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
                {effectiveCanEdit ? (
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

            {Array.isArray(form.source_messages) && form.source_messages.length > 1 && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-indigo-600" />
                    Povezani e-mailovi i dopune upita ({form.source_messages.length})
                  </span>
                  <span className="text-[11px] text-indigo-900/80">
                    FIFO datum zaprimanja: <strong>{formatDateHr(form.inquiry_date)}</strong>
                  </span>
                </div>
                <div className="space-y-2">
                  {form.source_messages.map((sm, idx) => {
                    const isOpen = expandedSourceMsgId === sm.id
                    const canForwardThis = Boolean(
                      idx > 0 &&
                        caps.canSendOfficialEmail &&
                        normStatus !== "completed" &&
                        normStatus !== "rejected" &&
                        (assignedMember || form.assigned_to_name)
                    )
                    return (
                      <div
                        key={sm.id || idx}
                        className="rounded-xl border border-indigo-200/80 bg-white overflow-hidden text-xs"
                      >
                        <div className="p-2.5 flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
                                {idx === 0
                                  ? "#1 Izvorni upit"
                                  : sm.merged_from_inquiry_id
                                  ? `#${idx + 1} Spojeno iz #${sm.merged_from_inquiry_id}`
                                  : `#${idx + 1} Dopuna upita`}
                              </span>
                              <span className="font-semibold text-slate-900">
                                {formatDateTimeHr(sm.received_at || sm.received_date)}
                              </span>
                              <span className="text-slate-600 truncate">
                                • {sm.from_name}
                                {sm.from_email ? ` (${sm.from_email})` : ""}
                              </span>
                            </div>
                            <p className="font-medium text-slate-800 truncate">{sm.subject}</p>
                            {sm.attachments_names && sm.attachments_names.length > 0 && (
                              <p className="text-[10px] text-amber-800">
                                📎 Prilozi ({sm.attachments_names.length}): {sm.attachments_names.join(", ")}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {canForwardThis && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSupplementForEmail(sm)
                                  setEmailModalType("to_researcher_supplement")
                                }}
                                className="h-7 px-2.5 text-[11px] rounded-full border-[#D97706] text-[#1E3A5F] hover:bg-amber-50 font-semibold gap-1"
                              >
                                <Send className="h-3 w-3 text-[#D97706]" />
                                Proslijedi istraživaču
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpandedSourceMsgId(isOpen ? null : sm.id)}
                              className="h-7 px-2 text-[11px] gap-1"
                            >
                              {isOpen ? (
                                <>
                                  <ChevronUp className="h-3.5 w-3.5" /> Sakrij
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3.5 w-3.5" /> Sadržaj
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                        {isOpen && (
                          <div className="p-3 border-t border-indigo-100 bg-slate-50/70 whitespace-pre-wrap leading-relaxed text-slate-800">
                            {sm.body_text}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div>
              <span className="text-xs text-muted-foreground block mb-1">
                Objedinjeni tekst upita (svi povezani e-mailovi):
              </span>
              {effectiveCanEdit ? (
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
          )}

          {/* Section 2: Prilozi i dokumentacija iz upita i obrade */}
          {activeTab === "attachments" && (
          <div className="bg-muted/20 border border-border rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                  2. Prilozi iz upita i dokumentacija ({(form.attachments || []).length})
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Podržani formati: slike, PDF, Word, Excel, PowerPoint, ODT/ODS, TXT, CSV, GEDCOM (.ged), ZIP (maks. 20 MB)
                </p>
              </div>
              {effectiveCanEdit && (
                <>
                  <input
                    type="file"
                    ref={fileRef}
                    multiple
                    accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.tif,.tiff,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.txt,.csv,.ged,.zip"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className={ACTION_BUTTON_STYLES.saveSm}
                  >
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5 text-[#CEA369]" />
                    )}
                    {uploading ? "Prijenos i spremanje…" : "Dodaj datoteke / priloge"}
                  </Button>
                </>
              )}
            </div>

            {effectiveCanEdit && (
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDraggingFiles(true)
                }}
                onDragLeave={() => setIsDraggingFiles(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDraggingFiles(false)
                  if (e.dataTransfer?.files?.length) {
                    uploadFilesToCase(e.dataTransfer.files)
                  }
                }}
                onClick={() => !uploading && fileRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-3 text-center text-xs transition-all ${
                  isDraggingFiles
                    ? "border-primary bg-primary/5 text-primary font-semibold"
                    : "border-border bg-background/70 text-muted-foreground hover:border-primary/60 hover:bg-background"
                }`}
              >
                {uploading ? (
                  <span className="inline-flex items-center gap-2 font-medium text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" /> Prijenos i trajno spremanje datoteka u predmet…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Paperclip className="h-3.5 w-3.5" />
                    Kliknite ili povucite datoteke ovdje — prilozi se odmah trajno spremaju u predmet
                  </span>
                )}
              </div>
            )}

            {uploadFeedback && (
              <div
                className={`rounded-xl border px-3 py-2 text-xs font-medium flex items-center justify-between gap-2 ${
                  uploadFeedback.type === "success"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-red-300 bg-red-50 text-red-800"
                }`}
              >
                <span>{uploadFeedback.text}</span>
                <button
                  type="button"
                  onClick={() => setUploadFeedback(null)}
                  className="text-current opacity-70 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">
                Vanjski link na mapu / online arhivu:
              </label>
              {effectiveCanEdit ? (
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

            {form.attachments && form.attachments.length > 0 && (() => {
              const totalAttBytes = sumAttachmentsSize(form.attachments)
              return (
                <div className="space-y-2 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Spremljene datoteke (automatski se šalju istraživaču kod prosljeđivanja):
                    </span>
                    {totalAttBytes > 0 && (
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          totalAttBytes > MAX_GMAIL_TOTAL_ATTACHMENTS_BYTES
                            ? "bg-amber-50 text-amber-900 border-amber-300"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        Ukupno: {formatBytesCompact(totalAttBytes)}
                      </span>
                    )}
                  </div>
                  {totalAttBytes > MAX_GMAIL_TOTAL_ATTACHMENTS_BYTES && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-950 flex items-start gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-700 shrink-0 mt-0.5" />
                      <span>
                        Ukupna veličina privitaka prelazi 20 MB. Pri slanju e-maila istraživaču možete odabrati samo pojedine datoteke kako ne bi došlo do odbijanja zbog Gmail ograničenja (25 MB).
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {form.attachments.map((att, idx) => (
                      <div
                        key={att.id || idx}
                        className="flex items-center justify-between p-2 rounded-xl border border-border bg-background text-xs gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Paperclip className="h-3.5 w-3.5 text-primary shrink-0" />
                          <div className="min-w-0">
                            <span className="truncate font-medium block">{att.name}</span>
                            {(att.source_date || att.size) && (
                              <span className="text-[10px] text-muted-foreground block truncate">
                                {att.source_date ? `Zaprimljeno ${formatDateHr(att.source_date)}` : ""}
                                {att.source_date && att.size ? " • " : ""}
                                {att.size ? formatBytesCompact(att.size) : ""}
                              </span>
                            )}
                          </div>
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
                          {effectiveCanEdit && (
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(idx)}
                              className="p-1 text-muted-foreground hover:text-red-600 rounded"
                              title="Ukloni datoteku"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
          )}

          {/* Section 3: Istraživački rad i nalazi */}
          {activeTab === "work" && (
          <div className="bg-emerald-50/20 border border-emerald-200/50 rounded-2xl p-4 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
              3. Istraživački rad, zabilješke i konačni rezultat
            </h4>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Odgovor i zabilješke istraživača
              </label>
              {effectiveCanEdit ? (
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
              {effectiveCanEdit ? (
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
              {effectiveCanEdit ? (
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
              {effectiveCanEdit ? (
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

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Dodatne bilješke i interne napomene
              </label>
              {effectiveCanEdit ? (
                <textarea
                  rows={2}
                  placeholder="Sve dodatne napomene, kontakti župa/arhiva ili upute za kolege..."
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs focus:outline-none"
                  value={form.notes || ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              ) : (
                <p className="text-xs whitespace-pre-wrap text-muted-foreground">
                  {form.notes || "Nema dodatnih napomena."}
                </p>
              )}
            </div>
          </div>
          )}
        </div>

        {/* Standardizirano fiksno podnožje s jasno odvojenim gumbima */}
        <ModalActionFooter
          left={
            <>
              {caps.canDeleteCase && (
                <DeleteActionButton
                  label="Obriši upit"
                  size="sm"
                  onClick={handleDelete}
                />
              )}
              {isDirty && effectiveCanEdit && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                  <AlertCircle className="h-3 w-3 text-amber-700" /> Nespremljene izmjene
                </span>
              )}
            </>
          }
          right={
            <>
              <CloseActionButton
                label="Zatvori prozor"
                onClick={handleSafeClose}
              />
              {effectiveCanEdit && (
                <SaveActionButton
                  label="Spremi promjene"
                  loading={isSaving}
                  onClick={() => handleSave(true)}
                />
              )}
              {caps.canCloseCase && normStatus !== "completed" && normStatus !== "rejected" && (
                <FinishActionButton
                  label="Zatvori predmet"
                  onClick={() => handleOpenCloseModal("confirm")}
                />
              )}
              {normStatus === "completed" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-900">
                  <Lock className="h-3.5 w-3.5 text-emerald-700" /> Trajno zatvoreno
                </span>
              )}
            </>
          }
        />
      </div>

      {/* Modal druge potvrde, pregleda e-mailova i testiranja zatvaranja predmeta */}
      <InquiryCloseCaseModal
        open={closeModalState.open}
        initialTab={closeModalState.initialTab}
        inquiry={form}
        members={members}
        user={user}
        settings={settings}
        getAuthHeaders={getInquiryAuthHeaders}
        getActorPayload={getInquiryActorPayload}
        onClose={() => setCloseModalState({ open: false, initialTab: "confirm" })}
        onClosedSuccess={handleClosedSuccess}
      />

      {/* Modal za slanje ankete zadovoljstva (samo Administrator na zatvorenim predmetima) */}
      <InquiryFeedbackEmailModal
        open={feedbackModalOpen}
        inquiry={form}
        members={members}
        user={user}
        settings={settings}
        getAuthHeaders={getInquiryAuthHeaders}
        getActorPayload={getInquiryActorPayload}
        onClose={() => setFeedbackModalOpen(false)}
        onSentSuccess={(updatedFeedback) => {
          if (updatedFeedback) {
            setForm((prev) => ({ ...prev, feedback: updatedFeedback }))
          }
          onRefresh()
        }}
      />

      {/* Email Preparation & Sending Sub-Modal */}
      {emailModalType && (
        <InquirySendEmailModal
          emailType={emailModalType}
          inquiry={form}
          members={members}
          selectedMember={assignedMember}
          supplementMessage={supplementForEmail}
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
          onClose={() => {
            setEmailModalType(null)
            setSupplementForEmail(null)
          }}
          onSuccess={(updatedInquiry) => {
            setForm(updatedInquiry)
            setEmailModalType(null)
            setSupplementForEmail(null)
            onRefresh()
          }}
        />
      )}
    </div>
  )
}
